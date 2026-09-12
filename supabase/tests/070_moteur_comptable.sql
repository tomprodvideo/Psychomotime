-- ============================================================================
--  070 — MOTEUR COMPTABLE
--  Chaque scénario correspond à une règle que la v1 ne tenait pas.
-- ============================================================================
\set ON_ERROR_STOP on

\set alpha '''a0000000-0000-4000-8000-000000000001'''
\set cab_a '''a1111111-1111-4111-8111-111111111111'''
\set zephyr '''a6000000-0000-4000-8000-000000000001'''
\set grand_mere '''a5000000-0000-4000-8000-000000000003'''

-- ---------------------------------------------------------------------------
--  1. Ouvrir un brouillon ne consomme aucun numéro
-- ---------------------------------------------------------------------------
--  Le défaut inverse — réserver un numéro à l'ouverture du formulaire — creuse
--  un trou dans la série à chaque abandon.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_doc uuid;
  v_avant integer;
  v_apres integer;
begin
  select coalesce(max(last_value), 0) into v_avant
    from public.billing_counters where practice_id = 'a1111111-1111-4111-8111-111111111111';

  insert into public.billing_documents (practice_id, kind, patient_id, payer_is_patient)
  values ('a1111111-1111-4111-8111-111111111111', 'facture',
          'a6000000-0000-4000-8000-000000000001', true)
  returning id into v_doc;

  perform tests.assert_rows(
    format('select 1 from public.billing_documents where id = %L and number is null', v_doc),
    1, 'Un brouillon n''a pas de numéro.');

  select coalesce(max(last_value), 0) into v_apres
    from public.billing_counters where practice_id = 'a1111111-1111-4111-8111-111111111111';
  perform tests.assert_equals(v_apres, v_avant,
    'Créer un brouillon ne doit consommer aucun numéro.');

  -- Un brouillon se supprime librement : lui seul.
  delete from public.billing_documents where id = v_doc;
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  2. Le total suit ses lignes, et la base le tient
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_doc uuid;
  v_total bigint;
