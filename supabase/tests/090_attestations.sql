-- ============================================================================
--  090 — ATTESTATIONS DE PRÉSENCE ET DE PAIEMENT
--  Ces documents partent chez un employeur, une mutuelle, une MDPH. Ce qu'ils
--  affirment doit être vérifiable, et ce qu'ils taisent doit le rester.
-- ============================================================================
\set ON_ERROR_STOP on

\set alpha '''a0000000-0000-4000-8000-000000000001'''
\set cab_a '''a1111111-1111-4111-8111-111111111111'''
\set zephyr '''a6000000-0000-4000-8000-000000000001'''
\set beta_proprio '''b0000000-0000-4000-8000-000000000001'''
\set beta_assistant '''b0000000-0000-4000-8000-000000000002'''

-- ---------------------------------------------------------------------------
--  1. Une attestation de présence ne s'appuie que sur des séances qui ont eu lieu
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_att uuid;
  v_honore uuid;
  v_absent uuid;
  v_reunion uuid;
begin
  insert into public.attestations (practice_id, kind, patient_id)
  values ('a1111111-1111-4111-8111-111111111111', 'presence',
          'a6000000-0000-4000-8000-000000000001')
  returning id into v_att;

  select id into v_honore from public.appointments
   where patient_id = 'a6000000-0000-4000-8000-000000000001'
     and attendance = 'honore' limit 1;

  -- Une séance honorée : acceptée.
  insert into public.attestation_sessions (attestation_id, appointment_id, practice_id)
  values (v_att, v_honore, 'a1111111-1111-4111-8111-111111111111');
  perform tests.assert_equals(
    (select sessions_count from public.attestations where id = v_att), 1,
    'Le compte de séances est tenu par la base, pas par l''application.');

  -- Une absence : refusée. Attester une séance qui n'a pas eu lieu serait
  -- attester ce qui n'existe pas.
  insert into public.appointments
    (practice_id, patient_id, kind, starts_at, ends_at, attendance, attendance_note)
  values ('a1111111-1111-4111-8111-111111111111',
          'a6000000-0000-4000-8000-000000000001', 'seance',
          now() - interval '3 days', now() - interval '3 days' + interval '45 min',
          'absent_non_excuse', 'Non prévenue.')
  returning id into v_absent;
  perform tests.assert_fails(
    format('insert into public.attestation_sessions (attestation_id, appointment_id, practice_id)
            values (%L, %L, %L)', v_att, v_absent, 'a1111111-1111-4111-8111-111111111111'),
    'Une séance non honorée ne peut pas être attestée.');

  -- Une réunion d'équipe : refusée. Ce n'est pas une présence du patient.
  insert into public.appointments
    (practice_id, kind, title, starts_at, ends_at, attendance)
  values ('a1111111-1111-4111-8111-111111111111', 'reunion',
          'Équipe éducative (fictif)',
          now() - interval '4 days', now() - interval '4 days' + interval '1 hour',
          'honore')
  returning id into v_reunion;
  perform tests.assert_fails(
    format('insert into public.attestation_sessions (attestation_id, appointment_id, practice_id)
            values (%L, %L, %L)', v_att, v_reunion, 'a1111111-1111-4111-8111-111111111111'),
    'Une réunion d''équipe n''atteste d''aucune présence du patient.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  2. LE POINT CRITIQUE : on n'atteste pas les séances de quelqu'un d'autre
-- ---------------------------------------------------------------------------
--  Ce ne serait pas seulement une erreur de document : ce serait révéler à un
--  tiers qu'une AUTRE personne est suivie en psychomotricité.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_att uuid;
  v_autre_patient uuid;
  v_rdv_autre uuid;
begin
  insert into public.attestations (practice_id, kind, patient_id)
  values ('a1111111-1111-4111-8111-111111111111', 'presence',
          'a6000000-0000-4000-8000-000000000001')
  returning id into v_att;

  -- Un autre patient DU MÊME CABINET : la RLS ne protège donc rien ici.
  select id into v_autre_patient from public.patients
   where practice_id = 'a1111111-1111-4111-8111-111111111111'
     and id <> 'a6000000-0000-4000-8000-000000000001' limit 1;

  insert into public.appointments
    (practice_id, patient_id, kind, starts_at, ends_at, attendance)
  values ('a1111111-1111-4111-8111-111111111111', v_autre_patient, 'seance',
          now() - interval '5 days', now() - interval '5 days' + interval '45 min',
          'honore')
  returning id into v_rdv_autre;

  perform tests.assert_fails(
    format('insert into public.attestation_sessions (attestation_id, appointment_id, practice_id)
            values (%L, %L, %L)', v_att, v_rdv_autre, 'a1111111-1111-4111-8111-111111111111'),
    'La séance d''un autre patient ne peut pas être attestée : ce serait révéler son suivi.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  3. Une attestation sans fait rattaché ne s'émet pas
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_att uuid;
begin
  insert into public.attestations (practice_id, kind, patient_id)
  values ('a1111111-1111-4111-8111-111111111111', 'presence',
          'a6000000-0000-4000-8000-000000000001')
  returning id into v_att;

  perform tests.assert_fails(
    format('select public.issue_attestation(%L)', v_att),
    'Une attestation sans séance rattachée n''affirmerait rien de vérifiable.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  4. Attester est un acte professionnel : un assistant ne signe pas
-- ---------------------------------------------------------------------------
--  RÉSERVE HONNÊTE SUR CE SCÉNARIO. `app.can_write` exclut déjà les assistants :
--  ce test passerait donc à l'identique si `app.can_attest` déléguait à
--  `can_write`. Il verrouille un comportement réel — un assistant ne signe pas —
--  mais il ne distingue pas encore les deux prédicats, parce qu'aucun rôle ne se
--  situe entre les deux. Le scénario 4-bis fige cette coïncidence pour qu'elle
--  ne se défasse pas sans qu'on s'en aperçoive.
begin;
do $$
declare
  v_att uuid;
  v_rdv uuid;
  v_pat uuid;
  v_message text;
begin
  perform tests.authenticate_as('b0000000-0000-4000-8000-000000000001'::uuid);
  select id into v_pat from public.patients
   where practice_id = 'b1111111-1111-4111-8111-111111111111' limit 1;
  select id into v_rdv from public.appointments
   where patient_id = v_pat and attendance = 'honore' limit 1;

  insert into public.attestations (practice_id, kind, patient_id)
  values ('b1111111-1111-4111-8111-111111111111', 'presence', v_pat)
  returning id into v_att;
  insert into public.attestation_sessions (attestation_id, appointment_id, practice_id)
  values (v_att, v_rdv, 'b1111111-1111-4111-8111-111111111111');

  -- L'assistant peut préparer — il a le droit d'écrire — mais pas signer.
  perform tests.authenticate_as('b0000000-0000-4000-8000-000000000002'::uuid);
  begin
    perform public.issue_attestation(v_att);
    perform tests.assert(false, 'Un assistant ne doit pas pouvoir signer une attestation.');
  exception
    when assert_failure then raise;
    when others then get stacked diagnostics v_message = message_text;
  end;
  perform tests.assert(v_message like '%praticien%',
    'Le refus doit dire que la signature est un acte professionnel : ' || coalesce(v_message, '(aucun)'));

  -- Le praticien, lui, signe.
  perform tests.authenticate_as('b0000000-0000-4000-8000-000000000001'::uuid);
  perform tests.assert(
    public.issue_attestation(v_att) like 'AT%',
    'Un praticien doit pouvoir émettre l''attestation.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  4-bis. La coïncidence des trois prédicats est figée, pas supposée
-- ---------------------------------------------------------------------------
--  « Peut écrire », « peut lire une note clinique » et « peut signer une
--  attestation » répondent aujourd'hui la même chose. C'est une coïncidence, pas
--  une conception : si l'une des trois bouge sans les autres, les garanties qui
--  reposaient dessus se défont en silence.
--
--  LE SCÉNARIO CRÉE UN PRATICIEN NON PROPRIÉTAIRE, et c'est indispensable : le
--  jeu d'essai n'en comporte aucun. Sans lui, `owner` et `practitioner` ne se
--  distinguent nulle part, et remplacer `can_attest` par `can_administer` — qui
--  n'autorise QUE le propriétaire — passait inaperçu. Un contrôle qu'on ne peut
--  pas mettre en défaut ne contrôle rien.
begin;
do $$
declare
  v_cab uuid := 'a1111111-1111-4111-8111-111111111111';
  v_praticien uuid := 'a0000000-0000-4000-8000-00000000000f';
begin
  insert into auth.users (id, email)
  values (v_praticien, 'praticienne.associee@exemple-fictif.test')
  on conflict (id) do nothing;
  insert into public.practice_members (practice_id, user_id, role, status)
  values (v_cab, v_praticien, 'practitioner', 'active');

  perform tests.authenticate_as(v_praticien);

  perform tests.assert(app.can_write(v_cab),
    'Un praticien associé doit pouvoir écrire.');
  perform tests.assert(app.can_attest(v_cab),
    'Un praticien associé doit pouvoir signer une attestation : signer est son acte, pas celui du propriétaire du cabinet.');
  perform tests.assert(app.can_read_clinical(v_cab),
    'Et lire les notes cliniques.');

  perform tests.assert(
    app.can_attest(v_cab) = app.can_write(v_cab)
    and app.can_attest(v_cab) = app.can_read_clinical(v_cab),
    'Les trois prédicats doivent coïncider, ou la divergence doit être assumée ici.');

  -- L'assistant, lui, ne peut rien de tout cela.
  perform tests.authenticate_as('b0000000-0000-4000-8000-000000000002'::uuid);
  perform tests.assert(
    not app.can_attest('b1111111-1111-4111-8111-111111111111'),
    'Un assistant ne signe pas.');
  perform tests.assert(
    app.can_attest('b1111111-1111-4111-8111-111111111111')
      = app.can_write('b1111111-1111-4111-8111-111111111111'),
    'Le jour où un assistant obtient un droit d''écriture, ce contrôle échoue — et c''est le moment de décider s''il peut signer.');
  reset role;
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  5. Émise, elle ne bouge plus — et ne se supprime pas
-- ---------------------------------------------------------------------------
--  Elle est entre les mains d'un tiers. La corriger en silence produirait deux
--  documents contradictoires portant le même numéro.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_att uuid;
  v_rdv uuid;
  v_num text;
begin
  insert into public.attestations (practice_id, kind, patient_id)
  values ('a1111111-1111-4111-8111-111111111111', 'presence',
          'a6000000-0000-4000-8000-000000000001')
  returning id into v_att;
  select id into v_rdv from public.appointments
   where patient_id = 'a6000000-0000-4000-8000-000000000001'
     and attendance = 'honore' limit 1;
  insert into public.attestation_sessions (attestation_id, appointment_id, practice_id)
  values (v_att, v_rdv, 'a1111111-1111-4111-8111-111111111111');

  v_num := public.issue_attestation(v_att);
  perform tests.assert(v_num like 'AT%', 'Le numéro doit distinguer une attestation d''une facture.');

  perform tests.assert_fails(
    format('update public.attestations set note = ''Ajouté après coup'' where id = %L', v_att),
    'Une attestation émise ne se modifie pas.');
  perform tests.assert_fails(
    format('delete from public.attestations where id = %L', v_att),
    'Une attestation émise ne se supprime pas.');
  perform tests.assert_fails(
    format('delete from public.attestation_sessions where attestation_id = %L', v_att),
    'Ce qu''elle atteste ne se retire pas non plus.');

  -- Annuler SANS motif est refusé : un document disparaîtrait sans explication
  -- pour qui en détient une copie.
  perform tests.assert_fails(
    format('select public.cancel_attestation(%L, ''  '')', v_att),
    'Une annulation sans motif doit être refusée.');

  -- Avec un motif, elle est annulée et CONSERVÉE.
  perform public.cancel_attestation(v_att, 'Erreur de période attestée.');
  perform tests.assert_rows(
    format('select 1 from public.attestations where id = %L and status = ''annule''', v_att),
    1, 'L''attestation doit être marquée annulée.');
  perform tests.assert_rows(
    format('select 1 from public.attestations
             where id = %L and cancellation_reason like ''%%période%%''', v_att),
    1, 'Le motif doit être conservé avec elle.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  6. L'instantané fige ce qui est attesté
-- ---------------------------------------------------------------------------
--  Un rendez-vous peut être requalifié plus tard. Le document déjà remis, lui,
--  ne change pas : il porte ce qui était vrai le jour de la signature.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_att uuid;
  v_rdv uuid;
  v_avant jsonb;
  v_apres jsonb;
begin
  insert into public.attestations (practice_id, kind, patient_id)
  values ('a1111111-1111-4111-8111-111111111111', 'presence',
          'a6000000-0000-4000-8000-000000000001')
  returning id into v_att;
  select id into v_rdv from public.appointments
   where patient_id = 'a6000000-0000-4000-8000-000000000001'
     and attendance = 'honore' limit 1;
  insert into public.attestation_sessions (attestation_id, appointment_id, practice_id)
  values (v_att, v_rdv, 'a1111111-1111-4111-8111-111111111111');
  perform public.issue_attestation(v_att);

  select snapshot -> 'seances' into v_avant from public.attestations where id = v_att;
  perform tests.assert(jsonb_array_length(v_avant) = 1,
    'L''instantané doit porter la séance attestée.');
  perform tests.assert(v_avant -> 0 ->> 'date' is not null,
    'Il doit porter sa DATE, et non seulement un identifiant.');

  -- Le rendez-vous change d'issue après coup.
  update public.appointments
     set attendance = 'annule_patient', attendance_note = 'Requalifié après coup.'
   where id = v_rdv;

  select snapshot -> 'seances' into v_apres from public.attestations where id = v_att;
  perform tests.assert(v_apres = v_avant,
    'Le document ne doit pas changer quand la donnée d''origine change.');

  -- Et l'identité du signataire y est : sans elle, l'attestation ne vaut rien.
  perform tests.assert_rows(
    format('select 1 from public.attestations
             where id = %L and snapshot -> ''praticien'' ->> ''titre'' is not null', v_att),
    1, 'L''instantané doit porter le titre professionnel du signataire.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  7. Paiement : on n'atteste pas l'argent d'une autre famille
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_doc uuid; v_pay uuid; v_att uuid; v_autre uuid;
begin
  select id into v_autre from public.patients
   where practice_id = 'a1111111-1111-4111-8111-111111111111'
     and id <> 'a6000000-0000-4000-8000-000000000001' limit 1;

  -- Une facture de 90 € pour Zéphyr, réglée intégralement.
  insert into public.billing_documents (practice_id, kind, patient_id, payer_is_patient)
  values ('a1111111-1111-4111-8111-111111111111', 'facture',
          'a6000000-0000-4000-8000-000000000001', true)
  returning id into v_doc;
  insert into public.billing_lines
    (practice_id, document_id, position, label, unit_price_cents, amount_cents)
  values ('a1111111-1111-4111-8111-111111111111', v_doc, 1, 'Séance', 9000, 9000);
  perform public.issue_billing_document(v_doc);

  insert into public.payments (practice_id, received_on, amount_cents, method)
  values ('a1111111-1111-4111-8111-111111111111', current_date, 9000, 'cheque')
  returning id into v_pay;
  insert into public.payment_allocations
    (practice_id, payment_id, document_id, amount_cents)
  values ('a1111111-1111-4111-8111-111111111111', v_pay, v_doc, 9000);

  -- Attestation pour l'AUTRE patient : ce règlement ne le concerne pas.
  insert into public.attestations (practice_id, kind, patient_id)
  values ('a1111111-1111-4111-8111-111111111111', 'paiement', v_autre)
  returning id into v_att;
  perform tests.assert_fails(
    format('insert into public.attestation_payments
              (attestation_id, payment_id, practice_id, amount_cents)
            values (%L, %L, %L, 9000)',
           v_att, v_pay, 'a1111111-1111-4111-8111-111111111111'),
    'Un règlement imputé sur la facture d''un autre patient n''atteste rien pour celui-ci.');

  -- Attestation pour Zéphyr : au-delà de l'imputation, refusé.
  insert into public.attestations (practice_id, kind, patient_id)
  values ('a1111111-1111-4111-8111-111111111111', 'paiement',
          'a6000000-0000-4000-8000-000000000001')
  returning id into v_att;
  perform tests.assert_fails(
    format('insert into public.attestation_payments
              (attestation_id, payment_id, practice_id, amount_cents)
            values (%L, %L, %L, 12000)',
           v_att, v_pay, 'a1111111-1111-4111-8111-111111111111'),
    'On n''atteste pas plus que ce qui a été imputé sur les factures de ce patient.');

  -- À hauteur de l'imputation : accepté, et le total est tenu par la base.
  insert into public.attestation_payments
    (attestation_id, payment_id, practice_id, amount_cents)
  values (v_att, v_pay, 'a1111111-1111-4111-8111-111111111111', 9000);
  perform tests.assert_equals(
    (select total_cents from public.attestations where id = v_att), 9000::bigint,
    'Le montant attesté est tenu par la base.');

  -- Et l'instantané relie l'argent à la prestation.
  perform public.issue_attestation(v_att);
  perform tests.assert_rows(
    format('select 1 from public.attestations
             where id = %L and jsonb_array_length(snapshot -> ''factures'') = 1', v_att),
    1, 'L''attestation de paiement doit nommer la facture réglée.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  8. Un acompte non imputé n'atteste d'aucun paiement de prestation
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_pay uuid; v_att uuid;
begin
  insert into public.payments (practice_id, received_on, amount_cents, method)
  values ('a1111111-1111-4111-8111-111111111111', current_date, 5000, 'virement')
  returning id into v_pay;

  insert into public.attestations (practice_id, kind, patient_id)
  values ('a1111111-1111-4111-8111-111111111111', 'paiement',
          'a6000000-0000-4000-8000-000000000001')
  returning id into v_att;

  perform tests.assert_fails(
    format('insert into public.attestation_payments
              (attestation_id, payment_id, practice_id, amount_cents)
            values (%L, %L, %L, 5000)',
           v_att, v_pay, 'a1111111-1111-4111-8111-111111111111'),
    'Un règlement imputé sur aucune facture n''atteste d''aucune prestation réglée.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  9. Isolation : l'attestation d'un autre cabinet est invisible
-- ---------------------------------------------------------------------------
begin;
do $$
declare
  v_att uuid;
  v_pat uuid;
begin
  select id into v_pat from public.patients
   where practice_id = 'b1111111-1111-4111-8111-111111111111' limit 1;
  insert into public.attestations (practice_id, kind, patient_id)
  values ('b1111111-1111-4111-8111-111111111111', 'presence', v_pat)
  returning id into v_att;

  perform tests.authenticate_as('a0000000-0000-4000-8000-000000000001'::uuid);
  perform tests.assert_rows(
    format('select 1 from public.attestations where id = %L', v_att), 0,
    'L''attestation d''un autre cabinet ne doit pas être lisible.');
  perform tests.assert_affects_nothing(
    format('update public.attestations set note = ''intrusion'' where id = %L', v_att),
    'Ni modifiable.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  10. AUCUN CONTENU CLINIQUE NE SORT SUR UNE ATTESTATION
-- ---------------------------------------------------------------------------
--  Ce document part chez un employeur, une mutuelle, une administration. Le
--  motif de la demande, une observation, une hypothèse n'ont rien à y faire.
--
--  Le contrôle est par SENTINELLE : on écrit des mots reconnaissables dans le
--  dossier clinique du patient, puis on exige qu'aucun ne se retrouve dans
--  l'instantané. Une liste de clés autorisées ne suffirait pas — elle ne verrait
--  pas un motif recopié à l'intérieur d'un champ permis.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_cab uuid := 'a1111111-1111-4111-8111-111111111111';
  v_pat uuid := 'a6000000-0000-4000-8000-000000000001';
  v_att uuid;
  v_rdv uuid;
  v_texte text;
  v_cles text;
begin
  -- Des sentinelles dans le dossier clinique.
  insert into public.care_pathways (practice_id, patient_id, label, referral_reason)
  values (v_cab, v_pat, 'Parcours sentinelle', 'MOTIFSENTINELLE gêne à l''écrit');
  insert into public.patient_notes (practice_id, patient_id, body, author_member_id)
  values (v_cab, v_pat, 'OBSERVATIONSENTINELLE tonus axial',
          (select id from public.practice_members
            where practice_id = v_cab and user_id = app.current_user_id() limit 1));

  insert into public.attestations
    (practice_id, kind, patient_id, note, internal_note)
  values (v_cab, 'presence', v_pat,
          'Mention visible ordinaire.', 'NOTEINTERNESENTINELLE à ne pas sortir')
  returning id into v_att;
  select appointment_id into v_rdv from public.realised_sessions
   where patient_id = v_pat limit 1;
  insert into public.attestation_sessions (attestation_id, appointment_id, practice_id)
  values (v_att, v_rdv, v_cab);
  perform public.issue_attestation(v_att);

  select snapshot::text into v_texte from public.attestations where id = v_att;

  perform tests.assert(v_texte not like '%MOTIFSENTINELLE%',
    'Le motif de la demande ne doit pas figurer sur une attestation.');
  perform tests.assert(v_texte not like '%OBSERVATIONSENTINELLE%',
    'Aucune note clinique ne doit figurer sur une attestation.');
  perform tests.assert(v_texte not like '%NOTEINTERNESENTINELLE%',
    'La note interne ne doit jamais être imprimée.');

  -- Et la liste des clés est close : un champ ajouté à l'instantané devra
  -- passer par ici, donc par une décision.
  select string_agg(k, ',' order by k) into v_cles
    from jsonb_object_keys((select snapshot from public.attestations where id = v_att)) k;
  perform tests.assert_equals(v_cles,
    'cabinet,destinataire,emis_le,entite_juridique,factures,identifiants,patient,praticien,reglements,seances',
    'L''instantané d''une attestation a une liste de clés CLOSE. En ajouter une est une décision, pas un détail.');
end
$$;
rollback;
