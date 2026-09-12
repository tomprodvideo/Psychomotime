-- ============================================================================
--  100 — TRANSMISSIONS PAR LIEN
--  C'est la seule porte ouverte sans compte. Tout ici est écrit en supposant un
--  appelant qui ne possède qu'une chaîne de caractères.
-- ============================================================================
\set ON_ERROR_STOP on

\set alpha '''a0000000-0000-4000-8000-000000000001'''
\set cab_a '''a1111111-1111-4111-8111-111111111111'''
\set zephyr '''a6000000-0000-4000-8000-000000000001'''

-- Fabrique une facture émise et son lien. Rend le jeton en clair.
create or replace function pg_temp.facture_partagee(
  p_cabinet uuid, p_patient uuid, p_jeton text,
  p_expire timestamptz default now() + interval '30 days',
  p_snapshot jsonb default null,
  p_note_interne text default null
) returns uuid
language plpgsql as $$
declare
  v_doc uuid;
  v_lien uuid;
begin
  insert into public.billing_documents
    (practice_id, kind, patient_id, payer_is_patient, internal_note)
  values (p_cabinet, 'facture', p_patient, true, p_note_interne)
  returning id into v_doc;
  insert into public.billing_lines
    (practice_id, document_id, position, label, unit_price_cents, amount_cents)
  values (p_cabinet, v_doc, 1, 'Séance de psychomotricité', 4500, 4500);

  update public.billing_documents
     set status = 'emis', series = 'TEST', number = 'T-' || left(v_doc::text, 8),
         issued_on = current_date,
         snapshot = coalesce(p_snapshot, jsonb_build_object(
           'emis_le', current_date,
           'cabinet', jsonb_build_object('nom', 'Cabinet de test'),
           'patient', jsonb_build_object('nom', 'Patient de test')))
   where id = v_doc;

  /* La date de création est DÉDUITE de l'échéance quand celle-ci est passée :
   * la base borne désormais la validité, et un lien qui expire hier n'a pas pu
   * être créé aujourd'hui. C'est la forme réelle d'un lien périmé — créé il y
   * a quelque temps, pour une durée qui s'est écoulée. */
  insert into public.shared_links
    (practice_id, subject_type, subject_id, token_hash, token_hint,
     expires_at, created_at)
  values (p_cabinet, 'billing_document', v_doc,
          encode(sha256(convert_to(p_jeton, 'UTF8')), 'hex'),
          right(p_jeton, 4), p_expire,
          least(now(), p_expire - interval '30 days'))
  returning id into v_lien;

  return v_doc;
end;
$$;

-- ---------------------------------------------------------------------------
--  0. L'empreinte concorde avec celle que calcule TypeScript
-- ---------------------------------------------------------------------------
--  Le même vecteur d'essai figure dans `lib/transmissions/jeton.test.mts`. Si
--  l'un des deux côtés changeait d'algorithme ou d'encodage, tous les liens
--  déjà transmis cesseraient de fonctionner — en silence. Ce contrôle rend la
--  divergence bruyante des deux côtés.
do $$
begin
  perform tests.assert_equals(
    encode(sha256(convert_to('jeton-de-reference-pour-le-test-0123456789', 'UTF8')), 'hex'),
    '6c39241568e9aceb7f187da74d5575cd40703aec4aa71f1e14e7245a1aac87a6',
    'L''empreinte calculée par la base doit être celle que calcule TypeScript.');
end
$$;

