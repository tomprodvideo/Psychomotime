-- ============================================================================
--  160 — LE JOUR ET LE FUSEAU DU CABINET, PARTOUT OÙ LA BASE DATE (`0027`)
-- ============================================================================
--  Deux horloges peuvent diverger : celle de la SESSION de la base — UTC en
--  production — et celle du CABINET, `practices.timezone`. Ces contrôles les
--  rendent différentes À COUP SÛR, à n'importe quelle heure d'exécution :
--
--   · CABINET EN AVANCE : cabinet à UTC+14 (`Pacific/Kiritimati`), session à
--     UTC−12 (`Etc/GMT+12`). Vingt-six heures les séparent : le jour du cabinet
--     est TOUJOURS postérieur à `current_date`, d'un ou deux jours ;
--   · CABINET EN RETARD : l'inverse, et le jour du cabinet est toujours
--     antérieur.
--
--  Le premier cas prouve qu'une date juste n'est plus refusée ni remplacée par
--  la veille ; le second, qu'une date future AU CABINET reste refusée. Une
--  fonction qui lirait encore `current_date` échoue à l'un des deux, à toute
--  heure.
--
--  Pour le jour d'une SÉANCE, les instants sont FIXES, choisis pour que Paris
--  et le fuseau du cabinet ne datent pas la séance du même jour : c'est ce qui
--  distingue le fuseau du cabinet d'un fuseau figé.
--
--  Les refus sont vérifiés sur leur MOTIF (`tests.assert_fails_with`) : un refus
--  pour une autre raison ne prouverait rien.
--
--  Données entièrement fictives.
-- ============================================================================
\set ON_ERROR_STOP on
\set alpha '''a0000000-0000-4000-8000-000000000001'''

-- ---------------------------------------------------------------------------
--  1. Une seule règle de fuseau
-- ---------------------------------------------------------------------------
begin;
do $$
begin
  perform tests.assert_equals(app.fuseau_utilisable(null), 'Europe/Paris',
    'Absent : le défaut de la colonne.');
  perform tests.assert_equals(app.fuseau_utilisable(''), 'Europe/Paris', 'Vide : le défaut.');
  perform tests.assert_equals(app.fuseau_utilisable('   '), 'Europe/Paris', 'Blanc : le défaut.');
  perform tests.assert_equals(app.fuseau_utilisable('Mars/Olympus'), 'Europe/Paris',
    'Illisible : le défaut, plutôt qu''un échec.');
  perform tests.assert_equals(app.fuseau_utilisable(' Pacific/Kiritimati '), 'Pacific/Kiritimati',
    'Un fuseau lisible est rendu tel quel, sans ses espaces.');
  perform tests.assert_equals(app.fuseau_utilisable('Etc/GMT+12'), 'Etc/GMT+12',
    'Un second fuseau lisible, pour qu''une constante ne passe pas.');

  update public.practices set timezone = 'Pacific/Kiritimati'
   where id = 'a1111111-1111-4111-8111-111111111111';
  perform tests.assert_equals(app.fuseau_du_cabinet('a1111111-1111-4111-8111-111111111111'),
    'Pacific/Kiritimati', 'Le fuseau d''un cabinet est celui de sa fiche.');
  perform tests.assert_equals(app.fuseau_du_cabinet('00000000-0000-4000-8000-00000000dead'),
    'Europe/Paris', 'Un cabinet introuvable retombe sur le défaut.');

  update public.practices set timezone = '   '
   where id = 'a1111111-1111-4111-8111-111111111111';
  perform tests.assert_equals(app.jour_du_cabinet('a1111111-1111-4111-8111-111111111111'),
    (now() at time zone 'Europe/Paris')::date,
    'Le jour du cabinet suit la même règle : un fuseau blanc vaut Paris.');

  -- LA RÈGLE EST APPLIQUÉE À L'ÉCRITURE, et la saisie reste telle quelle.
  update public.practices set timezone = 'Mars/Olympus'
   where id = 'a1111111-1111-4111-8111-111111111111';
  perform tests.assert_equals(
    (select array[timezone, effective_timezone] from public.practices
      where id = 'a1111111-1111-4111-8111-111111111111'),
    array['Mars/Olympus', 'Europe/Paris'],
    'Un fuseau illisible est conservé tel que saisi ; le fuseau effectif est le défaut.');

  perform tests.assert(
    (select p.provolatile = 'i'
            and p.prosrc !~* 'current_date|current_timestamp|localtimestamp|now[[:space:]]*\('
       from pg_proc p where p.oid = 'app.fuseau_utilisable(text)'::regprocedure),
    'La règle est immuable, et ne lit aucune horloge.');