begin
  insert into public.billing_documents
    (practice_id, kind, patient_id, payer_is_patient, total_cents)
  values ('a1111111-1111-4111-8111-111111111111', 'facture',
          'a6000000-0000-4000-8000-000000000001', true, 999999)
  returning id into v_doc;

  -- Le total posté est ignoré : il n'y a pas encore de ligne.
  select total_cents into v_total from public.billing_documents where id = v_doc;
  perform tests.assert_equals(v_total, 999999::bigint,
    'Avant toute ligne, le total reste celui qui a été écrit.');

  insert into public.billing_lines
    (practice_id, document_id, position, label, unit_price_cents, quantity, amount_cents)
  values
    ('a1111111-1111-4111-8111-111111111111', v_doc, 1, 'Séance', 3230, 3, 9690),
    ('a1111111-1111-4111-8111-111111111111', v_doc, 2, 'Bilan', 18000, 1, 18000);

  select total_cents into v_total from public.billing_documents where id = v_doc;
  perform tests.assert_equals(v_total, 27690::bigint,
    'Le total doit suivre la somme des lignes, en centimes.');

  -- Retirer une ligne met le total à jour.
  delete from public.billing_lines where document_id = v_doc and position = 2;
  select total_cents into v_total from public.billing_documents where id = v_doc;
  perform tests.assert_equals(v_total, 9690::bigint,
    'Retirer une ligne doit mettre le total à jour.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  3. Émission : numéro atomique, instantané figé, point de non-retour
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_doc uuid;
  v_numero text;
  v_snapshot jsonb;
begin
  insert into public.billing_documents
    (practice_id, kind, patient_id, payer_contact_id, payer_is_patient)
  values ('a1111111-1111-4111-8111-111111111111', 'facture',
          'a6000000-0000-4000-8000-000000000001',
          'a5000000-0000-4000-8000-000000000003', false)
  returning id into v_doc;

  -- Une pièce sans ligne ne s'émet pas.
  perform tests.assert_fails(
    format('select public.issue_billing_document(%L)', v_doc),
    'Une pièce sans ligne ne doit pas pouvoir être émise.');

  insert into public.billing_lines
    (practice_id, document_id, position, label, unit_price_cents, quantity, amount_cents)
  values ('a1111111-1111-4111-8111-111111111111', v_doc, 1, 'Séance', 3230, 1, 3230);

  v_numero := public.issue_billing_document(v_doc);
  perform tests.assert(v_numero is not null, 'L''émission doit rendre un numéro.');

  perform tests.assert_rows(
    format('select 1 from public.billing_documents
             where id = %L and status = ''emis'' and issued_on is not null', v_doc),
    1, 'Une pièce émise porte son statut et sa date.');

  -- L'instantané fige ce qui vaut à cette date.
  select snapshot into v_snapshot from public.billing_documents where id = v_doc;
  perform tests.assert(v_snapshot ? 'entite_juridique',
    'L''instantané doit figer l''entité juridique.');
  perform tests.assert(v_snapshot ? 'configuration_fiscale',
    'L''instantané doit figer la configuration fiscale applicable.');
  perform tests.assert(v_snapshot ? 'identifiants',
    'L''instantané doit figer les identifiants professionnels en vigueur.');
  perform tests.assert(
    v_snapshot -> 'payeur' ->> 'nom' like '%Farandole%',
    'L''instantané doit figer le payeur, qui n''est ni le patient ni un responsable légal.');

  -- Le point de non-retour.
  perform tests.assert_fails(
    format('update public.billing_documents set number = ''TRUQUE'' where id = %L', v_doc),
    'Le numéro d''une pièce émise ne doit pas pouvoir être modifié.');
  perform tests.assert_fails(
    format('update public.billing_documents set issued_on = date ''2020-01-01'' where id = %L', v_doc),
    'La date d''émission ne doit pas pouvoir être modifiée.');
  perform tests.assert_fails(
    format('delete from public.billing_documents where id = %L', v_doc),
    'Une pièce émise ne doit pas pouvoir être supprimée.');
  perform tests.assert_fails(
    format('update public.billing_lines set amount_cents = 1 where document_id = %L', v_doc),
    'Les lignes d''une pièce émise ne doivent pas pouvoir être modifiées.');
  perform tests.assert_fails(
    format('insert into public.billing_lines
              (practice_id, document_id, position, label, amount_cents)
            values (%L, %L, 9, ''Ajout tardif'', 100)',
           'a1111111-1111-4111-8111-111111111111', v_doc),
    'On ne doit pas pouvoir ajouter une ligne à une pièce émise.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  4. Un numéro n'est jamais réattribué, et deux pièces n'en partagent pas
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_a uuid; v_b uuid; v_c uuid;
  v_na text; v_nb text; v_nc text;
begin
  for i in 1..3 loop
    insert into public.billing_documents
      (practice_id, kind, patient_id, payer_is_patient)
    values ('a1111111-1111-4111-8111-111111111111', 'facture',
            'a6000000-0000-4000-8000-000000000001', true)
    returning id into v_c;
    insert into public.billing_lines
      (practice_id, document_id, position, label, unit_price_cents, quantity, amount_cents)
    values ('a1111111-1111-4111-8111-111111111111', v_c, 1, 'Séance', 3230, 1, 3230);
    if i = 1 then v_a := v_c; elsif i = 2 then v_b := v_c; end if;
  end loop;

  v_na := public.issue_billing_document(v_a);
  v_nb := public.issue_billing_document(v_b);
  v_nc := public.issue_billing_document(v_c);

  perform tests.assert(v_na <> v_nb and v_nb <> v_nc and v_na <> v_nc,
    'Trois émissions doivent produire trois numéros distincts.');

  -- La série est continue : 001, 002, 003.
  perform tests.assert_equals(right(v_na, 3), '001', 'Premier numéro de la série.');
  perform tests.assert_equals(right(v_nb, 3), '002', 'Deuxième, sans saut.');
  perform tests.assert_equals(right(v_nc, 3), '003', 'Troisième, sans saut.');

  -- Deux pièces ne peuvent pas porter le même numéro dans la même série.
  perform tests.assert_fails(
    format('update public.billing_counters set last_value = 0
             where practice_id = %L', 'a1111111-1111-4111-8111-111111111111'),
    'Le compteur ne doit pas pouvoir être remis en arrière à la main.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  5. Une facture ne se supprime pas : elle s'annule par un avoir
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_facture uuid; v_avoir uuid;
  v_num text;
  v_solde bigint;
begin
  insert into public.billing_documents
    (practice_id, kind, patient_id, payer_is_patient)
  values ('a1111111-1111-4111-8111-111111111111', 'facture',
          'a6000000-0000-4000-8000-000000000001', true)
  returning id into v_facture;
  insert into public.billing_lines
    (practice_id, document_id, position, label, unit_price_cents, quantity, amount_cents)
  values ('a1111111-1111-4111-8111-111111111111', v_facture, 1, 'Séance', 3230, 2, 6460);
  v_num := public.issue_billing_document(v_facture);

  -- Un avoir sans référence à la pièce rectifiée est refusé : la référence
  -- doit être « spécifique et non équivoque ».
  perform tests.assert_fails(
    format('insert into public.billing_documents (practice_id, kind, patient_id)
            values (%L, ''avoir'', %L)',
           'a1111111-1111-4111-8111-111111111111',
           'a6000000-0000-4000-8000-000000000001'),
    'Un avoir sans référence à la facture rectifiée doit être refusé.');

  -- Avec la référence complète — identifiant, numéro ET date — c'est accepté.
  insert into public.billing_documents
    (practice_id, kind, patient_id, payer_is_patient,
     rectifies_id, rectifies_number, rectifies_issued_on, rectification_reason)
  values ('a1111111-1111-4111-8111-111111111111', 'avoir',
          'a6000000-0000-4000-8000-000000000001', true,
          v_facture, v_num, current_date, 'Séance non due.')
  returning id into v_avoir;
  insert into public.billing_lines
    (practice_id, document_id, position, label, unit_price_cents, quantity, amount_cents)
  values ('a1111111-1111-4111-8111-111111111111', v_avoir, 1, 'Séance non due', 3230, 1, 3230);

  perform public.issue_billing_document(v_avoir);

  -- La facture d'origine est marquée : sans cela elle serait comptée deux fois.
  perform tests.assert_rows(
    format('select 1 from public.billing_documents
             where id = %L and status = ''annule_par_avoir''', v_facture),
    1, 'La facture rectifiée doit porter son statut d''annulation.');

  -- Et elle reste là : rien n'a été effacé.
  perform tests.assert_rows(
    format('select 1 from public.billing_documents where id = %L', v_facture),
    1, 'La facture d''origine est conservée.');

  -- L'avoir vient en déduction du solde.
  v_solde := public.document_balance_cents(v_facture);
  perform tests.assert_equals(v_solde, 3230::bigint,
    'L''avoir doit venir en déduction : 64,60 € moins 32,30 €.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  6. Paiements partiels, groupés, et trop-perçu
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_f1 uuid; v_f2 uuid; v_paiement uuid;
begin
  -- Deux factures.
  insert into public.billing_documents (practice_id, kind, patient_id, payer_is_patient)
  values ('a1111111-1111-4111-8111-111111111111', 'facture',
          'a6000000-0000-4000-8000-000000000001', true) returning id into v_f1;
  insert into public.billing_lines
    (practice_id, document_id, position, label, unit_price_cents, quantity, amount_cents)
  values ('a1111111-1111-4111-8111-111111111111', v_f1, 1, 'Séance', 3230, 1, 3230);
  perform public.issue_billing_document(v_f1);

  insert into public.billing_documents (practice_id, kind, patient_id, payer_is_patient)
  values ('a1111111-1111-4111-8111-111111111111', 'facture',
          'a6000000-0000-4000-8000-000000000001', true) returning id into v_f2;
  insert into public.billing_lines
    (practice_id, document_id, position, label, unit_price_cents, quantity, amount_cents)
  values ('a1111111-1111-4111-8111-111111111111', v_f2, 1, 'Séance', 3230, 1, 3230);
  perform public.issue_billing_document(v_f2);

  -- Un seul règlement couvre les deux, et il reste un trop-perçu.
  insert into public.payments
    (practice_id, amount_cents, method, payer_contact_id)
  values ('a1111111-1111-4111-8111-111111111111', 7000, 'virement',
          'a5000000-0000-4000-8000-000000000003')
  returning id into v_paiement;

  insert into public.payment_allocations
    (practice_id, payment_id, document_id, amount_cents)
  values
    ('a1111111-1111-4111-8111-111111111111', v_paiement, v_f1, 3230),
    ('a1111111-1111-4111-8111-111111111111', v_paiement, v_f2, 3230);

  perform tests.assert_equals(public.document_balance_cents(v_f1), 0::bigint,
    'Un règlement groupé doit solder la première facture.');
  perform tests.assert_equals(public.document_balance_cents(v_f2), 0::bigint,
    'Et la seconde.');

  -- Affecter plus que le règlement est refusé : le reste est un trop-perçu,
  -- et doit le rester.
  perform tests.assert_fails(
    format('insert into public.payment_allocations
              (practice_id, payment_id, document_id, amount_cents)
            values (%L, %L, %L, 1000)',
           'a1111111-1111-4111-8111-111111111111', v_paiement, v_f1),
    'On ne doit pas pouvoir affecter plus que le montant du règlement.');
end
$$;
rollback;

-- Un règlement partiel laisse un solde visible.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_f uuid; v_p uuid;
begin
  insert into public.billing_documents (practice_id, kind, patient_id, payer_is_patient)
  values ('a1111111-1111-4111-8111-111111111111', 'facture',
          'a6000000-0000-4000-8000-000000000001', true) returning id into v_f;
  insert into public.billing_lines
    (practice_id, document_id, position, label, unit_price_cents, quantity, amount_cents)
  values ('a1111111-1111-4111-8111-111111111111', v_f, 1, 'Bilan', 18000, 1, 18000);
  perform public.issue_billing_document(v_f);

  insert into public.payments (practice_id, amount_cents, method)
  values ('a1111111-1111-4111-8111-111111111111', 9000, 'cheque') returning id into v_p;
  insert into public.payment_allocations
    (practice_id, payment_id, document_id, amount_cents)
  values ('a1111111-1111-4111-8111-111111111111', v_p, v_f, 9000);

  perform tests.assert_equals(public.document_balance_cents(v_f), 9000::bigint,
    'Un acompte doit laisser le solde exact, au centime.');
end
$$;
rollback;

-- On n'affecte pas un règlement à un brouillon, ni à un devis.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_brouillon uuid; v_devis uuid; v_p uuid;
begin
  insert into public.billing_documents (practice_id, kind, patient_id, payer_is_patient)
  values ('a1111111-1111-4111-8111-111111111111', 'facture',
          'a6000000-0000-4000-8000-000000000001', true) returning id into v_brouillon;

  insert into public.billing_documents (practice_id, kind, patient_id, payer_is_patient)
  values ('a1111111-1111-4111-8111-111111111111', 'devis',
          'a6000000-0000-4000-8000-000000000001', true) returning id into v_devis;
  insert into public.billing_lines
    (practice_id, document_id, position, label, unit_price_cents, quantity, amount_cents)
  values ('a1111111-1111-4111-8111-111111111111', v_devis, 1, 'Bilan', 18000, 1, 18000);
  perform public.issue_billing_document(v_devis);

  insert into public.payments (practice_id, amount_cents, method)
  values ('a1111111-1111-4111-8111-111111111111', 5000, 'especes') returning id into v_p;

  perform tests.assert_fails(
    format('insert into public.payment_allocations
              (practice_id, payment_id, document_id, amount_cents)
            values (%L, %L, %L, 5000)',
           'a1111111-1111-4111-8111-111111111111', v_p, v_brouillon),
    'On ne doit pas pouvoir affecter un règlement à un brouillon.');

  perform tests.assert_fails(
    format('insert into public.payment_allocations
              (practice_id, payment_id, document_id, amount_cents)
            values (%L, %L, %L, 5000)',
           'a1111111-1111-4111-8111-111111111111', v_p, v_devis),
    'Un devis n''appelle pas de règlement.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  7. Seule une séance RÉALISÉE peut être facturée
-- ---------------------------------------------------------------------------
--  C'est la garantie qui rendra une attestation de présence vérifiable.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_doc uuid; v_ligne uuid;
  v_honore uuid; v_absent uuid; v_avenir uuid;
begin
  -- Trois rendez-vous passés, trois issues différentes.
  insert into public.appointments
    (practice_id, patient_id, kind, starts_at, ends_at, attendance)
  values ('a1111111-1111-4111-8111-111111111111',
          'a6000000-0000-4000-8000-000000000001', 'seance',
          now() - interval '10 days', now() - interval '10 days' + interval '45 min',
          'honore')
  returning id into v_honore;

  -- Le motif est exigé par le modèle de l'agenda : une absence non excusée
  -- sans explication ne peut pas être constatée.
  insert into public.appointments
    (practice_id, patient_id, kind, starts_at, ends_at, attendance,
     attendance_note, billable)
  values ('a1111111-1111-4111-8111-111111111111',
          'a6000000-0000-4000-8000-000000000001', 'seance',
          now() - interval '9 days', now() - interval '9 days' + interval '45 min',
          'absent_non_excuse', 'Absence non prévenue.', false)
  returning id into v_absent;

  insert into public.appointments
    (practice_id, patient_id, kind, starts_at, ends_at)
  values ('a1111111-1111-4111-8111-111111111111',
          'a6000000-0000-4000-8000-000000000001', 'seance',
          now() + interval '3 days', now() + interval '3 days' + interval '45 min')
  returning id into v_avenir;

  insert into public.billing_documents (practice_id, kind, patient_id, payer_is_patient)
  values ('a1111111-1111-4111-8111-111111111111', 'facture',
          'a6000000-0000-4000-8000-000000000001', true) returning id into v_doc;
  insert into public.billing_lines
    (practice_id, document_id, position, label, unit_price_cents, quantity, amount_cents)
  values ('a1111111-1111-4111-8111-111111111111', v_doc, 1, 'Séances', 3230, 1, 3230)
  returning id into v_ligne;

  -- La séance réalisée se facture.
  insert into public.billing_line_appointments (practice_id, line_id, appointment_id)
  values ('a1111111-1111-4111-8111-111111111111', v_ligne, v_honore);

  -- L'absence non facturable, non : elle ne produit aucune ligne.
  perform tests.assert_fails(
    format('insert into public.billing_line_appointments
              (practice_id, line_id, appointment_id) values (%L, %L, %L)',
           'a1111111-1111-4111-8111-111111111111', v_ligne, v_absent),
    'Une absence non facturable ne doit produire aucune ligne de facture.');

  -- Un rendez-vous à venir non plus : son issue n'est pas constatée.
  perform tests.assert_fails(
    format('insert into public.billing_line_appointments
              (practice_id, line_id, appointment_id) values (%L, %L, %L)',
           'a1111111-1111-4111-8111-111111111111', v_ligne, v_avenir),
    'Un rendez-vous dont l''issue n''est pas constatée ne doit pas être facturable.');

  -- Le rendez-vous facturé ne peut plus être supprimé : la pièce en dépend.
  perform tests.assert_fails(
    format('delete from public.appointments where id = %L', v_honore),
    'Un rendez-vous facturé ne doit pas pouvoir être supprimé.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  8. Isolation
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as('b0000000-0000-4000-8000-000000000001'::uuid);
do $$
declare
  v_doc uuid;
begin
  -- Le cabinet B ne voit rien de A.
  perform tests.assert_rows(
    format('select 1 from public.billing_documents where practice_id = %L',
           'a1111111-1111-4111-8111-111111111111'),
    0, 'Le cabinet B ne doit voir aucune pièce du cabinet A.');

  -- Et ne peut pas facturer un patient de A.
  perform tests.assert_fails(
    format('insert into public.billing_documents (practice_id, kind, patient_id)
            values (%L, ''facture'', %L)',
           'b1111111-1111-4111-8111-111111111111',
           'a6000000-0000-4000-8000-000000000001'),
    'Facturer le patient d''un autre cabinet doit être refusé.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  9. Le catalogue est un référentiel, pas une source de vérité
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_item uuid; v_doc uuid; v_prix bigint;
begin
  insert into public.service_catalog_items
    (practice_id, label, unit_price_cents, nature)
  values ('a1111111-1111-4111-8111-111111111111', 'Séance individuelle', 3230, 'seance')
  returning id into v_item;

  insert into public.billing_documents (practice_id, kind, patient_id, payer_is_patient)
  values ('a1111111-1111-4111-8111-111111111111', 'facture',
          'a6000000-0000-4000-8000-000000000001', true) returning id into v_doc;

  -- La ligne COPIE les valeurs du catalogue.
  insert into public.billing_lines
    (practice_id, document_id, position, catalog_item_id, label,
     unit_price_cents, quantity, amount_cents)
  values ('a1111111-1111-4111-8111-111111111111', v_doc, 1, v_item,
          'Séance individuelle', 3230, 1, 3230);
  perform public.issue_billing_document(v_doc);

  -- Le tarif du catalogue change.
  update public.service_catalog_items set unit_price_cents = 4000 where id = v_item;

  -- La pièce émise ne bouge pas d'un centime.
  select unit_price_cents into v_prix from public.billing_lines where document_id = v_doc;
  perform tests.assert_equals(v_prix, 3230::bigint,
    'Modifier un tarif ne doit changer aucune pièce déjà établie.');

  -- Retirer l'entrée du catalogue ne casse pas la pièce non plus.
  delete from public.service_catalog_items where id = v_item;
  perform tests.assert_rows(
    format('select 1 from public.billing_lines
             where document_id = %L and catalog_item_id is null', v_doc),
    1, 'Supprimer une prestation du catalogue laisse la ligne intacte, sans provenance.');
  select unit_price_cents into v_prix from public.billing_lines where document_id = v_doc;
  perform tests.assert_equals(v_prix, 3230::bigint,
    'Et le tarif facturé demeure.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  10. Le payeur peut n'être ni le patient ni un responsable légal
-- ---------------------------------------------------------------------------
--  Circuit PCO : c'est un organisme qui règle, et la famille ne doit rien.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_doc uuid;
begin
  insert into public.billing_documents
    (practice_id, kind, patient_id, payer_contact_id, payer_is_patient,
     funding_scheme, pathway_id)
  values ('a1111111-1111-4111-8111-111111111111', 'facture',
          'a6000000-0000-4000-8000-000000000002',
          'a5000000-0000-4000-8000-000000000006', false,
          'pco', 'a7000000-0000-4000-8000-000000000002')
  returning id into v_doc;

  perform tests.assert_rows(
    format('select 1 from public.billing_documents
             where id = %L and payer_is_patient = false and funding_scheme = ''pco''', v_doc),
    1, 'Une pièce PCO doit pouvoir désigner un organisme payeur, distinct du patient.');

  -- Et le payeur désigné n'est ni le patient, ni l'un de ses responsables.
  perform tests.assert_rows(
    format('select 1 from public.patient_contacts
             where patient_id = %L and contact_id = %L
               and role in (''responsable_legal'', ''payeur'')',
           'a6000000-0000-4000-8000-000000000002',
           'a5000000-0000-4000-8000-000000000006'),
    0, 'Le payeur PCO n''est pas un responsable légal du patient.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  13. Un devis et une facture ne portent jamais le même numéro imprimé
-- ---------------------------------------------------------------------------
--  Les deux séries sont distinctes, donc l'unicité en base ne voit rien. Ce que
--  lit une famille, c'est le numéro imprimé : deux pièces différentes numérotées
--  pareil, remises le même jour, sont indiscernables une fois classées.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_devis uuid;
  v_facture uuid;
  v_nd text;
  v_nf text;
begin
  insert into public.billing_documents (practice_id, kind, patient_id)
  values ('a1111111-1111-4111-8111-111111111111', 'devis', 'a6000000-0000-4000-8000-000000000001') returning id into v_devis;
  insert into public.billing_lines
    (practice_id, document_id, position, label, unit_price_cents, amount_cents)
  values ('a1111111-1111-4111-8111-111111111111', v_devis, 1, 'Bilan psychomoteur', 20000, 20000);

  insert into public.billing_documents (practice_id, kind, patient_id)
  values ('a1111111-1111-4111-8111-111111111111', 'facture', 'a6000000-0000-4000-8000-000000000001') returning id into v_facture;
  insert into public.billing_lines
    (practice_id, document_id, position, label, unit_price_cents, amount_cents)
  values ('a1111111-1111-4111-8111-111111111111', v_facture, 1, 'Bilan psychomoteur', 20000, 20000);

  v_nd := public.issue_billing_document(v_devis);
  v_nf := public.issue_billing_document(v_facture);

  perform tests.assert(v_nd <> v_nf,
    'Un devis et une facture émis le même jour ne doivent pas porter le même numéro.');
  perform tests.assert(v_nd like 'D%',
    'Le numéro d''un devis doit se distinguer au premier coup d''œil.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  14. La date d'émission est celle qu'on donne, pas celle de l'horloge
-- ---------------------------------------------------------------------------
--  Une facture établie début octobre pour les séances de septembre doit pouvoir
--  porter sa vraie date. La v1 laissait l'année du numéro et le mois de
--  rattachement venir de deux sources différentes.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_doc uuid;
  v_num text;
  v_emis date;
  v_serie text;
begin
  insert into public.billing_documents (practice_id, kind, patient_id)
  values ('a1111111-1111-4111-8111-111111111111', 'facture', 'a6000000-0000-4000-8000-000000000001') returning id into v_doc;
  insert into public.billing_lines
    (practice_id, document_id, position, label, unit_price_cents, amount_cents)
  values ('a1111111-1111-4111-8111-111111111111', v_doc, 1, 'Séance de psychomotricité', 4500, 4500);

  v_num := public.issue_billing_document(v_doc, null, '{AAAA}-{MM}-{NNN}', date '2024-11-08');

  select issued_on, series into v_emis, v_serie
    from public.billing_documents where id = v_doc;

  perform tests.assert_equals(v_emis, date '2024-11-08',
    'La date d''émission fournie doit être celle de la pièce.');
  perform tests.assert_equals(v_serie, 'FACTURE-2024',
    'La série doit suivre l''année d''émission, pas l''année courante.');
  perform tests.assert(v_num like '2024-11-%',
    'Le numéro doit porter l''année et le mois de l''émission.');

  -- L'instantané se lit à cette date : une pièce ancienne ne doit pas se relire
  -- avec la configuration d'aujourd'hui.
  perform tests.assert_equals(
    (select snapshot ->> 'emis_le' from public.billing_documents where id = v_doc),
    '2024-11-08',
    'L''instantané doit être daté de l''émission.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  15. Un numéro déjà employé n'est pas réattribué
-- ---------------------------------------------------------------------------
--  La reprise des factures de la v1 réinstalle des numéros que le compteur n'a
--  jamais attribués. Le moteur doit passer au suivant, et non échouer ni
--  produire un doublon.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_ancienne uuid;
  v_doc uuid;
  v_num text;
begin
  -- Une pièce « héritée » portant le numéro que le compteur va proposer.
  insert into public.billing_documents
    (practice_id, kind, status, series, number, issued_on)
  values ('a1111111-1111-4111-8111-111111111111', 'facture', 'emis', 'ANCIENNE',
          to_char(current_date, 'YYYY') || '-001', current_date)
  returning id into v_ancienne;

  insert into public.billing_documents (practice_id, kind, patient_id)
  values ('a1111111-1111-4111-8111-111111111111', 'facture', 'a6000000-0000-4000-8000-000000000001') returning id into v_doc;
  insert into public.billing_lines
    (practice_id, document_id, position, label, unit_price_cents, amount_cents)
  values ('a1111111-1111-4111-8111-111111111111', v_doc, 1, 'Séance de psychomotricité', 4500, 4500);

  v_num := public.issue_billing_document(v_doc);

  perform tests.assert(v_num <> to_char(current_date, 'YYYY') || '-001',
    'Un numéro déjà porté par une autre pièce ne doit pas être réattribué.');
  perform tests.assert_rows(
    format('select 1 from public.billing_documents
             where practice_id = %L and number = %L', 'a1111111-1111-4111-8111-111111111111', v_num),
    1, 'Le numéro finalement attribué doit être unique dans le cabinet.');
end
$$;
rollback;
