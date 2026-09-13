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
  /* L'INSTANTANÉ LUI-MÊME. La garde le protégeait déjà ; rien ne le
   * DÉMONTRAIT — désarmer cette ligne-là ne faisait échouer aucun contrôle.
   * Or c'est l'instantané qui s'imprime : protéger le numéro et la date sans
   * le protéger lui laisserait réécrire le montant du document par la porte
   * de service, en laissant le numéro intact. */
  perform tests.assert_fails(
    format('update public.billing_documents
              set snapshot = jsonb_set(snapshot, ''{payeur,nom}'', ''"Autre payeur"'')
            where id = %L', v_doc),
    'L''instantané d''une pièce émise ne se réécrit pas.');
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

  /* L'AVOIR EST PARTIEL — 32,30 € sur 64,60 €. La facture reste donc ÉMISE.
   *
   * La première version de ce test exigeait l'inverse : il vérifiait que la
   * facture passait en « annulée par avoir » quel que soit le montant. Il
   * affirmait donc le défaut, et le rendait invisible. Une facture de 180 €
   * corrigée de 20 € sortait entièrement du chiffre d'affaires. */
  perform tests.assert_rows(
    format('select 1 from public.billing_documents
             where id = %L and status = ''emis''', v_facture),
    1, 'Un avoir PARTIEL ne doit pas annuler la facture : elle reste émise.');

  -- Et elle reste là : rien n'a été effacé.
  perform tests.assert_rows(
    format('select 1 from public.billing_documents where id = %L', v_facture),
    1, 'La facture d''origine est conservée.');

  -- L'avoir vient en déduction du solde.
  v_solde := public.document_balance_cents(v_facture);
  perform tests.assert_equals(v_solde, 3230::bigint,
    'L''avoir doit venir en déduction : 64,60 € moins 32,30 €.');

  -- Un SECOND avoir, qui achève de couvrir la facture : elle bascule alors.
  insert into public.billing_documents
    (practice_id, kind, patient_id, payer_is_patient,
     rectifies_id, rectifies_number, rectifies_issued_on, rectification_reason)
  values ('a1111111-1111-4111-8111-111111111111', 'avoir',
          'a6000000-0000-4000-8000-000000000001', true,
          v_facture, v_num, current_date, 'Seconde séance non due.')
  returning id into v_avoir;
  insert into public.billing_lines
    (practice_id, document_id, position, label, unit_price_cents, quantity, amount_cents)
  values ('a1111111-1111-4111-8111-111111111111', v_avoir, 1, 'Séance non due', 3230, 1, 3230);
  perform public.issue_billing_document(v_avoir);

  perform tests.assert_rows(
    format('select 1 from public.billing_documents
             where id = %L and status = ''annule_par_avoir''', v_facture),
    1, 'Des avoirs qui couvrent entièrement la facture l''annulent.');
  perform tests.assert_equals(public.document_balance_cents(v_facture), 0::bigint,
    'Une facture entièrement avoirée ne doit plus rien.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  16. Le solde d'une pièce ne franchit pas la frontière du cabinet
-- ---------------------------------------------------------------------------
--  `document_balance_cents` est `security definer` : elle s'exécute AU-DESSUS
--  de la RLS. Sans contrôle d'appartenance, elle rendait le solde d'une pièce
--  que la RLS refusait par ailleurs de montrer. Démontré en exécution par la
--  relecture de sécurité du lot 5.
begin;
do $$
declare
  v_doc uuid;
  v_cabinet_b uuid;
  v_patient_b uuid;
begin
  select p.id into v_cabinet_b from public.practices p
   where p.id <> 'a1111111-1111-4111-8111-111111111111' limit 1;
  select p.id into v_patient_b from public.patients p
   where p.practice_id = v_cabinet_b limit 1;

  -- La pièce naît brouillon, reçoit sa ligne, puis s'émet : les lignes d'une
  -- pièce déjà émise sont immuables, la garantie vaut aussi pour un test.
  insert into public.billing_documents
    (practice_id, kind, patient_id, payer_is_patient, status)
  values (v_cabinet_b, 'facture', v_patient_b, true, 'brouillon')
  returning id into v_doc;
  insert into public.billing_lines
    (practice_id, document_id, position, label, unit_price_cents, amount_cents)
  values (v_cabinet_b, v_doc, 1, 'Séance', 9000, 9000);
  update public.billing_documents
     set status = 'emis', number = 'TEST-CLOISON', series = 'TEST',
         issued_on = current_date
   where id = v_doc;

  -- Vue depuis le cabinet ALPHA : la RLS refuse déjà la pièce et ses lignes.
  perform tests.authenticate_as('a0000000-0000-4000-8000-000000000001'::uuid);

  perform tests.assert_rows(
    format('select 1 from public.billing_documents where id = %L', v_doc), 0,
    'La RLS doit refuser la pièce d''un autre cabinet.');
  perform tests.assert_rows(
    format('select 1 from public.billing_lines where document_id = %L', v_doc), 0,
    'La RLS doit refuser les lignes d''un autre cabinet.');

  -- ET LA FONCTION AUSSI. C'est le point : elle passait au-dessus.
  perform tests.assert_fails(
    format('select public.document_balance_cents(%L)', v_doc),
    'Le solde d''une pièce d''un autre cabinet ne doit pas être calculable.');

  -- Une pièce inexistante rend la MÊME réponse : distinguer les deux dirait à
  -- l'appelant que l'identifiant existe.
  perform tests.assert_fails(
    'select public.document_balance_cents(''00000000-0000-4000-8000-000000000000'')',
    'Une pièce inexistante ne doit pas se distinguer d''une pièce interdite.');
end
$$;
rollback;