end $$;
rollback;

-- La colonne se recalcule sous les droits d'un membre qui modifie sa fiche.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
begin
  update public.practices set timezone = ' Etc/GMT+12 '
   where id = 'a1111111-1111-4111-8111-111111111111';
  perform tests.assert_equals(
    (select effective_timezone from public.practices where id = 'a1111111-1111-4111-8111-111111111111'),
    'Etc/GMT+12', 'Modifiée par la titulaire : le fuseau effectif suit, sans ses espaces.');
end $$;
rollback;

-- ---------------------------------------------------------------------------
--  2. Les quatre écrits — cabinet EN AVANCE sur la session
-- ---------------------------------------------------------------------------
--  Le jour du cabinet est postérieur à `current_date`. L'ancienne garde le
--  refusait comme « futur », et l'ancien défaut datait de la veille.
begin;
update public.practices set timezone = 'Pacific/Kiritimati'
 where id = 'a1111111-1111-4111-8111-111111111111';
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_cab constant uuid := 'a1111111-1111-4111-8111-111111111111';
  v_pat constant uuid := 'a6000000-0000-4000-8000-000000000001';
  v_parcours constant uuid := 'a7000000-0000-4000-8000-000000000001';
  -- Calculé ici, sans la fonction éprouvée.
  v_jour constant date := (now() at time zone 'Pacific/Kiritimati')::date;
  v_dest uuid;
  v_sans_accord uuid;
  v_id uuid;
begin
  perform set_config('TimeZone', 'Etc/GMT+12', true);
  perform tests.assert(current_date < v_jour,
    'Préparation : la session est en retard sur le cabinet.');

  select id into v_dest from public.contacts where practice_id = v_cab limit 1;
  -- Un dossier sans aucun accord enregistré : celui du jeu d'essai porte un retrait.
  insert into public.patients (practice_id, first_name, last_name)
  values (v_cab, 'Fictif', 'Sansaccord') returning id into v_sans_accord;

  -- COURRIER DE LIAISON
  insert into public.liaison_letters (practice_id, patient_id, recipient_contact_id, subject, body)
  values (v_cab, v_pat, v_dest, 'Objet fictif', 'Corps fictif.') returning id into v_id;
  perform public.issue_liaison_letter(v_id);
  perform tests.assert_equals((select issued_on from public.liaison_letters where id = v_id), v_jour,
    'Courrier remis sans date : le jour du cabinet, pas la veille de la session.');

  insert into public.liaison_letters (practice_id, patient_id, recipient_contact_id, subject, body)
  values (v_cab, v_pat, v_dest, 'Objet fictif', 'Corps fictif.') returning id into v_id;
  perform public.issue_liaison_letter(v_id, v_jour);
  perform tests.assert_equals((select issued_on from public.liaison_letters where id = v_id), v_jour,
    'Courrier daté du jour du cabinet : accepté, et non plus refusé comme futur.');

  insert into public.liaison_letters (practice_id, patient_id, recipient_contact_id, subject, body)
  values (v_cab, v_pat, v_dest, 'Objet fictif', 'Corps fictif.') returning id into v_id;
  perform tests.assert_fails_with(
    format('select public.issue_liaison_letter(%L, %L::date)', v_id, v_jour + 1),
    'ne se date pas du futur', 'Le lendemain du cabinet reste une date future pour un courrier.');

  -- SYNTHÈSE DE SUIVI
  insert into public.follow_up_summaries
    (practice_id, patient_id, pathway_id, period_start, period_end, observed_evolution)
  values (v_cab, v_pat, v_parcours, v_jour - 40, v_jour - 10, 'Évolution fictive.')
  returning id into v_id;
  perform public.issue_follow_up_summary(v_id);
  perform tests.assert_equals((select issued_on from public.follow_up_summaries where id = v_id), v_jour,
    'Synthèse remise sans date : le jour du cabinet.');

  insert into public.follow_up_summaries
    (practice_id, patient_id, pathway_id, period_start, period_end, observed_evolution)
  values (v_cab, v_pat, v_parcours, v_jour - 30, v_jour, 'Évolution fictive.')
  returning id into v_id;
  perform public.issue_follow_up_summary(v_id, v_jour);
  perform tests.assert_equals((select issued_on from public.follow_up_summaries where id = v_id), v_jour,
    'Synthèse dont la période finit le jour du cabinet : acceptée, et non plus refusée.');

  insert into public.follow_up_summaries
    (practice_id, patient_id, pathway_id, period_start, period_end, observed_evolution)
  values (v_cab, v_pat, v_parcours, v_jour - 30, v_jour + 1, 'Évolution fictive.')
  returning id into v_id;
  perform tests.assert_fails_with(
    format('select public.issue_follow_up_summary(%L, %L::date)', v_id, v_jour),
    'période couverte se termine dans le futur',
    'Une période qui finit le lendemain du cabinet reste une période future.');

  -- ÉCRIT POUR UN TIERS NON SOIGNANT
  insert into public.third_party_reports
    (practice_id, patient_id, intended_use, observed, consent_override_reason)
  values (v_cab, v_sans_accord, 'ecole', 'Observation fictive.', 'Motif fictif de contrôle.')
  returning id into v_id;
  perform public.issue_third_party_report(v_id);
  perform tests.assert_equals((select issued_on from public.third_party_reports where id = v_id), v_jour,
    'Écrit pour un tiers remis sans date : le jour du cabinet.');

  insert into public.third_party_reports
    (practice_id, patient_id, intended_use, observed, consent_override_reason)
  values (v_cab, v_sans_accord, 'ecole', 'Observation fictive.', 'Motif fictif de contrôle.')
  returning id into v_id;
  perform public.issue_third_party_report(v_id, v_jour);
  perform tests.assert_equals((select issued_on from public.third_party_reports where id = v_id), v_jour,
    'Écrit pour un tiers daté du jour du cabinet : accepté.');

  insert into public.third_party_reports
    (practice_id, patient_id, intended_use, observed, consent_override_reason)
  values (v_cab, v_sans_accord, 'ecole', 'Observation fictive.', 'Motif fictif de contrôle.')
  returning id into v_id;
  perform tests.assert_fails_with(
    format('select public.issue_third_party_report(%L, %L::date)', v_id, v_jour + 1),
    'ne se date pas du futur', 'Le lendemain du cabinet reste une date future pour un écrit.');

  -- ÉCRIT DE FIN — le parcours se clôt le jour même, au cabinet.
  update public.care_pathways set status = 'termine', ended_on = v_jour where id = v_parcours;
  insert into public.closure_reports (practice_id, patient_id, pathway_id, closure_kind, observed)
  values (v_cab, v_pat, v_parcours, 'fin_convenue', 'Observation fictive au terme.')
  returning id into v_id;
  perform public.issue_closure_report(v_id);
  perform tests.assert_equals((select issued_on from public.closure_reports where id = v_id), v_jour,
    'Écrit de fin sur un parcours clos le jour du cabinet : accepté, et daté de ce jour.');
