-- ============================================================================
--  0011 — REPRISE DES FACTURES v1
-- ============================================================================
--  N'a d'effet que si la table `invoices` de la v1 existe et porte des lignes.
--  Sur une base neuve, ne fait rien.
--
--  CE QU'ELLE FAIT
--   1. Chaque facture v1 devient une pièce ÉMISE, avec son numéro, sa date et
--      sa période de rattachement.
--   2. Les prestations deviennent des lignes, montants convertis en CENTIMES.
--      Une facture multi-lignes de la v1 (colonne `lines`) donne autant de
--      lignes ; une facture d'avant cette évolution en donne une seule.
--   3. Le montant encaissé devient un règlement affecté à la pièce. C'est ce
--      qui fait apparaître un SOLDE là où la v1 ne portait qu'un total payé.
--   4. Rétrocession et URSSAF sont figées dans l'instantané, avec la mention de
--      leur origine : ce sont des ESTIMATIONS dérivées, pas du contenu de
--      facture. Les perdre serait perdre une information ; les traiter comme
--      des lignes serait mentir sur ce qu'elles sont.
--   5. La case « PCO » devient un mode de financement, et non plus une mention
--      imprimée sur un document remis à la famille.
--   6. Les pièces reprises entrent dans LA SÉRIE QUE LE MOTEUR UTILISERA
--      ensuite (`FACTURE-AAAA`), et le compteur est amorcé à partir du compteur
--      de la v1. Sans cela, la première facture émise après la bascule
--      repartirait à 001 et porterait un numéro déjà employé.
--
--  CE QU'ELLE NE FAIT PAS
--   · Elle ne renomme ni ne supprime `invoices`. La consultation publique d'une
--     facture par son jeton s'appuie encore dessus, et ce mécanisme sera refait
--     au lot des transmissions — avec un jeton haché et révocable, ce que la v1
--     n'a pas. Ajouter dès maintenant un jeton en clair sur les nouvelles
--     pièces réinstallerait un défaut connu. Les deux tables coexistent donc :
--     `invoices` pour les liens déjà envoyés, `billing_documents` pour le reste.
--   · Elle ne devine aucun payeur. La v1 adressait toujours au patient ; en
--     déduire un tiers payeur serait une invention.
--   · Elle ne rattache aucune ligne à un rendez-vous : la v1 n'avait pas
--     d'agenda, et fabriquer des séances pour justifier une facture ancienne
--     produirait un historique faux.
-- ============================================================================

-- ============================================================================
--  A. RÉGLAGES ET CATALOGUE
-- ============================================================================
--  À faire AVANT les factures : une ligne de facture v1 porte l'identifiant de
--  l'entrée de catalogue dont elle est issue, et cette provenance ne se
--  retrouve qu'à condition que le catalogue existe déjà — avec les mêmes
--  identifiants.
--
--  LE GABARIT DE NUMÉROTATION EST LE POINT CRITIQUE. Il vit en v1 dans
--  `settings.profile.invoice_number_format`. Ne pas le reprendre changerait
--  silencieusement la FORME des numéros au lendemain de la bascule — « F2026-008 »
--  devenant « 2026-008 » — c'est-à-dire une rupture de la suite, sur le seul
--  élément d'une facture dont la continuité est exigible.
--  [SOURCE] CGI, annexe II, art. 242 nonies A, I, 7° (numérotation continue).
do $$
declare
  v_s record;
  v_practice uuid;
  v_item jsonb;
  v_pos integer;
