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
--  ── CE QUE LA MESURE A CONCLU, ET CE QU'ELLE N'A DONC PAS FAIT FAIRE ──────
--
--  Le lot 8 prévoyait « index composites, projections SQL minimales,
--  suppression des N+1 ». Une fois l'appartenance calculée une seule fois
--  (migration 0019), plus rien ne dépasse LA MILLISECONDE — y compris à
--  2 000 dossiers et 28 000 rendez-vous, soit environ cinq fois ce qu'un
--  cabinet libéral accumule.
--
--  Aucun index n'a donc été ajouté. Un index qu'aucune mesure ne réclame coûte
--  à chaque écriture, occupe de la place, et donne l'illusion d'un travail
--  fait. Le jour où une mesure d'ici dépassera son plafond, elle dira LEQUEL
--  ajouter, et pourquoi.
--
--  ── COMMENT LIRE UN ÉCHEC ─────────────────────────────────────────────────
--
--  Un budget dépassé ne dit pas « c'est lent ». Il dit : à ce volume, sur cette
--  machine, cette requête a coûté plus que le seuil qu'on s'est donné. Le seuil
--  est un CHOIX, écrit ici, révisable — pas une mesure de la réalité.
--
--  [HYPOTHÈSE — produit] Les seuils visent une page qui se charge sans qu'on
--  attende. Ils ont été RESSERRÉS après coup, et la raison mérite d'être dite :
--  fixés d'abord à 150 ms, ils étaient tenus aussi bien AVANT qu'APRÈS la
--  correction des politiques de lecture — 13,6 ms comme 0,3 ms passent sous
--  150 ms. Un budget qui ne distingue pas l'état corrigé de l'état défectueux
--  ne garde rien.
--
--  Ils valent donc aujourd'hui 40 ms pour une lecture d'écran et 100 ms pour un
--  écran qui agrège : environ dix fois la mesure observée en local, ce qui
--  laisse à une machine d'intégration lente toute la marge nécessaire, tout en
--  faisant échouer un retour à l'évaluation par ligne. C'est l'ORDRE DE
--  GRANDEUR qui est surveillé, et surtout sa dérive.
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
 *
 * ── ELLE REFUSE DE MESURER HORS RLS, ET C'EST LE CŒUR DU FICHIER ──────────
 *
 * La première version de ce harnais a rendu des chiffres magnifiques : toutes
 * les requêtes sous 0,3 ms. Ils étaient faux. `tests.authenticate_as` pose
 * `set local role`, qui ne vaut QUE pour la transaction en cours — et ce
 * fichier n'en ouvrait aucune. Chaque instruction formait sa propre
 * transaction, le rôle retombait sur le propriétaire de la base, lequel
 * contourne la RLS. Je mesurais un produit que personne n'utilise.
 *
 * Le garde-fou ci-dessous rend cette erreur impossible à répéter en silence :
 * mesurer hors du rôle `authenticated` échoue, bruyamment.
 */
create or replace function budget.mesure(
  p_nom text, p_sql text, p_plafond_ms numeric,
  p_lignes_attendues bigint, p_repetitions integer default 5
) returns jsonb
language plpgsql as $$
declare
  t0 timestamptz;
  v_ms numeric[] := '{}';
  v_lignes bigint;
  i integer;
begin
  if p_lignes_attendues < 1 then
    raise exception 'Une mesure doit annoncer combien de lignes elle attend.'
      using errcode = 'internal_error';
  end if;
  if current_user <> 'authenticated' then
    raise exception
      'Mesure tentée en tant que « % » : ces chiffres ne vaudraient rien. Les budgets se mesurent à travers la RLS, sous le rôle `authenticated`.',
      current_user using errcode = 'internal_error';
  end if;

  for i in 0..p_repetitions loop
    t0 := clock_timestamp();
    execute 'select count(*) from (' || p_sql || ') s' into v_lignes;
    if i > 0 then
      v_ms := v_ms || extract(epoch from clock_timestamp() - t0) * 1000;
    end if;
  end loop;

  /* UNE MESURE SUR ZÉRO LIGNE NE MESURE RIEN.
   *
   * Deux budgets de ce fichier sont restés « tenus » alors que leurs requêtes
   * ne ramenaient aucune ligne : le jeu volumineux ne produisait que du passé,
   * et l'accueil n'avait ni journée ni rendez-vous à renseigner. Un plafond
   * respecté sur un ensemble vide rassure sans rien garantir — c'est la même
   * faute que celle d'un contrôle qui valide sa propre mise en scène.
   *
   * Chaque mesure annonce donc combien de lignes elle attend au minimum, et
   * échoue si le jeu ne les lui donne pas. */
  if v_lignes < p_lignes_attendues then
    raise exception
      'Mesure « % » : % ligne(s) ramenée(s) pour au moins % attendue(s). Le jeu volumineux ne couvre pas ce cas — la mesure ne prouve rien.',
      p_nom, v_lignes, p_lignes_attendues using errcode = 'internal_error';
  end if;

  return jsonb_build_object(
    'nom', p_nom,
    'lignes', v_lignes,
    'ms', round((select percentile_cont(0.5) within group (order by x)
                   from unnest(v_ms) x)::numeric, 1),
    'plafond_ms', p_plafond_ms);