end $$;
rollback;

-- ÉCRIT DE FIN — une date future au cabinet, isolée de la garde de clôture.
begin;
update public.practices set timezone = 'Pacific/Kiritimati'
 where id = 'a1111111-1111-4111-8111-111111111111';
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_jour constant date := (now() at time zone 'Pacific/Kiritimati')::date;
  v_id uuid;
begin
  perform set_config('TimeZone', 'Etc/GMT+12', true);
  update public.care_pathways set status = 'termine', ended_on = v_jour - 1
   where id = 'a7000000-0000-4000-8000-000000000001';
  insert into public.closure_reports (practice_id, patient_id, pathway_id, closure_kind, observed)
  values ('a1111111-1111-4111-8111-111111111111', 'a6000000-0000-4000-8000-000000000001',
          'a7000000-0000-4000-8000-000000000001', 'fin_convenue', 'Observation fictive.')
  returning id into v_id;
  perform tests.assert_fails_with(
    format('select public.issue_closure_report(%L, %L::date)', v_id, v_jour + 1),
    'ne se date pas du futur', 'Le lendemain du cabinet reste une date future pour un écrit de fin.');
  perform public.issue_closure_report(v_id, v_jour);
  perform tests.assert_equals((select issued_on from public.closure_reports where id = v_id), v_jour,
    'Écrit de fin daté du jour du cabinet : accepté.');
end $$;
rollback;