begin
  if to_regclass('public.settings') is null then
    return;
  end if;
  if exists (
    select 1 from public.practice_settings
     where settings ->> 'origine' = 'reprise_v1'
  ) then
    return;
  end if;

  for v_s in select * from public.settings
  loop
    select m.practice_id into v_practice
      from public.practice_members m
     where m.user_id = v_s.user_id and m.status = 'active'
     limit 1;
    if v_practice is null then
      continue;
    end if;

    /* Les taux passent en POINTS DE BASE, entiers : 0,232 devient 2320. Un taux
     * stocké en flottant se relit à la décimale près et fait diverger deux
     * calculs qui devraient donner le même montant. Ce sont des paramètres
     * d'ESTIMATION — ils n'apparaissent sur aucune facture. */
    insert into public.practice_settings (practice_id, settings)
    values (v_practice, jsonb_build_object(
      'origine', 'reprise_v1',
      'gabarit_numero', coalesce(
        nullif(btrim(coalesce(v_s.profile ->> 'invoice_number_format', '')), ''),
        '{AAAA}-{NNN}'),
      'retrocession_points_de_base', round(coalesce(v_s.retrocession_rate, 0) * 10000)::integer,
      'urssaf_points_de_base', round(coalesce(v_s.urssaf_rate, 0) * 10000)::integer,
      'mode_de_charge', coalesce(v_s.charge_mode, 'retrocession'),
      'loyer_mensuel_centimes', round(coalesce(v_s.monthly_rent, 0) * 100)::bigint));

    -- Le catalogue, EN CONSERVANT LES IDENTIFIANTS : c'est ce qui permet aux
    -- lignes des factures reprises de retrouver leur provenance.
    v_pos := 0;
    for v_item in
      select value from jsonb_array_elements(
        case when jsonb_typeof(v_s.profile -> 'service_catalog') = 'array'
             then v_s.profile -> 'service_catalog' else '[]'::jsonb end)
    loop
      v_pos := v_pos + 1;
      insert into public.service_catalog_items
        (id, practice_id, label, unit_price_cents, pricing,
         default_intro, default_date_render, active, position)
      values (
        coalesce((v_item ->> 'id')::uuid, gen_random_uuid()),
        v_practice,
        coalesce(nullif(btrim(coalesce(v_item ->> 'label', '')), ''),
                 'Prestation sans libellé (reprise de la v1)'),
        round(coalesce((v_item ->> 'unit_price')::numeric, 0) * 100)::bigint,
        case when v_item ->> 'pricing' = 'unitaire' then 'unitaire' else 'forfait' end,
        nullif(btrim(coalesce(v_item ->> 'intro', '')), ''),
        case when v_item ->> 'default_date_render' = 'par_date'
             then 'par_date' else 'liste' end,
        coalesce((v_item ->> 'active')::boolean, true),
        v_pos)
      on conflict (id) do nothing;
    end loop;
  end loop;
end
$$;

-- ============================================================================
--  B. FACTURES
-- ============================================================================

do $$
declare
  f record;
  l jsonb;
  v_practice uuid;
  v_doc uuid;
  v_paiement uuid;
  v_patient uuid;
  v_lignes jsonb;
  v_serie text;
  v_numero text;
  v_numero_v1 text;
  v_doublon integer;
  v_mois integer;
  v_debut date;
  v_emission date;
  v_montant bigint;
  v_encaisse bigint;
  v_affecte bigint;
  v_pos integer;
  v_repris integer := 0;
  v_c record;
