-- ============================================================================
--  BUDGETS DE PERFORMANCE — MESURÉS SOUS RLS, COMME L'APPLICATION
-- ============================================================================
--  CE QUI EST MESURÉ, ET POURQUOI CE DÉTAIL CHANGE TOUT.
--
--  Chaque requête est exécutée AVEC LE RÔLE `authenticated` et une identité de
--  session, donc à travers les politiques de sécurité au niveau des lignes.
--  Mesurer en tant que propriétaire de la base donnerait des chiffres flatteurs
--  et faux : le propriétaire contourne la RLS, et c'est précisément le coût de
--  la RLS qu'on cherche à connaître.
--
--  `app.is_member` est `security definer`. Le planificateur ne peut donc PAS
--  l'incorporer : elle est appelée pour chaque ligne examinée, avec un argument
--  qui varie d'une ligne à l'autre. C'est l'hypothèse à vérifier, pas à
--  affirmer — ces mesures sont là pour trancher.
--
--  ── COMMENT LIRE UN ÉCHEC ─────────────────────────────────────────────────
--
--  Un budget dépassé ne dit pas « c'est lent ». Il dit : à ce volume, sur cette
--  machine, cette requête a coûté plus que le seuil qu'on s'est donné. Le seuil
--  est un CHOIX, écrit ici, révisable — pas une mesure de la réalité.
--
--  [HYPOTHÈSE — produit] Les seuils visent une page qui se charge sans qu'on
--  attende : 150 ms pour une lecture d'écran, 400 ms pour un écran qui agrège.
--  Ils sont généreux pour une base locale et doivent le rester : une machine
--  d'intégration plus lente ne doit pas faire échouer le contrôle pour rien.
--  C'est l'ORDRE DE GRANDEUR qui est surveillé, et surtout sa dérive.
-- ============================================================================

\set ON_ERROR_STOP on

create schema if not exists budget;

create table if not exists budget.mesures (
  nom text primary key,
  lignes bigint,
  ms numeric,
  plafond_ms numeric
);
truncate budget.mesures;

/**
 * Exécute une requête plusieurs fois et retient la MÉDIANE.
 *
 * La médiane, pas la moyenne : un ramasse-miettes ou un point d'arrêt du noyau
 * pendant une exécution décale la moyenne et ferait échouer un contrôle sain.
 * Le premier passage est écarté — il paie le remplissage des caches, que la
 * production a déjà payé depuis longtemps.
 */
create or replace function budget.mesure(
  p_nom text, p_sql text, p_plafond_ms numeric, p_repetitions integer default 5
) returns void
language plpgsql as $$
declare
  t0 timestamptz;
  v_ms numeric[] := '{}';
  v_lignes bigint;
  i integer;
begin
  for i in 0..p_repetitions loop
    t0 := clock_timestamp();
    execute 'select count(*) from (' || p_sql || ') s' into v_lignes;
    if i > 0 then
      v_ms := v_ms || extract(epoch from clock_timestamp() - t0) * 1000;
    end if;
  end loop;

  insert into budget.mesures (nom, lignes, ms, plafond_ms)
  values (p_nom, v_lignes,
          round((select percentile_cont(0.5) within group (order by x)
                   from unnest(v_ms) x)::numeric, 1),
          p_plafond_ms);
end;
$$;

-- ---------------------------------------------------------------------------
--  On se met dans la peau de la titulaire du cabinet volumineux.
-- ---------------------------------------------------------------------------
select tests.authenticate_as('c0000000-0000-4000-8000-000000000001'::uuid);

do $$
declare
  v_cab uuid := 'c1111111-1111-4111-8111-111111111111';
  v_patient uuid;