-- ---------------------------------------------------------------------------
--  3. Les quatre écrits — cabinet EN RETARD sur la session
-- ---------------------------------------------------------------------------
--  Le jour de la session est déjà le lendemain au cabinet : l'ancienne garde
--  l'acceptait, il doit être refusé comme futur.
begin;
update public.practices set timezone = 'Etc/GMT+12'
 where id = 'a1111111-1111-4111-8111-111111111111';
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_cab constant uuid := 'a1111111-1111-4111-8111-111111111111';
  v_pat constant uuid := 'a6000000-0000-4000-8000-000000000001';
  v_parcours constant uuid := 'a7000000-0000-4000-8000-000000000001';
  v_jour constant date := (now() at time zone 'Etc/GMT+12')::date;
  v_dest uuid;
  v_sans_accord uuid;
  v_id uuid;
begin
  perform set_config('TimeZone', 'Pacific/Kiritimati', true);
  perform tests.assert(current_date > v_jour,
    'Préparation : la session est en avance sur le cabinet.');

  select id into v_dest from public.contacts where practice_id = v_cab limit 1;
  insert into public.patients (practice_id, first_name, last_name)
  values (v_cab, 'Fictif', 'Sansaccord') returning id into v_sans_accord;

  insert into public.liaison_letters (practice_id, patient_id, recipient_contact_id, subject, body)
  values (v_cab, v_pat, v_dest, 'Objet fictif', 'Corps fictif.') returning id into v_id;
  perform tests.assert_fails_with(
    format('select public.issue_liaison_letter(%L, %L::date)', v_id, current_date),
    'ne se date pas du futur',
    'Courrier daté du jour de la session, déjà le lendemain au cabinet : refusé.');
  perform public.issue_liaison_letter(v_id);
  perform tests.assert_equals((select issued_on from public.liaison_letters where id = v_id), v_jour,
    'Sans date : le jour du cabinet, et non le lendemain de la session.');

  insert into public.third_party_reports
    (practice_id, patient_id, intended_use, observed, consent_override_reason)
  values (v_cab, v_sans_accord, 'ecole', 'Observation fictive.', 'Motif fictif de contrôle.')
  returning id into v_id;
  perform tests.assert_fails_with(
    format('select public.issue_third_party_report(%L, %L::date)', v_id, current_date),
    'ne se date pas du futur',
    'Écrit pour un tiers daté du jour de la session : refusé.');
  perform public.issue_third_party_report(v_id);
  perform tests.assert_equals((select issued_on from public.third_party_reports where id = v_id), v_jour,
    'Sans date : le jour du cabinet.');

  insert into public.follow_up_summaries
    (practice_id, patient_id, pathway_id, period_start, period_end, observed_evolution)
  values (v_cab, v_pat, v_parcours, v_jour - 30, current_date, 'Évolution fictive.')
  returning id into v_id;
  perform tests.assert_fails_with(
    format('select public.issue_follow_up_summary(%L, %L::date)', v_id, v_jour),
    'période couverte se termine dans le futur',
    'Une période qui finit le jour de la session, déjà le lendemain au cabinet : refusée.');

  insert into public.follow_up_summaries
    (practice_id, patient_id, pathway_id, period_start, period_end, observed_evolution)
  values (v_cab, v_pat, v_parcours, v_jour - 30, v_jour - 1, 'Évolution fictive.')
  returning id into v_id;
  perform tests.assert_fails_with(
    format('select public.issue_follow_up_summary(%L, %L::date)', v_id, current_date),
    'ne se date pas du futur',
    'Synthèse datée du jour de la session : refusée.');
  perform public.issue_follow_up_summary(v_id);
  perform tests.assert_equals((select issued_on from public.follow_up_summaries where id = v_id), v_jour,
    'Sans date : le jour du cabinet.');

  update public.care_pathways set status = 'termine', ended_on = current_date where id = v_parcours;
  insert into public.closure_reports (practice_id, patient_id, pathway_id, closure_kind, observed)
  values (v_cab, v_pat, v_parcours, 'fin_convenue', 'Observation fictive.')
  returning id into v_id;
  perform tests.assert_fails_with(
    format('select public.issue_closure_report(%L, %L::date)', v_id, v_jour),
    'parcours se termine dans le futur',
    'Un parcours clos le jour de la session, déjà le lendemain au cabinet : refusé.');

  update public.care_pathways set ended_on = v_jour - 1 where id = v_parcours;
  perform tests.assert_fails_with(
    format('select public.issue_closure_report(%L, %L::date)', v_id, current_date),
    'ne se date pas du futur',
    'Écrit de fin daté du jour de la session : refusé.');
  perform public.issue_closure_report(v_id);
  perform tests.assert_equals((select issued_on from public.closure_reports where id = v_id), v_jour,
    'Sans date : le jour du cabinet.');
end $$;
rollback;