-- ---------------------------------------------------------------------------
--  1. Le jeton n'est nulle part en clair
-- ---------------------------------------------------------------------------
--  C'est la garantie de fond : la base ne peut pas le redonner, donc aucune
--  liste, aucune charge de page, aucun export ne peut le faire fuiter.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_jeton text := 'jeton-fictif-de-test-0123456789abcdefgh';
begin
  perform pg_temp.facture_partagee('a1111111-1111-4111-8111-111111111111', 'a6000000-0000-4000-8000-000000000001', v_jeton);

  perform tests.assert_rows(
    format('select 1 from public.shared_links where token_hash = %L', v_jeton),
    0, 'Le jeton ne doit jamais être stocké en clair.');
  perform tests.assert_rows(
    format('select 1 from public.shared_links
             where token_hash = encode(sha256(convert_to(%L, ''UTF8'')), ''hex'')', v_jeton),
    1, 'Seule son empreinte est stockée.');

  -- L'indice n'aide pas : quatre caractères base64url, moins de 24 bits.
  perform tests.assert_rows(
    'select 1 from public.shared_links where length(token_hint) <= 8', 1,
    'L''indice de reconnaissance reste court.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  2. Inconnu, expiré, révoqué : la MÊME réponse
-- ---------------------------------------------------------------------------
--  Dire « ce lien a expiré » à qui tâtonne lui apprendrait qu'il a existé, et
--  pour quel cabinet.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_valide text := 'jeton-valide-fictif-0123456789abcdefgh';
  v_expire text := 'jeton-expire-fictif-0123456789abcdefgh';
  v_revoque text := 'jeton-revoque-fictif-0123456789abcdefg';
  v_doc uuid;
begin
  perform pg_temp.facture_partagee('a1111111-1111-4111-8111-111111111111', 'a6000000-0000-4000-8000-000000000001', v_valide);
  perform pg_temp.facture_partagee('a1111111-1111-4111-8111-111111111111', 'a6000000-0000-4000-8000-000000000001', v_expire,
                                   now() - interval '1 day');
  v_doc := pg_temp.facture_partagee('a1111111-1111-4111-8111-111111111111', 'a6000000-0000-4000-8000-000000000001', v_revoque);
  update public.shared_links set revoked_at = now()
   where subject_id = v_doc;

  reset role;
  perform tests.assert(public.shared_document(v_valide) is not null,
    'Un jeton valide doit rendre le document.');
  perform tests.assert(public.shared_document('jeton-qui-n-a-jamais-existe-0123456789') is null,
    'Un jeton inconnu ne rend rien.');
  perform tests.assert(public.shared_document(v_expire) is null,
    'Un jeton expiré ne rend rien — et rien ne le distingue d''un inconnu.');
  perform tests.assert(public.shared_document(v_revoque) is null,
    'Un jeton révoqué ne rend rien non plus.');
  /* Une chaîne trop courte rend `null` — mais un jeton INCONNU aussi : cette
   * assertion ne discriminait donc rien, et le garde-fou de longueur qu'elle
   * prétendait couvrir survivait à sa suppression. Elle est retirée ; le
   * garde-fou reste, comme économie d'un calcul d'empreinte. */
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  3. LE CONTRAT : rien d'autre que ce qui est imprimé ne sort
-- ---------------------------------------------------------------------------
--  LA LISTE DES CHAMPS PUBLICS EXISTAIT EN DOUBLE — une fois en SQL, une fois
--  en TypeScript — et le code admettait lui-même qu'aucun contrôle ne les
--  tenait alignées. Élargir la liste SQL seule ne faisait échouer aucun test.
--
--  Le remplacement n'est pas une seconde liste : c'est une SENTINELLE. On plante
--  une valeur reconnaissable dans chaque donnée qui ne doit PAS sortir, on
--  appelle le chemin public, et on exige qu'aucune ne s'y retrouve. Ajouter une
--  colonne ailleurs ne peut plus élargir le partage sans que ceci échoue.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_jeton text := 'jeton-sentinelle-fictif-0123456789abcd';
  v_doc uuid;
  v_public text;
begin
  -- Un instantané de pièce REPRISE DE LA v1 : il porte les estimations de
  -- rétrocession et d'URSSAF, le brut d'origine et la case PCO.
  v_doc := pg_temp.facture_partagee(
    'a1111111-1111-4111-8111-111111111111', 'a6000000-0000-4000-8000-000000000001', v_jeton, now() + interval '30 days',
    jsonb_build_object(
      'origine', 'reprise_v1',
      'emis_le', current_date,
      'cabinet', jsonb_build_object('nom', 'Cabinet de test'),
      'patient', jsonb_build_object('nom', 'Patient de test'),
      'estimations_v1', jsonb_build_object(
        'retrocession_centimes', 1300, 'urssaf_centimes', 2574,
        'note', 'RETROCESSIONSENTINELLE'),
      'brut_v1_centimes', 999999,
      'numero_v1', 'NUMEROV1SENTINELLE',
      'pco_v1', true),
    'NOTEINTERNESENTINELLE');

  update public.billing_documents
     set funding_scheme = 'pco' where id = v_doc;

  reset role;
  v_public := public.shared_document(v_jeton)::text;

  perform tests.assert(v_public is not null, 'Le document doit être servi.');

  -- Ce que le cabinet garde pour lui.
  perform tests.assert(v_public not like '%NOTEINTERNESENTINELLE%',
    'La note interne ne doit jamais sortir.');
  perform tests.assert(v_public not like '%RETROCESSIONSENTINELLE%',
    'Aucune donnée de rétrocession ne doit atteindre un document remis.');
  perform tests.assert(v_public not like '%2574%',
    'Aucune estimation URSSAF ne doit y figurer.');
  perform tests.assert(v_public not like '%999999%',
    'Le brut repris de la v1 n''a rien à y faire.');
  perform tests.assert(v_public not like '%NUMEROV1SENTINELLE%',
    'Le numéro d''origine v1 est une information interne.');

  -- LA DONNÉE DE SANTÉ. Le rattachement à une plateforme de coordination ne
  -- s'imprime pas sur un document remis à une famille.
  perform tests.assert(v_public not like '%pco%',
    'Le mode de financement PCO est une information de santé : il ne sort pas.');

  -- Les identifiants techniques.
  perform tests.assert(v_public not like '%' || v_doc::text || '%',
    'L''identifiant interne de la pièce ne sort pas.');
  perform tests.assert(v_public not like '%a1111111-1111-4111-8111-111111111111%',
    'L''identifiant du cabinet ne sort pas.');

  -- Et ce qui DOIT sortir, sort.
  perform tests.assert(v_public like '%Séance de psychomotricité%',
    'Le libellé de la prestation doit être servi.');
  perform tests.assert(v_public like '%4500%',
    'Le montant doit être servi.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  4. Chaque consultation est tracée, et rien de plus n'est su du lecteur
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_jeton text := 'jeton-trace-fictif-0123456789abcdefghi';
  v_doc uuid;
  v_colonnes text;
begin
  v_doc := pg_temp.facture_partagee('a1111111-1111-4111-8111-111111111111', 'a6000000-0000-4000-8000-000000000001', v_jeton);
  reset role;

  perform public.shared_document(v_jeton);
  perform public.shared_document(v_jeton);

  perform tests.assert_rows(
    format('select 1 from public.shared_link_accesses a
             join public.shared_links l on l.id = a.link_id
            where l.subject_id = %L', v_doc),
    2, 'Chaque consultation doit laisser une trace.');
  perform tests.assert_equals(
    (select access_count from public.shared_links where subject_id = v_doc), 2,
    'Le compteur du lien doit suivre.');

  -- NI ADRESSE IP, NI EMPREINTE DE NAVIGATEUR. Le destinataire n'a pas de
  -- compte et n'a rien demandé : le tracer plus finement serait le surveiller.
  select string_agg(column_name, ',' order by column_name) into v_colonnes
    from information_schema.columns
   where table_schema = 'public' and table_name = 'shared_link_accesses';
  perform tests.assert_equals(v_colonnes, 'accessed_at,id,link_id,practice_id',
    'Le journal de consultation n''enregistre que la date et le lien.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  5. Un brouillon ne se partage pas
-- ---------------------------------------------------------------------------
--  Il n'a ni numéro ni date : son destinataire le prendrait pour définitif.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_doc uuid;
begin
  insert into public.billing_documents (practice_id, kind, patient_id)
  values ('a1111111-1111-4111-8111-111111111111', 'facture', 'a6000000-0000-4000-8000-000000000001') returning id into v_doc;

  perform tests.assert_fails(
    format('insert into public.shared_links
              (practice_id, subject_type, subject_id, token_hash, token_hint, expires_at)
            values (%L, ''billing_document'', %L, repeat(''a'', 64), ''abcd'', now() + interval ''1 day'')',
           'a1111111-1111-4111-8111-111111111111', v_doc),
    'Un brouillon ne doit pas pouvoir être partagé.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  6. Un lien ne franchit pas la frontière du cabinet
-- ---------------------------------------------------------------------------
begin;
do $$
declare
  v_doc uuid;
begin
  perform tests.authenticate_as('b0000000-0000-4000-8000-000000000001'::uuid);
  select id into v_doc from public.patients
   where practice_id = 'b1111111-1111-4111-8111-111111111111' limit 1;
  v_doc := pg_temp.facture_partagee('b1111111-1111-4111-8111-111111111111',
                                    v_doc, 'jeton-du-cabinet-beta-0123456789abcd');

  perform tests.authenticate_as('a0000000-0000-4000-8000-000000000001'::uuid);
  perform tests.assert_rows(
    format('select 1 from public.shared_links where subject_id = %L', v_doc), 0,
    'Le lien d''un autre cabinet ne doit pas être lisible.');
  perform tests.assert_fails(
    format('insert into public.shared_links
              (practice_id, subject_type, subject_id, token_hash, token_hint, expires_at)
            values (%L, ''billing_document'', %L, repeat(''b'', 64), ''abcd'', now() + interval ''1 day'')',
           'a1111111-1111-4111-8111-111111111111', v_doc),
    'On ne fabrique pas un lien vers la pièce d''un autre cabinet.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  7. Un lien ne change ni de jeton ni de document
-- ---------------------------------------------------------------------------
--  Changer le jeton d'un lien déjà transmis reviendrait à en fabriquer un autre
--  sous le même compte rendu d'accès.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_doc uuid;
begin
  v_doc := pg_temp.facture_partagee('a1111111-1111-4111-8111-111111111111', 'a6000000-0000-4000-8000-000000000001',
                                    'jeton-immuable-fictif-0123456789abcd');
  perform tests.assert_fails(
    format('update public.shared_links set token_hash = repeat(''c'', 64)
             where subject_id = %L', v_doc),
    'L''empreinte d''un lien ne se réécrit pas.');
  perform tests.assert_fails(
    format('update public.shared_links set subject_type = ''attestation''
             where subject_id = %L', v_doc),
    'Un lien ne change pas de nature de document.');

  -- La révocation, elle, doit passer.
  update public.shared_links set revoked_at = now() where subject_id = v_doc;
  perform tests.assert_rows(
    format('select 1 from public.shared_links
             where subject_id = %L and revoked_at is not null', v_doc),
    1, 'Un lien doit pouvoir être révoqué.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  8. Le visiteur anonyme n'a QUE cette porte
-- ---------------------------------------------------------------------------
begin;
do $$
begin
  perform tests.assert(
    has_function_privilege('anon', 'public.shared_document(text)', 'execute'),
    'La lecture par jeton doit être ouverte sans compte : c''est son objet.');
  perform tests.assert(
    not has_function_privilege('anon', 'public.document_balance_cents_interne(uuid)', 'execute'),
    'Le solde sans contrôle d''appartenance ne s''ouvre à personne.');
  perform tests.assert(
    not has_function_privilege('authenticated', 'public.document_balance_cents_interne(uuid)', 'execute'),
    'Pas même à un utilisateur connecté : il a sa propre fonction, cloisonnée.');
  perform tests.assert_rows(
    'select 1 from information_schema.table_privileges
      where grantee = ''anon'' and table_schema = ''public''
        and table_name in (''shared_links'', ''shared_link_accesses'')',
    0, 'Un visiteur anonyme n''a aucun privilège sur les tables de partage.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  9. LA MÊME SENTINELLE SUR UNE ATTESTATION
-- ---------------------------------------------------------------------------
--  Le contrôle du contrat public n'exerçait QUE la branche facture. La branche
--  attestation — sept passe-plats d'instantané — n'était observée par rien :
--  y ajouter la note interne ne faisait échouer aucun des dix fichiers.
--
--  L'en-tête de la migration affirmait « ajouter une colonne quelque part ne
--  peut plus élargir le partage sans que le contrôle échoue ». C'était vrai
--  pour les factures et faux pour les attestations.
--
--  LE CONTRÔLE EST UN JEU DE CLÉS EXACT, pas une liste d'interdits. Une
--  sentinelle par chaîne ne voit que ce qu'on a pensé à interdire ; un jeu de
--  clés exact voit TOUT ajout, y compris celui qu'on n'a pas imaginé. Ce qui
--  suit échoue donc aussi bien sur une fuite que sur un enrichissement
--  légitime — et c'est voulu : le contrat public se modifie sciemment.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_att uuid;
  v_rdv uuid;
  v_doc uuid;
  v_pay uuid;
  v_jeton text := 'jeton-attestation-sentinelle-0123456789';
  v_public jsonb;
begin
  /* Une attestation de PAIEMENT, avec un règlement et une séance : c'est la
   * variante la plus chargée, donc celle où toutes les branches de projection
   * sont vivantes à la fois. */
  /* Le dossier fictif de Zéphyr n'a pas d'adresse. Sans elle, le contrôle de
   * réduction du patient ne prouverait rien — il n'y aurait rien à perdre.
   * On lui en donne une, et le contrôle suivant vérifie qu'elle est bien
   * entrée dans l'instantané avant d'affirmer qu'elle n'en ressort pas. */
  update public.patients
     set address_line1 = '4 impasse des Toupies', postal_code = '00000',
         city = 'Villefictive'
   where id = 'a6000000-0000-4000-8000-000000000001';

  insert into public.billing_documents (practice_id, kind, patient_id, payer_is_patient)
  values ('a1111111-1111-4111-8111-111111111111', 'facture',
          'a6000000-0000-4000-8000-000000000001', true) returning id into v_doc;
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

  insert into public.attestations
    (practice_id, kind, patient_id, internal_note)
  values ('a1111111-1111-4111-8111-111111111111', 'paiement',
          'a6000000-0000-4000-8000-000000000001', 'NOTEINTERNESENTINELLE')
  returning id into v_att;
  insert into public.attestation_payments
    (attestation_id, payment_id, practice_id, amount_cents)
  values (v_att, v_pay, 'a1111111-1111-4111-8111-111111111111', 9000);
  select appointment_id into v_rdv from public.realised_sessions
   where patient_id = 'a6000000-0000-4000-8000-000000000001' limit 1;
  insert into public.attestation_sessions (attestation_id, appointment_id, practice_id)
  values (v_att, v_rdv, 'a1111111-1111-4111-8111-111111111111');
  perform public.issue_attestation(v_att);

  insert into public.shared_links
    (practice_id, subject_type, subject_id, token_hash, token_hint, expires_at)
  values ('a1111111-1111-4111-8111-111111111111', 'attestation', v_att,
          encode(sha256(convert_to(v_jeton, 'UTF8')), 'hex'), 'cdef',
          now() + interval '30 days');

  reset role;
  v_public := public.shared_document(v_jeton);
  perform tests.assert(v_public is not null, 'L''attestation doit être servie.');

  -- Le jeu de clés servi, au caractère près.
  perform tests.assert_equals(
    (select string_agg(k, ',' order by k) from jsonb_object_keys(v_public) k),
    'destinataire,detail_nature,emetteur,emise_le,etat,factures,kind,mention,'
    || 'motif_annulation,nature,numero,patient,payeurs,periode_debut,periode_fin,'
    || 'reglements,seances,total_centimes',
    'Le contrat public d''une attestation est un jeu de clés arrêté.');

  /* LE PATIENT SE RÉDUIT À SON NOM ET SA NAISSANCE. L'instantané, lui, porte
   * bien son adresse, son code postal et sa ville : c'est ce que le passe-plat
   * transportait. Une attestation part chez un employeur ou une mutuelle —
   * c'est ce tiers-là qui détient le lien. */
  perform tests.assert_equals(
    (select string_agg(k, ',' order by k)
       from jsonb_object_keys(v_public -> 'patient') k),
    'ne_le,nom',
    'Sur le chemin public, le patient n''est qu''un nom et une date de naissance.');
  perform tests.assert(
    (select a.snapshot -> 'patient' ->> 'adresse' from public.attestations a
      where a.id = v_att) is not null,
    'Sans adresse dans l''instantané, le contrôle précédent ne prouverait rien.');

  /* LE MOYEN DE PAIEMENT NE SORT PAS. Que la famille ait réglé par chèque, en
   * espèces ou par virement ne regarde pas le destinataire de l'attestation. */
  perform tests.assert_equals(
    (select string_agg(k, ',' order by k)
       from jsonb_array_elements(v_public -> 'reglements') r,
            jsonb_object_keys(r) k),
    'date,montant_centimes',
    'Un règlement servi ne porte qu''une date et un montant.');
  perform tests.assert(
    (select a.snapshot -> 'reglements' -> 0 ->> 'moyen' from public.attestations a
      where a.id = v_att) = 'cheque',
    'Sans moyen de paiement dans l''instantané, le contrôle précédent serait vide.');

  -- Et ce qui doit sortir, sort.
  perform tests.assert(v_public::text like '%Zéphyr%',
    'Le nom du patient doit être servi : sans lui l''attestation n''atteste personne.');
  perform tests.assert(v_public::text not like '%NOTEINTERNESENTINELLE%',
    'La note interne d''une attestation ne doit jamais sortir.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  10. Un document sans émetteur ne se partage pas
-- ---------------------------------------------------------------------------
--  Les pièces reprises de la v1 n'ont pas d'instantané d'émetteur. Partagée
--  telle quelle, une de ces factures donnerait une page intitulée « FACTURE »,
--  numérotée, datée, avec un montant — et AUCUN nom de cabinet.
--
--  Le scénario 3 ne le voyait pas : sa fixture FABRIQUE un instantané portant
--  à la fois `origine: reprise_v1` et une clé `cabinet` — une forme qui
--  n'existe nulle part en production. Il validait sa propre mise en scène.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_doc uuid;
begin
  insert into public.billing_documents (practice_id, kind, patient_id, payer_is_patient)
  values ('a1111111-1111-4111-8111-111111111111', 'facture',
          'a6000000-0000-4000-8000-000000000001', true)
  returning id into v_doc;
  insert into public.billing_lines
    (practice_id, document_id, position, label, unit_price_cents, amount_cents)
  values ('a1111111-1111-4111-8111-111111111111', v_doc, 1, 'Séance', 4500, 4500);

  -- L'instantané EXACT d'une pièce reprise : ni cabinet, ni entité, ni
  -- identifiants, ni payeur. C'est la forme réelle produite par 0011.
  update public.billing_documents
     set status = 'emis', series = 'TEST', number = 'REPRISE-1',
         issued_on = current_date,
         snapshot = jsonb_build_object(
           'origine', 'reprise_v1',
           'emis_le', current_date,
           'patient', jsonb_build_object('nom', 'Marceline Cabriole'),
           'numero_v1', 'F2026-001',
           'estimations_v1', jsonb_build_object('urssaf_centimes', 0))
   where id = v_doc;

  perform tests.assert_fails(
    format('insert into public.shared_links
              (practice_id, subject_type, subject_id, token_hash, token_hint, expires_at)
            values (%L, ''billing_document'', %L, repeat(''d'', 64), ''abcd'', now() + interval ''30 days'')',
           'a1111111-1111-4111-8111-111111111111', v_doc),
    'Une pièce sans identité de cabinet ne doit pas pouvoir être partagée.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  11. Une révocation ne se défait pas, un compteur ne recule pas
-- ---------------------------------------------------------------------------
--  La clé anonyme est publique et un titulaire de session écrit directement
--  dans l'API : sans ces gardes, il pouvait ressusciter un lien retiré,
--  repousser son expiration et remettre le compteur à zéro. Le dispositif
--  existe pour constater qu'un document de santé a circulé ; la seule personne
--  qu'il pourrait mettre en cause ne doit pas pouvoir le défaire.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_doc uuid;
  v_lien uuid;
begin
  v_doc := pg_temp.facture_partagee('a1111111-1111-4111-8111-111111111111',
                                    'a6000000-0000-4000-8000-000000000001',
                                    'jeton-revocation-definitive-0123456789');
  select id into v_lien from public.shared_links where subject_id = v_doc;

  update public.shared_links set access_count = 5 where id = v_lien;
  perform tests.assert_fails(
    format('update public.shared_links set access_count = 0 where id = %L', v_lien),
    'Le compte des consultations ne doit pas pouvoir reculer.');

  update public.shared_links set revoked_at = now() where id = v_lien;
  perform tests.assert_fails(
    format('update public.shared_links set revoked_at = null where id = %L', v_lien),
    'Une révocation ne doit pas pouvoir être défaite.');
  perform tests.assert_fails(
    format('update public.shared_links set expires_at = now() + interval ''300 days''
             where id = %L', v_lien),
    'Un lien révoqué ne doit pas pouvoir être prolongé.');

  /* ET IL NE S'EFFACE PAS. Effacer la ligne effacerait la preuve, et rendrait
   * les consultations déjà journalisées orphelines. Le privilège `delete` a
   * été retiré : le refus vient du moteur, pas d'une politique qu'une
   * prochaine migration pourrait relâcher sans y penser. */
  perform tests.assert_fails(
    format('delete from public.shared_links where id = %L', v_lien),
    'Un lien ne doit pas pouvoir être supprimé : il porte le compte rendu des consultations.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  12. La validité est bornée EN BASE, pas seulement dans l'application
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_doc uuid;
begin
  insert into public.billing_documents (practice_id, kind, patient_id, payer_is_patient)
  values ('a1111111-1111-4111-8111-111111111111', 'facture',
          'a6000000-0000-4000-8000-000000000001', true) returning id into v_doc;
  insert into public.billing_lines
    (practice_id, document_id, position, label, unit_price_cents, amount_cents)
  values ('a1111111-1111-4111-8111-111111111111', v_doc, 1, 'Séance', 4500, 4500);
  update public.billing_documents
     set status = 'emis', series = 'T', number = 'T-BORNE', issued_on = current_date,
         snapshot = jsonb_build_object('cabinet', jsonb_build_object('nom', 'Cabinet de test'))
   where id = v_doc;

  perform tests.assert_fails(
    format('insert into public.shared_links
              (practice_id, subject_type, subject_id, token_hash, token_hint, expires_at)
            values (%L, ''billing_document'', %L, repeat(''e'', 64), ''abcd'',
                    now() + interval ''10 years'')',
           'a1111111-1111-4111-8111-111111111111', v_doc),
    'Un lien de dix ans n''est plus un lien de partage : la base doit le refuser.');

  perform tests.assert_fails(
    format('insert into public.shared_links
              (practice_id, subject_type, subject_id, token_hash, token_hint, expires_at)
            values (%L, ''billing_document'', %L, repeat(''f'', 64), ''abcd'',
                    now() - interval ''1 day'')',
           'a1111111-1111-4111-8111-111111111111', v_doc),
    'Un lien déjà expiré à sa création n''a pas de sens.');

  -- L'EMPREINTE FAIT 64 CARACTÈRES. C'est le seul garde-fou qui empêcherait
  -- qu'un jeton en clair — 43 caractères — soit stocké là par mégarde, et
  -- aucun contrôle ne le tenait.
  perform tests.assert_fails(
    format('insert into public.shared_links
              (practice_id, subject_type, subject_id, token_hash, token_hint, expires_at)
            values (%L, ''billing_document'', %L,
                    ''jeton-en-clair-de-43-caracteres-0123456789x'', ''abcd'',
                    now() + interval ''30 days'')',
           'a1111111-1111-4111-8111-111111111111', v_doc),
    'Seule une empreinte de 64 caractères entre dans `token_hash`.');

  perform tests.assert_fails(
    format('insert into public.shared_links
              (practice_id, subject_type, subject_id, token_hash, token_hint, expires_at)
            values (%L, ''billing_document'', %L, repeat(''0'', 64),
                    ''un-indice-beaucoup-trop-long'', now() + interval ''30 days'')',
           'a1111111-1111-4111-8111-111111111111', v_doc),
    'L''indice reste court : il ne doit pas pouvoir porter le jeton.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  13. Le frein existe, et le journal reste cloisonné
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_doc uuid;
  v_lien uuid;
  i integer;
  v_jeton text := 'jeton-du-frein-fictif-0123456789abcdefg';
begin
  v_doc := pg_temp.facture_partagee('a1111111-1111-4111-8111-111111111111',
                                    'a6000000-0000-4000-8000-000000000001', v_jeton);
  select id into v_lien from public.shared_links where subject_id = v_doc;

  /* 120 consultations dans l'heure, PAR LE VRAI CHEMIN. Le journal n'est
   * accessible en écriture à personne — pas même au cabinet : seule la
   * fonction publique y écrit. Fabriquer les lignes à la main aurait exigé de
   * relâcher ce privilège, c'est-à-dire de défaire ce qu'on vérifie. */
  reset role;
  for i in 1..120 loop
    perform public.shared_document(v_jeton);
  end loop;
  perform tests.assert_equals(
    (select access_count from public.shared_links where id = v_lien), 120,
    'Chaque consultation servie est comptée.');

  perform tests.assert_fails(
    format('select public.shared_document(%L)', v_jeton),
    'Au-delà du seuil, le service est refusé le temps que ça se calme.');

  -- Des consultations ANCIENNES ne comptent pas : la fenêtre glisse.
  update public.shared_link_accesses
     set accessed_at = now() - interval '2 hours' where link_id = v_lien;
  perform tests.assert(public.shared_document(v_jeton) is not null,
    'Passé l''heure, le lien redevient consultable : ce n''est pas un blocage définitif.');
end
$$;
rollback;

begin;
do $$
declare
  v_doc uuid;
begin
  -- Le journal d'un autre cabinet n'est pas lisible.
  perform tests.authenticate_as('b0000000-0000-4000-8000-000000000001'::uuid);
  select id into v_doc from public.patients
   where practice_id = 'b1111111-1111-4111-8111-111111111111' limit 1;
  v_doc := pg_temp.facture_partagee('b1111111-1111-4111-8111-111111111111', v_doc,
                                    'jeton-journal-cloisonne-0123456789abc');
  reset role;
  perform public.shared_document('jeton-journal-cloisonne-0123456789abc');

  perform tests.authenticate_as('a0000000-0000-4000-8000-000000000001'::uuid);
  perform tests.assert_rows(
    'select 1 from public.shared_link_accesses', 0,
    'Le journal de consultation d''un autre cabinet ne doit pas être lisible.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  14. LE BANDEAU D'ANNULATION NE PEUT PLUS MENTIR
-- ---------------------------------------------------------------------------
--  `status` est la SEULE entrée du bandeau « Cette facture a été annulée » que
--  voit le destinataire d'un lien. Il n'était mentionné par aucune des deux
--  gardes d'immuabilité. Démontré avant correction, session ordinaire :
--
--    emis -> annule_par_avoir : ACCEPTÉ, sans qu'aucun avoir existe
--    annule_par_avoir -> emis : ACCEPTÉ
--
--  Une facture valide arrivait chez une mutuelle barrée d'un bandeau
--  d'annulation, ou une facture annulée arrivait comme si elle valait encore.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_doc uuid;
  v_jeton text := 'jeton-du-statut-opposable-0123456789ab';
begin
  v_doc := pg_temp.facture_partagee('a1111111-1111-4111-8111-111111111111',
                                    'a6000000-0000-4000-8000-000000000001', v_jeton);

  perform tests.assert_fails(
    format('update public.billing_documents set status = ''annule_par_avoir''
             where id = %L', v_doc),
    'Une pièce ne doit pas pouvoir se déclarer annulée sans qu''un avoir existe.');
  perform tests.assert_fails(
    format('update public.billing_documents set status = ''remplace'' where id = %L', v_doc),
    'Une pièce ne doit pas pouvoir se déclarer remplacée sans pièce de remplacement.');
  perform tests.assert_fails(
    format('update public.billing_documents set status = ''brouillon'' where id = %L', v_doc),
    'Une pièce émise ne redevient pas un brouillon.');

  -- Et ce que le destinataire voit n'a pas bougé.
  reset role;
  perform tests.assert_equals(
    public.shared_document(v_jeton) ->> 'etat', 'emis',
    'L''état servi reste celui que les faits établissent.');
end
$$;
rollback;

begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_doc uuid;
  v_avoir uuid;
  v_jeton text := 'jeton-annulation-veritable-0123456789a';
begin
  v_doc := pg_temp.facture_partagee('a1111111-1111-4111-8111-111111111111',
                                    'a6000000-0000-4000-8000-000000000001', v_jeton);

  /* UN VRAI AVOIR, LUI, FAIT BASCULER LE STATUT. La garde vérifie un fait :
   * elle ne doit pas empêcher le fait de se produire. */
  -- Une pièce rectificative désigne sa cible sans équivoque : identifiant,
  -- numéro ET date. C'est la contrainte du moteur comptable.
  insert into public.billing_documents
    (practice_id, kind, patient_id, payer_is_patient,
     rectifies_id, rectifies_number, rectifies_issued_on, rectification_reason)
  select 'a1111111-1111-4111-8111-111111111111', 'avoir',
         'a6000000-0000-4000-8000-000000000001', true,
         d.id, d.number, d.issued_on, 'Erreur de montant'
    from public.billing_documents d where d.id = v_doc
  returning id into v_avoir;
  insert into public.billing_lines
    (practice_id, document_id, position, label, unit_price_cents, amount_cents)
  values ('a1111111-1111-4111-8111-111111111111', v_avoir, 1, 'Annulation', 4500, 4500);
  perform public.issue_billing_document(v_avoir);

  perform tests.assert_equals(
    (select status from public.billing_documents where id = v_doc), 'annule_par_avoir',
    'Un avoir émis annule bien la pièce qu''il rectifie.');

  -- ET L'ANNULATION NE SE DÉFAIT PAS.
  perform tests.assert_fails(
    format('update public.billing_documents set status = ''emis'' where id = %L', v_doc),
    'Une pièce annulée ne redevient pas valide.');

  reset role;
  perform tests.assert_equals(
    public.shared_document(v_jeton) ->> 'etat', 'annule_par_avoir',
    'Le destinataire voit l''annulation, parce qu''elle a réellement eu lieu.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  15. Une attestation annulée ne redevient pas émise
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_att uuid;
  v_rdv uuid;
begin
  insert into public.attestations (practice_id, kind, patient_id)
  values ('a1111111-1111-4111-8111-111111111111', 'presence',
          'a6000000-0000-4000-8000-000000000001') returning id into v_att;
  select appointment_id into v_rdv from public.realised_sessions
   where patient_id = 'a6000000-0000-4000-8000-000000000001' limit 1;
  insert into public.attestation_sessions (attestation_id, appointment_id, practice_id)
  values (v_att, v_rdv, 'a1111111-1111-4111-8111-111111111111');
  perform public.issue_attestation(v_att);

  -- Une annulation sans motif n'apprend rien à qui a reçu le document.
  perform tests.assert_fails(
    format('update public.attestations set status = ''annule'' where id = %L', v_att),
    'Une annulation d''attestation exige un motif.');

  perform public.cancel_attestation(v_att, 'Erreur de période');
  perform tests.assert_fails(
    format('update public.attestations set status = ''emis'' where id = %L', v_att),
    'Une attestation annulée ne redevient pas émise — elle porterait son motif d''annulation tout en se déclarant valide.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  16. LE CONTRAT PUBLIC D'UNE FACTURE, jeu de clés exact
-- ---------------------------------------------------------------------------
--  La branche attestation était épinglée ainsi ; la branche facture ne l'était
--  que par des sentinelles de chaîne. Une mutation remplaçant le patient projeté
--  par l'instantané brut — donc rendant son adresse — survivait à toute la
--  suite : la fixture n'avait rien planté à cet endroit-là.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_doc uuid;
  v_jeton text := 'jeton-du-jeu-de-cles-facture-01234567';
  v_p jsonb;
begin
  update public.patients
     set address_line1 = '4 impasse des Toupies', postal_code = '00000',
         city = 'Villefictive'
   where id = 'a6000000-0000-4000-8000-000000000001';

  /* ÉMISSION RÉELLE, pas l'instantané fabriqué par l'auxiliaire de ce fichier.
   * C'est `issue_billing_document` qui fige l'instantané, et lui seul y met
   * l'adresse du patient — sans quoi le contre-contrôle plus bas ne prouverait
   * rien et le jeu de clés porterait sur une forme qui n'existe pas. */
  insert into public.billing_documents
    (practice_id, kind, patient_id, payer_is_patient, internal_note)
  values ('a1111111-1111-4111-8111-111111111111', 'facture',
          'a6000000-0000-4000-8000-000000000001', true, 'NOTEINTERNE')
  returning id into v_doc;
  insert into public.billing_lines
    (practice_id, document_id, position, label, unit_price_cents, amount_cents)
  values ('a1111111-1111-4111-8111-111111111111', v_doc, 1, 'Séance', 4500, 4500);
  perform public.issue_billing_document(v_doc);
  insert into public.shared_links
    (practice_id, subject_type, subject_id, token_hash, token_hint, expires_at)
  values ('a1111111-1111-4111-8111-111111111111', 'billing_document', v_doc,
          encode(sha256(convert_to(v_jeton, 'UTF8')), 'hex'), 'abcd',
          now() + interval '30 days');

  reset role;
  v_p := public.shared_document(v_jeton);

  perform tests.assert_equals(
    (select string_agg(k, ',' order by k) from jsonb_object_keys(v_p) k),
    'acquittee_le,destinataire,echeance,emetteur,emise_le,etat,kind,lignes,'
    || 'mention,nature,numero,patient,periode_debut,periode_fin,'
    || 'rectification_motif,rectifie_emise_le,rectifie_numero,total_centimes,'
    || 'valable_jusqu_au',
    'Le contrat public d''une facture est un jeu de clés arrêté.');

  perform tests.assert_equals(
    (select string_agg(k, ',' order by k)
       from jsonb_object_keys(v_p -> 'emetteur') k),
    'cabinet,entite,identifiants',
    'L''émetteur servi est un jeu de clés arrêté.');

  perform tests.assert_equals(
    (select string_agg(k, ',' order by k) from jsonb_object_keys(v_p -> 'patient') k),
    'nom',
    'Sur une facture, le patient n''est qu''un nom — son adresse est dans l''instantané et n''en sort pas.');

  perform tests.assert_equals(
    (select string_agg(k, ',' order by k)
       from jsonb_object_keys(v_p -> 'lignes' -> 0) k),
    'dates,intro,libelle,montant_centimes,note,prix_unitaire_centimes,quantite,'
    || 'rendu_dates,tarification,tva',
    'Une ligne servie est un jeu de clés arrêté.');

  -- Le contre-contrôle : sans adresse dans l'instantané, rien n'est prouvé.
  perform tests.assert(
    (select d.snapshot -> 'patient' ->> 'adresse' from public.billing_documents d
      where d.id = v_doc) is not null,
    'Sans adresse figée dans l''instantané, le contrôle précédent serait vide.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  17. L'entrée de la seule porte anonyme est bornée des deux côtés
-- ---------------------------------------------------------------------------
--  Elle ne l'était que par le bas. Mesuré : un jeton invalide de 43 caractères
--  coûte 9,6 µs, le même de 8 Mo coûte 23,3 ms. Un facteur 2 400, offert sans
--  compte, sur la base qui sert les dossiers.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_avant bigint;
  v_doc uuid;
  v_long text := repeat('z', 200);
begin
  v_doc := pg_temp.facture_partagee('a1111111-1111-4111-8111-111111111111',
                                    'a6000000-0000-4000-8000-000000000001',
                                    'jeton-de-reference-borne-0123456789ab');
  reset role;
  select count(*) into v_avant from public.shared_link_accesses;
  perform tests.authenticate_as('a0000000-0000-4000-8000-000000000001'::uuid);

  /* LE CONTRÔLE DOIT DISCRIMINER. Un jeton démesuré et INCONNU rend `null`
   * dans les deux cas — avec ou sans borne haute — parce qu'aucune empreinte
   * ne lui correspond. L'affirmer ne prouverait rien : c'est le piège dans
   * lequel une première version de ce fichier était tombée.
   *
   * On fabrique donc un lien dont le jeton est RÉELLEMENT trop long, et dont
   * l'empreinte est en base. Sans la borne, il serait servi. */
  insert into public.shared_links
    (practice_id, subject_type, subject_id, token_hash, token_hint, expires_at)
  values ('a1111111-1111-4111-8111-111111111111', 'billing_document', v_doc,
          encode(sha256(convert_to(v_long, 'UTF8')), 'hex'), 'long',
          now() + interval '30 days');

  reset role;
  perform tests.assert(public.shared_document(v_long) is null,
    'Un jeton de 200 caractères n''est pas un jeton : il est écarté avant même qu''on calcule son empreinte.');
  perform tests.assert(public.shared_document('court') is null,
    'En deçà de 16 caractères non plus.');

  perform tests.assert_equals(
    (select count(*) from public.shared_link_accesses), v_avant,
    'Une entrée écartée ne laisse aucune trace dans le journal.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  18. Qui a transmis, qui a retiré — et un journal que nul n'écrit à la main
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_doc uuid;
  v_lien uuid;
begin
  v_doc := pg_temp.facture_partagee('a1111111-1111-4111-8111-111111111111',
                                    'a6000000-0000-4000-8000-000000000001',
                                    'jeton-imputabilite-0123456789abcdefg');
  select id into v_lien from public.shared_links where subject_id = v_doc;

  perform tests.assert_equals(
    (select created_by from public.shared_links where id = v_lien),
    'a0000000-0000-4000-8000-000000000001'::uuid,
    'La ligne du lien dit qui a transmis le document.');

  /* LA DATE DE CRÉATION NE BOUGE PAS, et c'est elle qui rend le plafond de
   * validité opposable : la ré-ancrer à `now()` rouvrirait la fenêtre des
   * 400 jours autant de fois qu'on veut, et un lien deviendrait perpétuel. */
  /* `now()` ne bouge pas dans une transaction : posée telle quelle, la nouvelle
   * valeur aurait été IDENTIQUE à l'ancienne, la garde n'aurait rien vu, et le
   * contrôle aurait constaté un succès sans rien prouver. Une heure d'écart
   * suffit à rendre la modification réelle, et reste dans les bornes de
   * validité — c'est donc bien la garde, et elle seule, qui refuse. */
  perform tests.assert_fails(
    format('update public.shared_links set created_at = now() + interval ''1 hour''
             where id = %L', v_lien),
    'La date de création d''un lien ne se ré-ancre pas : le plafond de validité en dépend.');

  -- LE JOURNAL NE S'ÉCRIT PAS À LA MAIN, pas même par le cabinet.
  perform tests.assert_fails(
    format('insert into public.shared_link_accesses (link_id, practice_id)
            values (%L, %L)', v_lien, 'a1111111-1111-4111-8111-111111111111'),
    'Le cabinet ne doit pas pouvoir fabriquer une consultation.');
  perform tests.assert_fails(
    format('delete from public.shared_link_accesses where link_id = %L', v_lien),
    'Le cabinet ne doit pas pouvoir effacer une consultation.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  19. UN DEVIS PARTAGÉ PORTE SA VALIDITÉ
-- ---------------------------------------------------------------------------
--  `valid_until` est la seule date qui rend un devis opposable, et l'imprimé
--  la porte — « Valable jusqu'au … ». Elle ne figurait pas au contrat public :
--  un devis transmis par lien arrivait sans elle, alors que le même devis
--  imprimé l'affichait. Deux versions d'une même pièce numérotée.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_doc uuid;
  v_jeton text := 'jeton-du-devis-partage-0123456789abc';
  v_p jsonb;
  v_echeance date := current_date + 45;
begin
  insert into public.billing_documents
    (practice_id, kind, patient_id, payer_is_patient, valid_until)
  values ('a1111111-1111-4111-8111-111111111111', 'devis',
          'a6000000-0000-4000-8000-000000000001', true, v_echeance)
  returning id into v_doc;
  insert into public.billing_lines
    (practice_id, document_id, position, label, unit_price_cents, amount_cents)
  values ('a1111111-1111-4111-8111-111111111111', v_doc, 1, 'Bilan', 25000, 25000);
  perform public.issue_billing_document(v_doc);

  insert into public.shared_links
    (practice_id, subject_type, subject_id, token_hash, token_hint, expires_at)
  values ('a1111111-1111-4111-8111-111111111111', 'billing_document', v_doc,
          encode(sha256(convert_to(v_jeton, 'UTF8')), 'hex'), 'devi',
          now() + interval '30 days');

  reset role;
  v_p := public.shared_document(v_jeton);
  perform tests.assert_equals(v_p ->> 'kind', 'devis',
    'Un devis se partage : le titre de la page en dépend.');
  perform tests.assert_equals(
    (v_p ->> 'valable_jusqu_au')::date, v_echeance,
    'Un devis transmis porte la date jusqu''à laquelle il engage.');

  -- Le contre-contrôle : une facture, elle, n'a pas de validité — la
  -- contrainte du modèle l'interdit — et la clé reste donc nulle.
  perform tests.assert(
    (select valid_until from public.billing_documents
      where kind = 'facture' and practice_id = 'a1111111-1111-4111-8111-111111111111'
      limit 1) is null,
    'Seul un devis porte une validité : sans cela, le contrôle ci-dessus ne distinguerait rien.');
end
$$;
rollback;