end;
$$;

/* Le rôle `authenticated` doit pouvoir APPELER la mesure — mais pas écrire la
 * table des résultats, qui reste au propriétaire. Ces droits n'existent que
 * dans la base jetable des budgets : rien ici ne s'applique ailleurs. */
grant usage on schema budget to authenticated;
grant execute on function budget.mesure(text, text, numeric, bigint, integer) to authenticated;

-- ---------------------------------------------------------------------------
--  On se met dans la peau de la titulaire du cabinet volumineux.
-- ---------------------------------------------------------------------------
--  UNE SEULE TRANSACTION, et c'est indispensable : `set local role` ne survit
--  pas au-delà. Les résultats sont accumulés en mémoire puis écrits une fois
--  le rôle rendu — `authenticated` n'a évidemment aucun droit sur la table de
--  mesures, et ne doit pas en avoir.
begin;

do $$
declare
  v_cab uuid := 'c1111111-1111-4111-8111-111111111111';
  v_patient uuid;
  v_r jsonb := '[]'::jsonb;
begin
  select id into v_patient from public.patients
   where practice_id = v_cab and status = 'actif' limit 1;

  perform tests.authenticate_as('c0000000-0000-4000-8000-000000000001'::uuid);

  -- 1. LA LISTE DES DOSSIERS, première page. Pagination serveur.
  v_r := v_r || budget.mesure('dossiers · première page', format($q$
    select id, first_name, last_name, preferred_name, birth_date, status
      from public.patients
     where practice_id = %L and status = 'actif'
     order by last_name, first_name
     limit 25$q$, v_cab), 40, 25);

  -- 2. LA RECHERCHE PAR NOM. C'est le geste le plus fréquent du produit.
  v_r := v_r || budget.mesure('dossiers · recherche par nom', format($q$
    select id, first_name, last_name
      from public.patients
     where practice_id = %L
       and (first_name ilike '%%fictif37%%' or last_name ilike '%%fictif37%%')
     order by last_name limit 25$q$, v_cab), 40, 1);

  -- 3. L'ACCUEIL : les rendez-vous du jour.
  v_r := v_r || budget.mesure('accueil · journée', format($q$
    select a.id, a.starts_at, a.kind, a.attendance,
           p.first_name, p.last_name
      from public.appointments a
      left join public.patients p on p.id = a.patient_id
     where a.practice_id = %L
       and a.starts_at >= date_trunc('day', now())
       and a.starts_at < date_trunc('day', now()) + interval '1 day'
     order by a.starts_at$q$, v_cab), 40, 1);

  -- 4. L'ACCUEIL : les rendez-vous passés à renseigner. C'est le blocage
  --    silencieux du produit — il doit se voir vite.
  v_r := v_r || budget.mesure('accueil · à qualifier', format($q$
    select a.id, a.starts_at, p.first_name, p.last_name
      from public.appointments a
      left join public.patients p on p.id = a.patient_id
     where a.practice_id = %L
       and a.starts_at < now()
       and a.attendance = 'a_venir'
     order by a.starts_at desc limit 10$q$, v_cab), 40, 5);

  -- 5. LA COMPTABILITÉ, telle que l'écran la charge AUJOURD'HUI : toutes les
  --    pièces de la période, plafond à 2000, plus les sommes imputées.
  v_r := v_r || budget.mesure('comptabilité · liste complète', format($q$
    select d.id, d.kind, d.number, d.issued_on, d.status, d.total_cents,
           d.snapshot -> 'patient' ->> 'nom' as nom_fige,
           p.first_name, p.last_name
      from public.billing_documents d
      left join public.patients p on p.id = d.patient_id
     where d.practice_id = %L and d.status <> 'brouillon'
     order by d.issued_on desc nulls first, d.created_at desc
     limit 2001$q$, v_cab), 100, 100);

  v_r := v_r || budget.mesure('comptabilité · sommes imputées', format($q$
    select a.document_id, sum(a.amount_cents)
      from public.payment_allocations a
      join public.billing_documents d on d.id = a.document_id
     where d.practice_id = %L
     group by a.document_id$q$, v_cab), 100, 50);

  -- 6. LA FICHE D'UN DOSSIER : ses pièces et ses séances.
  v_r := v_r || budget.mesure('dossier · séances', format($q$
    select id, starts_at, kind, attendance
      from public.appointments
     where practice_id = %L and patient_id = %L
     order by starts_at desc limit 50$q$, v_cab, v_patient), 40, 4);

  -- 7. LE COMPTEUR DE SÉANCES d'un dossier.
  v_r := v_r || budget.mesure('dossier · compteur de séances', format($q$
    select count(*) from public.appointments
     where practice_id = %L and patient_id = %L and attendance = 'honore'$q$,
    v_cab, v_patient), 40, 1);
  execute 'reset role';
  insert into budget.mesures (nom, lignes, ms, plafond_ms)
  select m ->> 'nom', (m ->> 'lignes')::bigint,
         (m ->> 'ms')::numeric, (m ->> 'plafond_ms')::numeric
    from jsonb_array_elements(v_r) m;