-- ---------------------------------------------------------------------------
--  4. Les dates que la base pose d'elle-même — cabinet EN AVANCE
-- ---------------------------------------------------------------------------
begin;
update public.practices set timezone = 'Pacific/Kiritimati'
 where id = 'a1111111-1111-4111-8111-111111111111';
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_cab constant uuid := 'a1111111-1111-4111-8111-111111111111';
  v_pat constant uuid := 'a6000000-0000-4000-8000-000000000001';
  v_jour constant date := (now() at time zone 'Pacific/Kiritimati')::date;
  v_id uuid;
  v_patient uuid;
  v_parcours uuid;
begin
  perform set_config('TimeZone', 'Etc/GMT+12', true);
  perform tests.assert(current_date < v_jour,
    'Préparation : la session est en retard sur le cabinet.');

  -- PIÈCE COMPTABLE émise sans date
  insert into public.billing_documents
    (practice_id, kind, patient_id, payer_contact_id, payer_is_patient)
  values (v_cab, 'facture', v_pat, 'a5000000-0000-4000-8000-000000000003', false)
  returning id into v_id;
  insert into public.billing_lines
    (practice_id, document_id, position, label, unit_price_cents, quantity, amount_cents)
  values (v_cab, v_id, 1, 'Séance fictive', 3230, 1, 3230);
  perform public.issue_billing_document(v_id);
  perform tests.assert_equals((select issued_on from public.billing_documents where id = v_id), v_jour,
    'Pièce émise sans date : le jour du cabinet.');
  perform tests.assert_equals((select series from public.billing_documents where id = v_id),
    'FACTURE-' || to_char(v_jour, 'YYYY'), 'Sa série suit l''année de ce jour.');

  -- ARCHIVAGE d'un dossier dont le parcours s'ouvre le jour même
  insert into public.patients (practice_id, first_name, last_name)
  values (v_cab, 'Fictif', 'Archivable') returning id into v_patient;
  insert into public.care_pathways (practice_id, patient_id, status, started_on)
  values (v_cab, v_patient, 'actif', v_jour) returning id into v_parcours;
  perform public.archive_patient(v_patient, 'Contrôle fictif.');
  perform tests.assert_equals((select ended_on from public.care_pathways where id = v_parcours), v_jour,
    'Archiver clôt le parcours au jour du cabinet : clos la veille, un parcours ouvert ce jour-là violait `care_pathways_periode_ck`.');

  -- DÉCOUPAGE DE BANDES activé sans date de validation
  insert into public.scale_band_sets (practice_id, scale_id, vocabulary_id, version, origin, source)
  values (v_cab, 'a9000000-0000-4000-8000-000000000001', 'aa000000-0000-4000-8000-000000000001',
          'v-controle-fuseau', 'convention_praticien', 'Découpage fictif.')
  returning id into v_id;
  insert into public.scale_bands
    (practice_id, band_set_id, position, lower_bound, upper_bound, upper_inclusive, label_key)
  values (v_cab, v_id, 1, 1, 7, false, 'b1'), (v_cab, v_id, 2, 7, 19, true, 'b3');
  perform public.activate_band_set(v_id, 'Praticienne fictive');
  perform tests.assert_equals((select validated_on from public.scale_band_sets where id = v_id), v_jour,
    'Découpage activé sans date de validation : le jour du cabinet.');

  -- NOTE et RÈGLEMENT enregistrés sans date, par un membre authentifié
  insert into public.patient_notes (practice_id, patient_id, body)
  values (v_cab, v_pat, 'Note fictive sans date.') returning id into v_id;
  perform tests.assert_equals((select written_on from public.patient_notes where id = v_id), v_jour,
    'Note enregistrée sans date : le jour du cabinet.');

  insert into public.patient_notes (practice_id, patient_id, body, written_on)
  values (v_cab, v_pat, 'Note fictive datée.', date '2026-01-15') returning id into v_id;
  perform tests.assert_equals((select written_on from public.patient_notes where id = v_id),
    date '2026-01-15', 'Une date fournie est conservée telle quelle.');

  insert into public.patient_notes (practice_id, patient_id, body, written_on)
  values (v_cab, v_pat, 'Note fictive à date vide.', null) returning id into v_id;
  perform tests.assert_equals((select written_on from public.patient_notes where id = v_id), v_jour,
    'Une date passée vide vaut une date omise : un déclencheur ne distingue pas les deux.');

  insert into public.payments (practice_id, amount_cents, method)
  values (v_cab, 3230, 'virement') returning id into v_id;
  perform tests.assert_equals((select received_on from public.payments where id = v_id), v_jour,
    'Règlement enregistré sans date : le jour du cabinet.');

  insert into public.payments (practice_id, amount_cents, method, received_on)
  values (v_cab, 3230, 'virement', date '2026-01-15') returning id into v_id;
  perform tests.assert_equals((select received_on from public.payments where id = v_id),
    date '2026-01-15', 'Une date de réception fournie est conservée.');