begin
  if to_regclass('public.invoices') is null then
    raise notice '0011 : aucune facture v1 à reprendre.';
    return;
  end if;

  -- Idempotence. Une reprise rejouée doublerait la comptabilité ; la marque
  -- portée par l'instantané suffit à s'en apercevoir.
  if exists (
    select 1 from public.billing_documents
     where snapshot ->> 'origine' = 'reprise_v1'
  ) then
    raise notice '0011 : les factures v1 ont déjà été reprises.';
    return;
  end if;

  for f in select * from public.invoices
            order by coalesce(issue_date, created_at::date), created_at, id
  loop
    -- Le cabinet du compte propriétaire. Une facture dont le compte n'a pas de
    -- cabinet reste en v1 : l'attribuer au hasard serait pire que l'attendre.
    select m.practice_id into v_practice
      from public.practice_members m
     where m.user_id = f.user_id and m.status = 'active'
     limit 1;
    if v_practice is null then
      continue;
    end if;

    -- Le patient n'est rattaché que s'il appartient BIEN à ce cabinet. La v1
    -- permettait à une facture de pointer le patient d'un autre compte ; ici,
    -- le lien est alors coupé et le nom conservé dans l'instantané, ce qui
    -- rend l'anomalie visible au lieu de la propager.
    v_patient := null;
    if f.patient_id is not null then
      select p.id into v_patient from public.patients p
       where p.id = f.patient_id and p.practice_id = v_practice;
    end if;

    v_emission := coalesce(f.issue_date, f.created_at::date);

    -- Période de rattachement, reconstituée du mois et de l'année v1.
    v_mois := case lower(btrim(coalesce(f.billing_month, '')))
      when 'janvier' then 1
      when 'février' then 2  when 'fevrier' then 2
      when 'mars' then 3     when 'avril' then 4    when 'mai' then 5
      when 'juin' then 6     when 'juillet' then 7
      when 'août' then 8     when 'aout' then 8
      when 'septembre' then 9 when 'octobre' then 10 when 'novembre' then 11
      when 'décembre' then 12 when 'decembre' then 12
      else null end;

    v_debut := case
      when f.billing_year is not null and v_mois is not null
        then make_date(f.billing_year, v_mois, 1)
      when f.billing_year is not null
        then make_date(f.billing_year, 1, 1)
      else null
    end;

    -- Euros vers centimes. `numeric` est exact, la conversion l'est donc aussi.
    v_montant := round(coalesce(f.revenue_gross, 0) * 100)::bigint;
    v_encaisse := round(coalesce(f.revenue_gross_paid, 0) * 100)::bigint;

    v_serie := 'FACTURE-' || to_char(v_emission, 'YYYY');

    -- Le numéro. Absent, il est remplacé par une mention explicite : un trou
    -- doit se voir, pas se combler d'une valeur inventée.
    v_numero_v1 := nullif(btrim(coalesce(f.invoice_number, '')), '');
    v_numero := coalesce(v_numero_v1, 'SANS-NUMERO-' || left(f.id::text, 8));

    -- La v1 n'imposait aucune unicité : deux factures pouvaient porter le même
    -- numéro. La cible l'interdit. Plutôt que de renuméroter en silence — ce
    -- qui effacerait la trace du défaut — le doublon est suffixé et signalé.
    v_doublon := 1;
    while exists (
      select 1 from public.billing_documents
       where practice_id = v_practice and number = v_numero
    ) loop
      v_doublon := v_doublon + 1;
      v_numero := coalesce(v_numero_v1, 'SANS-NUMERO-' || left(f.id::text, 8))
                  || '-D' || v_doublon;
    end loop;

    /* La pièce naît BROUILLON, puis s'émet. Ce n'est pas un détour : les
     * lignes d'une pièce émise sont immuables — c'est la garantie même du
     * moteur — et l'insérer directement en « émis » serait refusé par le
     * déclencheur. La reprise passe par la même porte que tout le monde. */
    insert into public.billing_documents
      (practice_id, kind, patient_id, payer_is_patient, funding_scheme,
       status, period_start, period_end, note, internal_note, created_at)
    values (
      v_practice, 'facture', v_patient, true,
      case when f.has_pco then 'pco' else 'liberal' end,
      'brouillon', v_debut,
      case when v_debut is not null
           then (v_debut + interval '1 month - 1 day')::date end,
      null,
      nullif(btrim(coalesce(f.notes, '')), ''),
      f.created_at
    )
    returning id into v_doc;

    -- ------------------------------------------------------------- lignes
    -- `to_jsonb(f) -> 'lines'` plutôt que `f.lines` : la colonne n'existe que
    -- sur les bases ayant reçu la migration v1 013. Cette écriture rend null
    -- quand elle manque, au lieu d'échouer à la compilation du bloc.
    v_lignes := coalesce(to_jsonb(f) -> 'lines', '[]'::jsonb);
    if jsonb_typeof(v_lignes) <> 'array' then
      v_lignes := '[]'::jsonb;
    end if;

    if jsonb_array_length(v_lignes) > 0 then
      v_pos := 0;
      for l in select value from jsonb_array_elements(v_lignes)
      loop
        v_pos := v_pos + 1;
        insert into public.billing_lines
          (practice_id, document_id, position, catalog_item_id, label, pricing,
           unit_price_cents, quantity, amount_cents,
           service_dates, date_render, intro, note)
        values (
          v_practice, v_doc, v_pos,
          -- Provenance seule : jamais imprimée, elle ne participe à aucun
          -- montant. Null si l'entrée a disparu du catalogue depuis.
          (select c.id from public.service_catalog_items c
            where c.id = nullif(l ->> 'catalog_id', '')::uuid
              and c.practice_id = v_practice),
          coalesce(nullif(btrim(coalesce(l ->> 'label', '')), ''),
                   'Prestation non détaillée (reprise de la v1)'),
          case when l ->> 'pricing' = 'unitaire' then 'unitaire' else 'forfait' end,
          round(coalesce((l ->> 'unit_price')::numeric, 0) * 100)::bigint,
          -- Au forfait, la quantité vaut toujours 1 : la contrainte de la
          -- cible l'exige, et la v1 l'imposait déjà à la saisie.
          case when l ->> 'pricing' = 'unitaire'
               then greatest(1, coalesce((l ->> 'quantity')::integer, 1))
               else 1 end,
          round(coalesce((l ->> 'amount')::numeric, 0) * 100)::bigint,
          coalesce((
            select array_agg(d::date order by d)
              from jsonb_array_elements_text(
                     case when jsonb_typeof(l -> 'dates') = 'array'
                          then l -> 'dates' else '[]'::jsonb end) as d
             where d ~ '^\d{4}-\d{2}-\d{2}$'), '{}'::date[]),
          case when l ->> 'date_render' = 'par_date' then 'par_date' else 'liste' end,
          nullif(btrim(coalesce(l ->> 'intro', '')), ''),
          nullif(btrim(coalesce(l ->> 'note', '')), '')
        );
      end loop;
    else
      -- Facture d'avant les lignes multiples : une prestation, un montant.
      insert into public.billing_lines
        (practice_id, document_id, position, label,
         unit_price_cents, quantity, amount_cents)
      values (
        v_practice, v_doc, 1,
        coalesce(nullif(btrim(coalesce(f.service_label, '')), ''),
                 'Prestation non détaillée (reprise de la v1)'),
        v_montant, 1, v_montant
      );
    end if;

    -- Le total est recalculé par déclencheur à partir des lignes. S'il s'écarte
    -- du brut de la v1, c'est la v1 qui était incohérente : on le consigne au
    -- lieu de forcer l'un ou l'autre.
    select total_cents into v_montant from public.billing_documents where id = v_doc;

    -- ------------------------------------------------------------ émission
    update public.billing_documents
       set status = 'emis',
           series = v_serie,
           number = v_numero,
           issued_on = v_emission,
           snapshot = jsonb_build_object(
             'origine', 'reprise_v1',
             'emis_le', v_emission,
             'patient', jsonb_build_object('nom', f.patient_name),
             'numero_v1', v_numero_v1,
             'facture_v1', f.id,
             -- Estimations DÉRIVÉES par la v1, conservées telles quelles. Ce ne
             -- sont ni des lignes de facture, ni des montants dus par le patient.
             'estimations_v1', jsonb_build_object(
               'retrocession_centimes', round(coalesce(f.retrocession_amount, 0) * 100)::bigint,
               'urssaf_centimes', round(coalesce(f.urssaf_amount, 0) * 100)::bigint,
               'note', 'Estimations calculées par la version précédente. Ni contenu de facture, ni montant dû.'),
             'periode_v1', jsonb_build_object(
               'mois', f.billing_month, 'annee', f.billing_year),
             'pco_v1', f.has_pco,
             'brut_v1_centimes', round(coalesce(f.revenue_gross, 0) * 100)::bigint)
     where id = v_doc;

    if v_numero <> coalesce(v_numero_v1, v_numero) then
      update public.billing_documents
         set internal_note = btrim(coalesce(internal_note, '') ||
               E'\nNuméro « ' || v_numero_v1 ||
               ' » déjà porté par une autre facture de la v1 : suffixé à la reprise.')
       where id = v_doc;
    end if;

    -- ------------------------------------------------------------ règlement
    -- L'encaissé devient un règlement affecté. Un encaissement supérieur au
    -- montant de la pièce laisse la part excédentaire NON AFFECTÉE : c'est un
    -- trop-perçu, et il doit se voir comme tel.
    if v_encaisse > 0 then
      insert into public.payments
        (practice_id, received_on, amount_cents, method, note)
      values (
        v_practice,
        coalesce(f.payment_date, v_emission),
        v_encaisse,
        case lower(btrim(coalesce(f.payment_method, '')))
          when 'virement' then 'virement'
          when 'chèque' then 'cheque'    when 'cheque' then 'cheque'
          when 'espèces' then 'especes'  when 'especes' then 'especes'
          when 'carte' then 'carte'      when 'carte bancaire' then 'carte'
          when 'cb' then 'carte'
          when 'prélèvement' then 'prelevement' when 'prelevement' then 'prelevement'
          when 'pco' then 'tiers_payant'
          else 'autre' end,
        'Règlement repris de la version précédente.'
      )
      returning id into v_paiement;

      v_affecte := least(v_encaisse, greatest(v_montant, 0));
      if v_affecte > 0 then
        insert into public.payment_allocations
          (practice_id, payment_id, document_id, amount_cents)
        values (v_practice, v_paiement, v_doc, v_affecte);
      end if;
    end if;

    v_repris := v_repris + 1;
  end loop;

  -- ==========================================================================
  --  AMORÇAGE DES COMPTEURS
  -- ==========================================================================
  --  Sans cela, la première facture émise après la bascule repartirait au rang
  --  1 et porterait un numéro déjà employé. Le moteur refuserait le doublon et
  --  chercherait le rang suivant — donc rien ne serait faux, mais la série
  --  imprimée présenterait un décrochage inexpliqué.
  --
  --  La source est le compteur de la v1 lui-même, et non une relecture des
  --  numéros : lui seul connaît le dernier rang ATTRIBUÉ, y compris celui d'une
  --  facture supprimée depuis. C'est toute la raison de son existence.
  --
  --  Une portée v1 porte l'année quand le modèle de numéro contient un jeton
  --  d'année ; sinon la numérotation était continue, et son rang s'applique
  --  alors à toutes les séries annuelles du cabinet.
  if to_regclass('public.invoice_counters') is not null then
    for v_c in
      select d.practice_id,
             d.series,
             right(d.series, 4) as annee
        from public.billing_documents d
       where d.snapshot ->> 'origine' = 'reprise_v1'
       group by d.practice_id, d.series
    loop
      insert into public.billing_counters (practice_id, series, last_value)
      select v_c.practice_id, v_c.series, coalesce(max(ic.last_seq), 0)
        from public.invoice_counters ic
        join public.practice_members m
          on m.user_id = ic.user_id and m.practice_id = v_c.practice_id
       where ic.scope like '%' || v_c.annee || '%'
          or ic.scope !~ '(19|20)[0-9]{2}'
      having coalesce(max(ic.last_seq), 0) > 0
      on conflict (practice_id, series) do update
        set last_value = greatest(public.billing_counters.last_value,
                                  excluded.last_value);
    end loop;
  end if;

  -- --------------------------------------------------------------- journal
  insert into public.audit_events
    (practice_id, actor_user_id, action, subject_type, subject_id, metadata)
  select d.practice_id, null, 'billing.migrate_v1', 'practice', d.practice_id,
         jsonb_build_object('origine', 'reprise v1', 'pieces', count(*))
    from public.billing_documents d
   where d.snapshot ->> 'origine' = 'reprise_v1'
   group by d.practice_id;

  raise notice '0011 : % facture(s) v1 reprise(s).', v_repris;
end
$$;
