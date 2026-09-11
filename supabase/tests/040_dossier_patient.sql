-- ============================================================================
--  040 — DOSSIER PATIENT, ENTOURAGE ET PARCOURS
--  Chaque scénario correspond à une situation que le modèle précédent ne savait
--  PAS représenter.
-- ============================================================================
\set ON_ERROR_STOP on

\set alpha     '''a0000000-0000-4000-8000-000000000001'''
\set assistant '''b0000000-0000-4000-8000-000000000002'''
\set zephyr    '''a6000000-0000-4000-8000-000000000001'''
\set capucine  '''a6000000-0000-4000-8000-000000000002'''
\set aristide  '''a6000000-0000-4000-8000-000000000003'''
\set mere      '''a5000000-0000-4000-8000-000000000001'''
\set pere      '''a5000000-0000-4000-8000-000000000002'''
\set cab_a     '''a1111111-1111-4111-8111-111111111111'''
\set cab_b     '''b1111111-1111-4111-8111-111111111111'''

-- ---------------------------------------------------------------------------
--  1. Deux responsables légaux, deux adresses, un seul contact partagé
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
begin
  perform tests.assert_rows(
    format('select 1 from public.patient_contacts
             where patient_id = %L and role = ''responsable_legal''
               and valid_to is null', 'a6000000-0000-4000-8000-000000000001'),
    2,
    'Un enfant doit pouvoir avoir DEUX titulaires de l''autorité parentale.');

  -- Les deux parents ont des adresses distinctes : c'est le cas de la garde
  -- alternée, qu'un objet JSON unique ne pouvait pas porter.
  perform tests.assert_rows(
    'select distinct c.address_line1
       from public.patient_contacts pc
       join public.contacts c on c.id = pc.contact_id
      where pc.patient_id = ''a6000000-0000-4000-8000-000000000001''
        and pc.role = ''responsable_legal''
        and c.address_line1 is not null',
    2,
    'Les deux responsables légaux doivent pouvoir avoir deux adresses.');

  -- La mère est le MÊME contact pour les deux enfants : une seule adresse à
  -- tenir à jour, pas deux copies qui divergent.
  perform tests.assert_rows(
    'select distinct patient_id from public.patient_contacts
      where contact_id = ''a5000000-0000-4000-8000-000000000001''
        and role = ''responsable_legal''',
    2,
    'Un même contact doit pouvoir être responsable légal de deux patients.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  2. Six rôles distincts, et non un seul champ « tuteur / parent »
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_payeur uuid;
  v_destinataires integer;
begin
  -- Le payeur n'est ni le patient, ni un responsable légal.
  select contact_id into v_payeur
  from public.patient_contacts
  where patient_id = 'a6000000-0000-4000-8000-000000000001'
    and role = 'payeur' and valid_to is null;

  perform tests.assert(v_payeur is not null, 'Un payeur doit pouvoir être désigné.');
  perform tests.assert_rows(
    format('select 1 from public.patient_contacts
             where patient_id = %L and contact_id = %L
               and role = ''responsable_legal''',
           'a6000000-0000-4000-8000-000000000001', v_payeur),
    0,
    'Le payeur ne doit PAS être automatiquement un responsable légal.');

  -- Les destinataires sont explicites, et peuvent être plusieurs.
  select count(*) into v_destinataires
  from public.patient_contacts
  where patient_id = 'a6000000-0000-4000-8000-000000000001'
    and role = 'destinataire' and valid_to is null;
  perform tests.assert_equals(v_destinataires, 2,
    'Les deux parents doivent pouvoir être destinataires.');

  -- Le payeur n'est destinataire d'aucun document.
  perform tests.assert_rows(
    format('select 1 from public.patient_contacts
             where patient_id = %L and contact_id = %L and role = ''destinataire''',
           'a6000000-0000-4000-8000-000000000001', v_payeur),
    0,
    'Payer ne doit pas donner le droit de recevoir un document clinique.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  3. Autorité parentale et protection d'un majeur ne se confondent pas
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_base text;
begin
  select legal_basis into v_base
  from public.patient_contacts
  where patient_id = 'a6000000-0000-4000-8000-000000000003'
    and role = 'responsable_legal' and valid_to is null;
  perform tests.assert_equals(v_base, 'curatelle',
    'La protection d''un majeur doit porter son propre fondement juridique.');

  select legal_basis into v_base
  from public.patient_contacts
  where patient_id = 'a6000000-0000-4000-8000-000000000001'
    and role = 'responsable_legal' and is_primary;
  perform tests.assert_equals(v_base, 'autorite_parentale',
    'L''autorité parentale doit être distincte d''une mesure de protection.');

  -- Un fondement juridique n'a aucun sens sur un rôle de payeur.
  perform tests.assert_fails(
    format('insert into public.patient_contacts
              (practice_id, patient_id, contact_id, role, legal_basis)
            values (%L, %L, %L, ''payeur'', ''tutelle_majeur'')',
           'a1111111-1111-4111-8111-111111111111',
           'a6000000-0000-4000-8000-000000000003',
           'a5000000-0000-4000-8000-000000000003'),
    'Un fondement juridique sur un rôle de payeur doit être refusé.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  4. Un lien retiré reste : savoir à qui l'on a écrit fait partie de la trace
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
begin
  perform tests.assert_rows(
    'select 1 from public.patient_contacts
      where patient_id = ''a6000000-0000-4000-8000-000000000002''
        and role = ''destinataire'' and valid_to is not null',
    1,
    'Un rôle de destinataire clos doit être conservé, pas effacé.');

  perform tests.assert_rows(
    'select 1 from public.patient_contacts
      where patient_id = ''a6000000-0000-4000-8000-000000000002''
        and role = ''destinataire'' and valid_to is null',
    1,
    'Un seul destinataire doit rester actif pour cette enfant.');

  -- Deux liens ACTIFS de même rôle pour le même couple sont impossibles :
  -- il faut clore le précédent.
  perform tests.assert_fails(
    format('insert into public.patient_contacts
              (practice_id, patient_id, contact_id, role, valid_from)
            values (%L, %L, %L, ''destinataire'', current_date)',
           'a1111111-1111-4111-8111-111111111111',
           'a6000000-0000-4000-8000-000000000002',
           'a5000000-0000-4000-8000-000000000001'),
    'Deux liens actifs de même rôle pour le même contact doivent être refusés.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  5. Un lien ne peut pas franchir la frontière d'un cabinet
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
begin
  -- Rattacher au dossier du cabinet A un contact du cabinet B, en fournissant
  -- son UUID exact. La RLS seule ne vérifie pas la cohérence des trois clés :
  -- c'est le déclencheur qui refuse.
  perform tests.assert_fails(
    format('insert into public.patient_contacts
              (practice_id, patient_id, contact_id, role)
            values (%L, %L, %L, ''proche'')',
           'a1111111-1111-4111-8111-111111111111',
           'a6000000-0000-4000-8000-000000000001',
           'b5000000-0000-4000-8000-000000000001'),
    'Rattacher un contact d''un autre cabinet doit être refusé.');

  perform tests.assert_fails(
    format('insert into public.care_pathways
              (practice_id, patient_id, label, status)
            values (%L, %L, ''intrusion'', ''demande'')',
           'a1111111-1111-4111-8111-111111111111',
           'b6000000-0000-4000-8000-000000000001'),
    'Ouvrir un parcours sur le patient d''un autre cabinet doit être refusé.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  6. Isolation complète entre cabinets sur les nouvelles tables
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  t text;
  v_n bigint;
begin
  foreach t in array array['patients', 'contacts', 'patient_contacts',
                           'care_pathways', 'care_objectives',
                           'patient_notes', 'patient_consents']
  loop
    execute format(
      'select count(*) from public.%I where practice_id = %L',
      t, 'b1111111-1111-4111-8111-111111111111') into v_n;
    perform tests.assert_equals(v_n, 0::bigint,
      format('Le cabinet A ne doit voir aucune ligne de %s appartenant à B.', t));
  end loop;

  -- Y compris en visant une ligne par son identifiant exact.
  perform tests.assert_rows(
    format('select 1 from public.patients where id = %L',
           'b6000000-0000-4000-8000-000000000001'),
    0,
    'Le patient du cabinet B ne doit pas être lisible par son UUID.');
  perform tests.assert_rows(
    'select 1 from public.patient_notes where body like ''%cabinet B%''',
    0,
    'Aucune note du cabinet B ne doit être lisible.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  7. L'assistant administratif ne lit pas le contenu clinique
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as(:assistant::uuid);
do $$
begin
  -- Il voit le dossier administratif de SON cabinet.
  perform tests.assert_rows('select 1 from public.patients', 1,
    'L''assistant doit voir les patients de son cabinet.');
  perform tests.assert_rows('select 1 from public.care_pathways', 1,
    'L''assistant doit voir les parcours, pour l''organisation.');

  -- Mais pas les notes ni les objectifs thérapeutiques.
  perform tests.assert_rows('select 1 from public.patient_notes', 0,
    'L''assistant ne doit lire AUCUNE note clinique.');
  perform tests.assert_rows('select 1 from public.care_objectives', 0,
    'L''assistant ne doit lire aucun objectif thérapeutique.');

  -- Et il n'écrit rien : le rôle est en lecture pour les données d'exercice.
  perform tests.assert_fails(
    format('insert into public.patients (practice_id, first_name, last_name)
            values (%L, ''Intrus'', ''Fictif'')',
           'b1111111-1111-4111-8111-111111111111'),
    'L''assistant ne doit pas pouvoir créer un patient.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  8. L1111-7 CSP : l'information venant d'un tiers est marquée
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
begin
  perform tests.assert_rows(
    'select 1 from public.patient_notes where third_party_information',
    1,
    'Une note issue d''un tiers doit pouvoir être marquée comme telle.');

  -- Cette note doit être exclue d'une communication de dossier au patient.
  -- On vérifie que LE TRI fonctionne, pas un compte exact : celui-ci dépend du
  -- jeu d'essai, qu'un autre lot peut légitimement enrichir.
  perform tests.assert(
    (select count(*) from public.patient_notes
      where patient_id = 'a6000000-0000-4000-8000-000000000001'
        and not third_party_information) > 0,
    'Des notes communicables doivent exister.');
  perform tests.assert(
    (select count(*) from public.patient_notes
      where patient_id = 'a6000000-0000-4000-8000-000000000001'
        and third_party_information) > 0,
    'Des notes non communicables doivent exister.');
  perform tests.assert_equals(
    (select count(*) from public.patient_notes
      where patient_id = 'a6000000-0000-4000-8000-000000000001'),
    (select count(*) from public.patient_notes
      where patient_id = 'a6000000-0000-4000-8000-000000000001'
        and third_party_information)
    + (select count(*) from public.patient_notes
        where patient_id = 'a6000000-0000-4000-8000-000000000001'
          and not third_party_information),
    'Le tri doit partitionner les notes sans en perdre ni en dupliquer.');

  -- Une source de tiers sans le marquage serait incohérente.
  perform tests.assert_fails(
    format('insert into public.patient_notes
              (practice_id, patient_id, body, third_party_source)
            values (%L, %L, ''note'', ''un tiers'')',
           'a1111111-1111-4111-8111-111111111111',
           'a6000000-0000-4000-8000-000000000001'),
    'Nommer une source tierce sans marquer l''information doit être refusé.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  9. Un consentement retiré reste visible
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
begin
  perform tests.assert_rows(
    'select 1 from public.patient_consents where withdrawn_on is not null',
    1,
    'Un consentement retiré doit rester dans le dossier.');
  perform tests.assert_rows(
    format('select 1 from public.patient_consents
             where patient_id = %L and withdrawn_on is null',
           'a6000000-0000-4000-8000-000000000001'),
    2,
    'Les consentements encore valides doivent être distinguables.');

  -- Un retrait ne peut pas précéder l'accord.
  perform tests.assert_fails(
    format('insert into public.patient_consents
              (practice_id, patient_id, kind, granted_on, withdrawn_on)
            values (%L, %L, ''photo_video'', date ''2026-05-01'', date ''2026-04-01'')',
           'a1111111-1111-4111-8111-111111111111',
           'a6000000-0000-4000-8000-000000000001'),
    'Un retrait antérieur à l''accord doit être refusé.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  10. Archivage : le dossier sort des listes actives sans être effacé
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_avant bigint;
  v_notes bigint;
begin
  select count(*) into v_notes from public.patient_notes
   where patient_id = 'a6000000-0000-4000-8000-000000000001';
  select count(*) into v_avant from public.patients where status = 'actif';
  perform tests.assert_equals(v_avant, 3::bigint,
    'Trois patients actifs, l''archivé n''en fait pas partie.');
  perform tests.assert_rows('select 1 from public.patients where status = ''archive''', 1,
    'Le patient archivé reste consultable.');

  -- Archiver clôt les parcours encore ouverts, mais n'efface rien.
  perform public.archive_patient(
    'a6000000-0000-4000-8000-000000000001', 'Test d''archivage.');

  perform tests.assert_rows(
    format('select 1 from public.patients where id = %L and status = ''archive''',
           'a6000000-0000-4000-8000-000000000001'),
    1, 'Le patient doit passer en archive.');
  perform tests.assert_rows(
    format('select 1 from public.care_pathways
             where patient_id = %L and status in (''actif'', ''demande'')',
           'a6000000-0000-4000-8000-000000000001'),
    0, 'Aucun parcours ne doit rester ouvert sur un dossier archivé.');
  -- On compare au compte relevé AVANT l'archivage : ce qui importe est que
  -- rien ne disparaisse, pas qu'il y en ait un nombre précis.
  perform tests.assert_equals(
    (select count(*) from public.patient_notes
      where patient_id = 'a6000000-0000-4000-8000-000000000001'),
    v_notes, 'Archiver n''efface aucune note.');
  perform tests.assert_rows(
    'select 1 from public.audit_events where action = ''patient.archive''',
    1, 'L''archivage doit laisser une trace au journal.');

  -- Le désarchivage ne rouvre pas les parcours : ce serait une décision
  -- clinique, pas une conséquence mécanique.
  perform public.unarchive_patient('a6000000-0000-4000-8000-000000000001');
  perform tests.assert_rows(
    format('select 1 from public.care_pathways
             where patient_id = %L and status = ''actif''',
           'a6000000-0000-4000-8000-000000000001'),
    0, 'Désarchiver ne doit pas rouvrir un parcours clos.');
end
$$;
rollback;

-- Archiver le patient d'un autre cabinet est refusé.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
begin
  perform tests.assert_fails(
    format('select public.archive_patient(%L)',
           'b6000000-0000-4000-8000-000000000001'),
    'Archiver le patient d''un autre cabinet doit être refusé.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  11. Contraintes d'intégrité du dossier
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
begin
  -- Un patient sans aucun nom ne sert à rien et rend le dossier introuvable.
  perform tests.assert_fails(
    format('insert into public.patients (practice_id, first_name, last_name)
            values (%L, ''  '', ''  '')',
           'a1111111-1111-4111-8111-111111111111'),
    'Un patient sans nom ni prénom doit être refusé.');

  -- Un contact « personne » sans nom, ou une organisation sans raison sociale.
  perform tests.assert_fails(
    format('insert into public.contacts (practice_id, kind) values (%L, ''personne'')',
           'a1111111-1111-4111-8111-111111111111'),
    'Un contact personne sans nom doit être refusé.');
  perform tests.assert_fails(
    format('insert into public.contacts (practice_id, kind, first_name)
            values (%L, ''organisation'', ''X'')',
           'a1111111-1111-4111-8111-111111111111'),
    'Une organisation sans raison sociale doit être refusée.');

  -- Un parcours terminé sans date de fin, ou l'inverse.
  perform tests.assert_fails(
    format('insert into public.care_pathways (practice_id, patient_id, status)
            values (%L, %L, ''termine'')',
           'a1111111-1111-4111-8111-111111111111',
           'a6000000-0000-4000-8000-000000000001'),
    'Un parcours terminé sans date de fin doit être refusé.');

  -- Un statut d'archive sans horodatage.
  perform tests.assert_fails(
    format('update public.patients set status = ''archive'' where id = %L',
           'a6000000-0000-4000-8000-000000000001'),
    'Passer en archive sans horodatage doit être refusé.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  12. Le parcours porte la prescription, pas le patient
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
begin
  -- Un même patient peut avoir plusieurs parcours, chacun avec sa prescription.
  perform tests.assert_rows(
    'select 1 from public.care_pathways where prescription_date is not null',
    4,
    'Chaque parcours doit pouvoir porter sa propre prescription.');

  -- Adresseur et prescripteur sont deux contacts différents.
  perform tests.assert_rows(
    format('select 1 from public.care_pathways
             where id = %L
               and referral_source_contact_id is distinct from prescriber_contact_id',
           'a7000000-0000-4000-8000-000000000001'),
    1,
    'L''adresseur et le prescripteur doivent pouvoir être deux personnes.');

  -- Un parcours PCO est un rattachement, pas une case sur une facture.
  perform tests.assert_rows(
    'select 1 from public.care_pathways where funding_scheme = ''pco''',
    1,
    'Le financement PCO doit être porté par le parcours.');
end
$$;
rollback;