end $$;
rollback;

-- ---------------------------------------------------------------------------
--  5. La licence d'un instrument : le jour est un paramètre
-- ---------------------------------------------------------------------------
do $$
begin
  perform tests.assert_equals(
    app.effective_licence_status('integration_editeur_autorisee', date '2026-03-10', date '2026-03-10'),
    'integration_editeur_autorisee', 'Le jour d''échéance est encore couvert.');
  perform tests.assert_equals(
    app.effective_licence_status('integration_editeur_autorisee', date '2026-03-10', date '2026-03-11'),
    'scores_saisis_par_le_praticien', 'Le lendemain, l''autorisation cesse de produire ses effets.');
  perform tests.assert(to_regprocedure('app.effective_licence_status(text, date)') is null,
    'L''ancienne signature, qui lisait l''horloge, n''existe plus.');
  perform tests.assert(
    (select p.provolatile = 'i'
            and p.prosrc !~* 'current_date|current_timestamp|localtimestamp|now[[:space:]]*\('
       from pg_proc p where p.oid = 'app.effective_licence_status(text, date, date)'::regprocedure),
    'Déclarée immuable, elle ne lit plus aucune horloge.');
end $$;

-- ---------------------------------------------------------------------------
--  6. Le jour d'une séance, dans le fuseau du cabinet
-- ---------------------------------------------------------------------------
--  Deux instants FIXES, en hiver (Paris = UTC+1) :
--   · T1, 3 février 2025 à 23 h 30 UTC : le 4 à Paris et à UTC+14, le 3 à UTC−12 ;
--   · T2, 3 février 2025 à 12 h UTC    : le 3 à Paris et à UTC−12, le 4 à UTC+14.
--  Sous UTC−12, T1 distingue le cabinet de Paris ; sous UTC+14, T2 le fait.
--  La session est réglée sur un troisième fuseau : aucun des deux ne vient d'elle.
begin;
-- Pour compter les appels de fonctions dans la transaction (voir plus bas).
set local track_functions = 'pl';
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_cab constant uuid := 'a1111111-1111-4111-8111-111111111111';
  v_pat constant uuid := 'a6000000-0000-4000-8000-000000000001';
  v_t1 constant timestamptz := '2025-02-03 23:30:00+00';
  v_t2 constant timestamptz := '2025-02-03 12:00:00+00';
  v_rdv1 uuid;
  v_rdv2 uuid;
  v_faits jsonb;
  v_appels bigint;
  v_lues bigint;