begin
  select id into v_patient from public.patients
   where practice_id = v_cab and status = 'actif' limit 1;

  -- 1. LA LISTE DES DOSSIERS, première page. Pagination serveur.
  perform budget.mesure('dossiers · première page', format($q$
    select id, first_name, last_name, preferred_name, birth_date, status
      from public.patients
     where practice_id = %L and status = 'actif'
     order by last_name, first_name
     limit 25$q$, v_cab), 150);

  -- 2. LA RECHERCHE PAR NOM. C'est le geste le plus fréquent du produit.
  perform budget.mesure('dossiers · recherche par nom', format($q$
    select id, first_name, last_name
      from public.patients
     where practice_id = %L
       and (first_name ilike '%%fictif37%%' or last_name ilike '%%fictif37%%')
     order by last_name limit 25$q$, v_cab), 150);

  -- 3. L'ACCUEIL : les rendez-vous du jour.
  perform budget.mesure('accueil · journée', format($q$
    select a.id, a.starts_at, a.kind, a.attendance,
           p.first_name, p.last_name
      from public.appointments a
      left join public.patients p on p.id = a.patient_id
     where a.practice_id = %L
       and a.starts_at >= date_trunc('day', now())
       and a.starts_at < date_trunc('day', now()) + interval '1 day'
     order by a.starts_at$q$, v_cab), 150);

  -- 4. L'ACCUEIL : les rendez-vous passés à renseigner. C'est le blocage
  --    silencieux du produit — il doit se voir vite.
  perform budget.mesure('accueil · à qualifier', format($q$
    select a.id, a.starts_at, p.first_name, p.last_name
      from public.appointments a
      left join public.patients p on p.id = a.patient_id
     where a.practice_id = %L
       and a.starts_at < now()
       and a.attendance = 'prevu'
     order by a.starts_at desc limit 10$q$, v_cab), 150);

  -- 5. LA COMPTABILITÉ, telle que l'écran la charge AUJOURD'HUI : toutes les
  --    pièces de la période, plafond à 2000, plus les sommes imputées.
  perform budget.mesure('comptabilité · liste complète', format($q$
    select d.id, d.kind, d.number, d.issued_on, d.status, d.total_cents,
           d.snapshot -> 'patient' ->> 'nom' as nom_fige,
           p.first_name, p.last_name
      from public.billing_documents d
      left join public.patients p on p.id = d.patient_id
     where d.practice_id = %L and d.status <> 'brouillon'
     order by d.issued_on desc nulls first, d.created_at desc
     limit 2001$q$, v_cab), 400);

  perform budget.mesure('comptabilité · sommes imputées', format($q$
    select a.document_id, sum(a.amount_cents)
      from public.payment_allocations a
      join public.billing_documents d on d.id = a.document_id
     where d.practice_id = %L
     group by a.document_id$q$, v_cab), 400);

  -- 6. LA FICHE D'UN DOSSIER : ses pièces et ses séances.
  perform budget.mesure('dossier · séances', format($q$
    select id, starts_at, kind, attendance
      from public.appointments
     where practice_id = %L and patient_id = %L
     order by starts_at desc limit 50$q$, v_cab, v_patient), 150);

  -- 7. LE COMPTEUR DE SÉANCES d'un dossier.
  perform budget.mesure('dossier · compteur de séances', format($q$
    select count(*) from public.appointments
     where practice_id = %L and patient_id = %L and attendance = 'honore'$q$,
    v_cab, v_patient), 150);
end
$$;

-- ---------------------------------------------------------------------------
--  Le verdict
-- ---------------------------------------------------------------------------
reset role;
\pset border 2
select nom,
       lignes,
       ms || ' ms' as mediane,
       plafond_ms || ' ms' as plafond,
       case when ms > plafond_ms then 'DÉPASSE' else 'ok' end as verdict
  from budget.mesures order by ms desc;

do $$
declare
  v_hors integer;
  m record;
begin
  select count(*) into v_hors from budget.mesures where ms > plafond_ms;
  if v_hors > 0 then
    for m in select * from budget.mesures where ms > plafond_ms order by ms desc
    loop
      raise warning 'BUDGET DÉPASSÉ — % : % ms pour un plafond de % ms (% lignes)',
        m.nom, m.ms, m.plafond_ms, m.lignes;
    end loop;
    raise exception '% requête(s) hors budget.', v_hors;
  end if;
end
$$;
