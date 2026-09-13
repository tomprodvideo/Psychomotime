-- ============================================================================
--  110 — COURRIER DE LIAISON
--  Une page adressée à UN professionnel nommé. Ce qui est vérifié ici, c'est
--  qu'il ne peut pas se tromper de dossier, de destinataire ni de cabinet —
--  et qu'une fois remis, il ne change plus.
-- ============================================================================
\set ON_ERROR_STOP on

\set alpha  '''a0000000-0000-4000-8000-000000000001'''
\set beta   '''b0000000-0000-4000-8000-000000000001'''
\set cab_a  '''a1111111-1111-4111-8111-111111111111'''
\set cab_b  '''b1111111-1111-4111-8111-111111111111'''
\set zephyr '''a6000000-0000-4000-8000-000000000001'''

-- ---------------------------------------------------------------------------
--  1. Le cas normal : écrire, remettre, et ne plus pouvoir le réécrire
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_dest uuid;
  v_autre_dest uuid;
  v_lettre uuid;
  v_instantane jsonb;
begin
  select id into v_dest from public.contacts
   where practice_id = 'a1111111-1111-4111-8111-111111111111' limit 1;
  select id into v_autre_dest from public.contacts
   where practice_id = 'a1111111-1111-4111-8111-111111111111'
     and id <> v_dest limit 1;

  insert into public.liaison_letters
    (practice_id, patient_id, recipient_contact_id, subject, body)
  values ('a1111111-1111-4111-8111-111111111111',
          'a6000000-0000-4000-8000-000000000001', v_dest,
          'Demande d''avis', 'Je me permets de vous solliciter au sujet de…')
  returning id into v_lettre;

  perform public.issue_liaison_letter(v_lettre);

  select snapshot into v_instantane from public.liaison_letters where id = v_lettre;
  perform tests.assert(v_instantane is not null,
    'Un courrier remis fige ce qu''il porte.');
  perform tests.assert(v_instantane -> 'destinataire' ->> 'nom' is not null,
    'L''instantané nomme le destinataire : c''est à lui que le courrier est adressé.');
  perform tests.assert(v_instantane -> 'patient' ->> 'ne_le' is not null,
    'La date de naissance permet au confrère d''identifier la personne sans ambiguïté.');

  -- UN COURRIER REMIS NE SE RÉÉCRIT PAS.
  perform tests.assert_fails(
    format('update public.liaison_letters set body = ''Autre chose.'' where id = %L', v_lettre),
    'Un courrier remis ne se modifie pas : il est déjà chez son destinataire.');
  /* UN AUTRE contact, pas le même : réaffecter la même valeur ne modifie
   * rien, la garde ne voit rien, et le contrôle constaterait un succès sans
   * rien prouver. */
  perform tests.assert_fails(
    format('update public.liaison_letters set recipient_contact_id = %L where id = %L',
           v_autre_dest, v_lettre),
    'Un courrier remis ne change pas de destinataire.');
  perform tests.assert_fails(
    format('update public.liaison_letters set status = ''brouillon'' where id = %L', v_lettre),
    'Un courrier remis ne redevient pas un brouillon.');
  perform tests.assert_fails(
    format('delete from public.liaison_letters where id = %L', v_lettre),
    'Un courrier remis ne se supprime pas.');

  -- Il s'annule, AVEC UN MOTIF, et l'annulation ne se défait pas.
  perform tests.assert_fails(
    format('select public.cancel_liaison_letter(%L, ''   '')', v_lettre),
    'Une annulation sans motif n''apprend rien à qui a reçu le courrier.');
  perform public.cancel_liaison_letter(v_lettre, 'Erreur de destinataire.');
  perform tests.assert_fails(
    format('update public.liaison_letters set status = ''emis'' where id = %L', v_lettre),
    'Une annulation ne se défait pas.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  2. Il ne se trompe ni de dossier, ni de destinataire, ni de cabinet
-- ---------------------------------------------------------------------------
--  Le destinataire est la propriété qui DÉFINIT ce document. S'il pouvait
--  désigner le contact d'un autre cabinet, un contenu clinique partirait chez
--  un professionnel qui n'a rien à voir avec ce dossier.
begin;
do $$
declare
  v_dest_b uuid;
  v_patient_b uuid;
  v_dest_a uuid;
begin
  perform tests.authenticate_as('b0000000-0000-4000-8000-000000000001'::uuid);
  select id into v_dest_b from public.contacts
   where practice_id = 'b1111111-1111-4111-8111-111111111111' limit 1;
  select id into v_patient_b from public.patients
   where practice_id = 'b1111111-1111-4111-8111-111111111111' limit 1;
  reset role;

  perform tests.authenticate_as('a0000000-0000-4000-8000-000000000001'::uuid);
  select id into v_dest_a from public.contacts
   where practice_id = 'a1111111-1111-4111-8111-111111111111' limit 1;

  perform tests.assert_fails(
    format('insert into public.liaison_letters
              (practice_id, patient_id, recipient_contact_id, subject, body)
            values (%L, %L, %L, ''Objet'', ''Corps'')',
           'a1111111-1111-4111-8111-111111111111',
           'a6000000-0000-4000-8000-000000000001', v_dest_b),
    'Un courrier ne s''adresse pas au contact d''un autre cabinet.');

  perform tests.assert_fails(
    format('insert into public.liaison_letters
              (practice_id, patient_id, recipient_contact_id, subject, body)
            values (%L, %L, %L, ''Objet'', ''Corps'')',
           'a1111111-1111-4111-8111-111111111111', v_patient_b, v_dest_a),
    'Un courrier ne concerne pas le dossier d''un autre cabinet.');

  -- Ni objet vide, ni corps vide : un courrier sans texte n'est pas un courrier.
  perform tests.assert_fails(
    format('insert into public.liaison_letters
              (practice_id, patient_id, recipient_contact_id, subject, body)
            values (%L, %L, %L, ''  '', ''Corps'')',
           'a1111111-1111-4111-8111-111111111111',
           'a6000000-0000-4000-8000-000000000001', v_dest_a),
    'Un courrier porte un objet.');
  perform tests.assert_fails(
    format('insert into public.liaison_letters
              (practice_id, patient_id, recipient_contact_id, subject, body)
            values (%L, %L, %L, ''Objet'', ''   '')',
           'a1111111-1111-4111-8111-111111111111',
           'a6000000-0000-4000-8000-000000000001', v_dest_a),
    'Un courrier porte un texte.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  3. C'est un contenu clinique : l'assistant ne le lit pas
-- ---------------------------------------------------------------------------
--  Un assistant tient un agenda et une facturation. Ce qu'on écrit à un
--  confrère au sujet d'un patient n'est pas de son ressort — même règle que
--  pour les notes et les objectifs.
begin;
do $$
declare
  v_dest uuid;
begin
  /* Un assistant du cabinet A. Le jeu de démonstration n'en a pas : on en crée
   * un, sans quoi ce contrôle passerait parce que personne ne lit — et il faut
   * le créer AVANT de prendre un rôle, `auth.users` n'étant pas accessible à
   * un compte authentifié. */
  insert into auth.users (id, email)
  values ('a0000000-0000-4000-8000-0000000000a9', 'assistant-a@exemple-fictif.test')
  on conflict (id) do nothing;
  insert into public.practice_members (practice_id, user_id, role, status)
  values ('a1111111-1111-4111-8111-111111111111',
          'a0000000-0000-4000-8000-0000000000a9', 'assistant', 'active');

  perform tests.authenticate_as('a0000000-0000-4000-8000-000000000001'::uuid);
  select id into v_dest from public.contacts
   where practice_id = 'a1111111-1111-4111-8111-111111111111' limit 1;
  insert into public.liaison_letters
    (practice_id, patient_id, recipient_contact_id, subject, body)
  values ('a1111111-1111-4111-8111-111111111111',
          'a6000000-0000-4000-8000-000000000001', v_dest, 'Objet', 'Corps');

  reset role;
  perform tests.authenticate_as('a0000000-0000-4000-8000-0000000000a9'::uuid);
  perform tests.assert_rows(
    'select 1 from public.liaison_letters', 0,
    'Un assistant ne lit pas les courriers de liaison de son cabinet.');

  -- LE CONTRE-CONTRÔLE : la praticienne, elle, les lit.
  reset role;
  perform tests.authenticate_as('a0000000-0000-4000-8000-000000000001'::uuid);
  perform tests.assert_rows(
    'select 1 from public.liaison_letters', 1,
    'La praticienne lit ses courriers : sans quoi le refus ci-dessus ne prouverait rien.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  4. Le cabinet d'à côté n'en voit rien
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare v_dest uuid;
begin
  select id into v_dest from public.contacts
   where practice_id = 'a1111111-1111-4111-8111-111111111111' limit 1;
  insert into public.liaison_letters
    (practice_id, patient_id, recipient_contact_id, subject, body)
  values ('a1111111-1111-4111-8111-111111111111',
          'a6000000-0000-4000-8000-000000000001', v_dest,
          'Objet confidentiel', 'Corps confidentiel');

  reset role;
  perform tests.authenticate_as('b0000000-0000-4000-8000-000000000001'::uuid);
  perform tests.assert_rows(
    'select 1 from public.liaison_letters', 0,
    'Le cabinet voisin ne voit aucun courrier.');
end
$$;
rollback;