begin
  perform set_config('TimeZone', 'Asia/Tokyo', true);

  insert into public.appointments (practice_id, patient_id, kind, starts_at, ends_at, attendance)
  values (v_cab, v_pat, 'seance', v_t1, v_t1 + interval '45 minutes', 'honore')
  returning id into v_rdv1;
  insert into public.appointments (practice_id, patient_id, kind, starts_at, ends_at, attendance)
  values (v_cab, v_pat, 'seance', v_t2, v_t2 + interval '45 minutes', 'honore')
  returning id into v_rdv2;
  insert into public.appointments (practice_id, patient_id, kind, starts_at, ends_at, attendance)
  values (v_cab, v_pat, 'seance', v_t1 + interval '5 minutes', v_t1 + interval '50 minutes', 'absent_excuse');
  insert into public.appointments
    (practice_id, patient_id, kind, starts_at, ends_at, attendance, attendance_note)
  values (v_cab, v_pat, 'seance', v_t2 + interval '5 minutes', v_t2 + interval '50 minutes',
          'annule_praticien', 'Annulation fictive.');

  -- LA VUE, lue sous les droits d'un membre
  update public.practices set timezone = 'Etc/GMT+12' where id = v_cab;
  perform tests.assert_equals(
    (select session_date from public.realised_sessions where appointment_id = v_rdv1), date '2025-02-03',
    'Cabinet à UTC−12 : la séance de 23 h 30 UTC est du 3 — Paris aurait dit le 4.');
  perform tests.assert_equals(
    (select session_date from public.realised_sessions where appointment_id = v_rdv2), date '2025-02-03',
    'Cabinet à UTC−12 : la séance de midi UTC est du 3.');

  update public.practices set timezone = 'Pacific/Kiritimati' where id = v_cab;
  perform tests.assert_equals(
    (select session_date from public.realised_sessions where appointment_id = v_rdv2), date '2025-02-04',
    'Cabinet à UTC+14 : la séance de midi UTC est du 4 — Paris aurait dit le 3.');
  perform tests.assert_equals(
    (select session_date from public.realised_sessions where appointment_id = v_rdv1), date '2025-02-04',
    'Cabinet à UTC+14 : la séance de 23 h 30 UTC est du 4.');

  update public.practices set timezone = 'Mars/Olympus' where id = v_cab;
  perform tests.assert_equals(
    (select session_date from public.realised_sessions where appointment_id = v_rdv1), date '2025-02-04',
    'Fuseau illisible : le jour de Paris.');
  perform tests.assert_equals(
    (select session_date from public.realised_sessions where appointment_id = v_rdv2), date '2025-02-03',
    'Fuseau illisible : le jour de Paris, pour l''autre séance aussi.');

  -- LA JOINTURE NE FAIT DISPARAÎTRE AUCUNE SÉANCE
  perform tests.assert_equals(
    (select count(*) from public.realised_sessions where practice_id = v_cab),
    (select count(*) from public.appointments
      where practice_id = v_cab and attendance = 'honore' and patient_id is not null
        and kind in ('seance', 'bilan', 'entretien', 'restitution')),
    'Toutes les séances honorées du cabinet figurent dans la vue.');

  -- LIRE LA VUE NE REJUGE PAS LE FUSEAU À CHAQUE SÉANCE : il est lu dans la
  -- fiche du cabinet. Au plus un appel — la constante du défaut, que le
  -- planificateur peut évaluer une fois. `count(session_date)` oblige à calculer
  -- le jour de chaque ligne : un `count(*)` laisserait le planificateur s'en
  -- dispenser, et le compte des appels ne distinguerait plus rien.
  v_appels := coalesce((select calls from pg_stat_xact_user_functions
                         where schemaname = 'app' and funcname = 'fuseau_utilisable'), 0);
  select count(session_date) into v_lues from public.realised_sessions where practice_id = v_cab;
  perform tests.assert(v_lues >= 2,
    'Préparation : plusieurs séances lues, sans quoi le compte des appels ne distingue rien.');
  perform tests.assert(
    coalesce((select calls from pg_stat_xact_user_functions
               where schemaname = 'app' and funcname = 'fuseau_utilisable'), 0) - v_appels
      <= 1,
    format('Le fuseau ne se rejuge pas pour chacune des %s séances lues.', v_lues));

  -- LE RELEVÉ D'UNE SYNTHÈSE compte les trois natures au même jour que la vue
  update public.practices set timezone = 'Etc/GMT+12' where id = v_cab;
  v_faits := public.follow_up_facts(v_pat, null, date '2025-02-03', date '2025-02-03');
  perform tests.assert_equals((v_faits ->> 'seances_honorees')::int, 2,
    'UTC−12, le 3 : les deux séances honorées — Paris n''en aurait compté qu''une.');
  perform tests.assert_equals((v_faits ->> 'absences')::int, 1,
    'UTC−12, le 3 : l''absence de 23 h 35 UTC — Paris l''aurait mise au 4.');
  perform tests.assert_equals((v_faits ->> 'annulees_par_le_cabinet')::int, 1,
    'UTC−12, le 3 : l''annulation de midi UTC.');

  update public.practices set timezone = 'Pacific/Kiritimati' where id = v_cab;
  v_faits := public.follow_up_facts(v_pat, null, date '2025-02-04', date '2025-02-04');
  perform tests.assert_equals((v_faits ->> 'seances_honorees')::int, 2,
    'UTC+14, le 4 : les deux séances honorées.');
  perform tests.assert_equals((v_faits ->> 'annulees_par_le_cabinet')::int, 1,
    'UTC+14, le 4 : l''annulation de midi UTC — Paris l''aurait mise au 3.');
  perform tests.assert_equals((v_faits ->> 'absences')::int, 1,
    'UTC+14, le 4 : l''absence.');
end $$;
rollback;

-- L'ATTESTATION : période, dernier fait attesté et date imprimée, au jour du cabinet
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_cab constant uuid := 'a1111111-1111-4111-8111-111111111111';
  v_pat constant uuid := 'a6000000-0000-4000-8000-000000000001';
  v_t1 constant timestamptz := '2025-02-03 23:30:00+00';
  v_t2 constant timestamptz := '2025-02-03 12:00:00+00';
  v_rdv uuid;
  v_att uuid;