end
$$;
commit;

-- ===========================================================================
--  LA FORME DU PLAN, QUI EST LA VRAIE GARANTIE
-- ===========================================================================
--  Un seuil en millisecondes ne garde pas ce qu'on croit. Vérifié : en
--  rétablissant l'évaluation par ligne, la liste des dossiers repasse de 0,3 ms
--  à 14,4 ms — et franchit allègrement un plafond de 40 ms comme de 150 ms. Le
--  chiffre bouge d'un facteur cinquante sans qu'aucun budget ne bronche.
--
--  C'est que la propriété à tenir n'est pas une durée : c'est une FORME. La
--  question « quels cabinets sont les miens ? » ne dépend d'aucune ligne, elle
--  doit donc être posée une fois. Cela se lit dans le plan d'exécution, et ne
--  dépend ni de la machine, ni de la charge, ni du volume — là où une durée
--  dépend des trois.
--
--  Deux exigences, donc, sur le plan de lecture :
--   · aucun appel d'appartenance dans un filtre par ligne ;
--   · un sous-plan haché, évalué une seule fois.
begin;
select tests.authenticate_as('c0000000-0000-4000-8000-000000000001'::uuid);
create temporary table plan_lecture (l text) on commit drop;

do $$
declare
  r record;
  v_plan text;
begin
  for r in execute 'explain (analyze, costs off)
    select id, first_name, last_name from public.patients
     where practice_id = ''c1111111-1111-4111-8111-111111111111''
       and status = ''actif''
     order by last_name, first_name limit 25'
  loop
    insert into plan_lecture values (r."QUERY PLAN");
  end loop;

  select string_agg(l, E'\n') into v_plan from plan_lecture;
  execute 'reset role';

  if v_plan ~ 'Filter:.*(is_member|can_write|can_read_clinical|has_role)' then
    raise exception
      E'L''appartenance est de nouveau évaluée LIGNE PAR LIGNE sur la lecture des dossiers.\nPlan obtenu :\n%',
      v_plan using errcode = 'internal_error';
  end if;

  if v_plan !~ 'hashed SubPlan' then
    raise exception
      E'Le plan de lecture ne porte plus de sous-plan haché : l''appartenance n''est plus calculée une seule fois.\nPlan obtenu :\n%',
      v_plan using errcode = 'internal_error';
  end if;

  raise notice 'Forme du plan : appartenance calculée une fois, aucun filtre par ligne.';
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  Le verdict
-- ---------------------------------------------------------------------------
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
