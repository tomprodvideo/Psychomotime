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

  insert into public.shared_links
    (practice_id, subject_type, subject_id, token_hash, token_hint, expires_at)
  values (p_cabinet, 'billing_document', v_doc,
          encode(sha256(convert_to(p_jeton, 'UTF8')), 'hex'),
          right(p_jeton, 4), p_expire)
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
  perform tests.assert(public.shared_document('court') is null,
    'Une chaîne trop courte est écartée sans même chercher.');
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