begin
  -- UTC−12 et T1 : la séance est du 3 au cabinet, du 4 à Paris. Signée le 3 et
  -- annoncée pour le seul 3, elle ne passe que si les trois lectures suivent le
  -- cabinet : la période, le dernier fait attesté, la date imprimée.
  update public.practices set timezone = 'Etc/GMT+12' where id = v_cab;
  insert into public.appointments (practice_id, patient_id, kind, starts_at, ends_at, attendance)
  values (v_cab, v_pat, 'seance', v_t1, v_t1 + interval '45 minutes', 'honore')
  returning id into v_rdv;
  insert into public.attestations (practice_id, kind, patient_id, period_start, period_end)
  values (v_cab, 'presence', v_pat, date '2025-02-03', date '2025-02-03')
  returning id into v_att;
  insert into public.attestation_sessions (attestation_id, appointment_id, practice_id)
  values (v_att, v_rdv, v_cab);
  perform public.issue_attestation(v_att, date '2025-02-03');
  perform tests.assert_equals(
    (select snapshot -> 'seances' -> 0 ->> 'date' from public.attestations where id = v_att),
    '2025-02-03', 'La date imprimée de la séance est celle du cabinet — Paris aurait imprimé le 4.');

  -- UTC+14 et T2 : du 4 au cabinet, du 3 à Paris — l'autre borne de la période.
  update public.practices set timezone = 'Pacific/Kiritimati' where id = v_cab;
  insert into public.appointments (practice_id, patient_id, kind, starts_at, ends_at, attendance)
  values (v_cab, v_pat, 'seance', v_t2, v_t2 + interval '45 minutes', 'honore')
  returning id into v_rdv;
  insert into public.attestations (practice_id, kind, patient_id, period_start, period_end)
  values (v_cab, 'presence', v_pat, date '2025-02-04', date '2025-02-04')
  returning id into v_att;
  insert into public.attestation_sessions (attestation_id, appointment_id, practice_id)
  values (v_att, v_rdv, v_cab);
  perform public.issue_attestation(v_att);
  perform tests.assert_equals(
    (select snapshot -> 'seances' -> 0 ->> 'date' from public.attestations where id = v_att),
    '2025-02-04', 'UTC+14 : la séance de midi UTC est imprimée au 4.');
end $$;
rollback;

-- ---------------------------------------------------------------------------
--  7. Les droits, et plus aucune horloge de session dans le schéma
-- ---------------------------------------------------------------------------
do $$
begin
  perform tests.assert(has_function_privilege('authenticated', 'app.fuseau_utilisable(text)', 'execute'),
    'La vue des séances s''exécute sous les droits du membre : il doit pouvoir juger un fuseau.');
  perform tests.assert(not has_function_privilege('anon', 'app.fuseau_utilisable(text)', 'execute'),
    'Un visiteur anonyme, non.');
  perform tests.assert(not has_function_privilege('authenticated', 'app.fuseau_du_cabinet(uuid)', 'execute'),
    'Le fuseau d''un cabinet ne s''interroge pas par son identifiant.');
  perform tests.assert(not has_function_privilege('authenticated', 'app.dater_au_jour_du_cabinet()', 'execute'),
    'Le déclencheur de date ne s''appelle pas directement.');

  perform tests.assert_rows($q$
    select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('app', 'public') and p.prokind = 'f'
       and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
       and p.prosrc ~* 'current_date'$q$, 0,
    'Aucune fonction ne date plus par `current_date`, qui suit le fuseau de la session.');
  perform tests.assert_rows($q$
    select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('app', 'public') and p.prokind = 'f'
       and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
       and p.prosrc ~ 'Europe/Paris'
       and p.oid <> 'app.fuseau_utilisable(text)'::regprocedure$q$, 0,
    'Le fuseau par défaut n''est écrit qu''à un seul endroit.');
  perform tests.assert_rows($q$
    select 1 from pg_views where schemaname = 'public'
       and definition ~* 'Europe/Paris|current_date'$q$, 0,
    'Aucune vue ne fige un fuseau ni ne lit l''horloge de la session.');
  perform tests.assert_rows($q$
    select 1 from information_schema.columns
     where table_schema = 'public' and column_default ~* 'current_date'$q$, 0,
    'Aucun défaut de colonne ne date par `current_date`.');
end $$;
