-- ============================================================================
--  030 — GARANTIES DU SOCLE
--  Création atomique d'un cabinet, dernier propriétaire, journal en ajout
--  seul, paramètres non réécrivables, abonnement.
-- ============================================================================
\set ON_ERROR_STOP on

-- ---------------------------------------------------------------------------
--  1. `create_practice` crée tout, ou rien
-- ---------------------------------------------------------------------------
begin;
insert into auth.users (id, email)
values ('e0000000-0000-4000-8000-000000000001', 'epsilon@exemple-fictif.test');
select tests.authenticate_as('e0000000-0000-4000-8000-000000000001'::uuid);

do $$
declare
  v_id uuid;
begin
  v_id := public.create_practice('Cabinet Test Éphémère');

  perform tests.assert_rows(
    format('select 1 from public.practices where id = %L', v_id), 1,
    'create_practice doit créer le cabinet.');
  perform tests.assert_rows(
    format('select 1 from public.practice_members
            where practice_id = %L and role = ''owner'' and status = ''active''', v_id), 1,
    'create_practice doit créer un propriétaire ACTIF dans la même transaction.');
  perform tests.assert_rows(
    format('select 1 from public.practitioner_profiles where practice_id = %L', v_id), 1,
    'create_practice doit créer le profil professionnel.');
  perform tests.assert_rows(
    format('select 1 from public.practice_subscriptions where practice_id = %L', v_id), 1,
    'create_practice doit ouvrir la période d''essai.');
  perform tests.assert_rows(
    format('select 1 from public.audit_events
            where practice_id = %L and action = ''practice.create''', v_id), 1,
    'create_practice doit laisser une trace au journal.');

  -- Un nom vide doit être refusé, sans laisser de cabinet orphelin.
  perform tests.assert_fails(
    'select public.create_practice(''   '')',
    'Un cabinet sans nom doit être refusé.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  2. Un cabinet ne peut pas perdre son dernier propriétaire
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as('a0000000-0000-4000-8000-000000000001'::uuid);
do $$
begin
  perform tests.assert_fails(
    format('delete from public.practice_members where id = %L',
           'a2222222-2222-4222-8222-222222222221'),
    'Supprimer l''unique propriétaire doit être refusé.');
  perform tests.assert_fails(
    format('update public.practice_members set status = ''revoked'' where id = %L',
           'a2222222-2222-4222-8222-222222222221'),
    'Révoquer l''unique propriétaire doit être refusé.');
  perform tests.assert_fails(
    format('update public.practice_members set role = ''readonly'' where id = %L',
           'a2222222-2222-4222-8222-222222222221'),
    'Rétrograder l''unique propriétaire doit être refusé.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  3. Le journal est en ajout seul
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as('a0000000-0000-4000-8000-000000000001'::uuid);
do $$
declare
  v_id bigint;
begin
  -- Le seul chemin d'écriture : la fonction, qui vérifie l'appartenance.
  v_id := public.log_audit_event(
    'a1111111-1111-4111-8111-111111111111', 'test.event', 'test', null,
    '{"note":"aucun contenu clinique"}'::jsonb);
  perform tests.assert(v_id is not null, 'log_audit_event doit rendre un identifiant.');

  perform tests.assert_fails(
    format('insert into public.audit_events (practice_id, action) values (%L, ''fraude'')',
           'a1111111-1111-4111-8111-111111111111'),
    'Écrire directement dans le journal doit être refusé.');
  -- Le journal ne reçoit AUCUN privilège UPDATE ni DELETE : PostgreSQL refuse
  -- avant même d'évaluer une politique. C'est plus fort qu'un filtrage muet,
  -- et c'est la SECONDE couche — la première étant l'absence de politique
  -- d'écriture. La migration 0004 a dû rétablir ce privilège après que les
  -- valeurs par défaut de Supabase l'eurent accordé silencieusement.
  perform tests.assert_fails(
    format('update public.audit_events set action = ''réécrit'' where id = %s', v_id),
    'Modifier une entrée de journal doit être impossible.');
  perform tests.assert_fails(
    format('delete from public.audit_events where id = %s', v_id),
    'Supprimer une entrée de journal doit être impossible.');

  -- Journaliser pour un cabinet dont on n'est pas membre est refusé.
  perform tests.assert_fails(
    format('select public.log_audit_event(%L, ''intrusion'')',
           'b1111111-1111-4111-8111-111111111111'),
    'Journaliser pour un cabinet tiers doit être refusé.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  4. Les paramètres datés ne se réécrivent pas
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as('a0000000-0000-4000-8000-000000000001'::uuid);
do $$
begin
  perform tests.assert_fails(
    'update public.practice_settings set settings = ''{}''::jsonb',
    'Une version de paramètres ne doit pas pouvoir être réécrite.');
  perform tests.assert_fails(
    'delete from public.practice_settings',
    'Une version de paramètres ne doit pas pouvoir être supprimée.');
  -- En revanche, en ajouter une nouvelle est le chemin normal.
  insert into public.practice_settings (practice_id, settings)
  values ('a1111111-1111-4111-8111-111111111111', '{"theme_color":"#334155"}'::jsonb);
  perform tests.assert_rows(
    'select 1 from public.practice_settings', 2,
    'Ajouter une version de paramètres doit rester possible.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  5. L'abonnement est une vérité de base, pas d'interface
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as('a0000000-0000-4000-8000-000000000001'::uuid);
do $$
begin
  perform tests.assert(
    app.subscription_is_active('a1111111-1111-4111-8111-111111111111'),
    'Le cabinet A est actif : l''accès doit être accordé.');
  perform tests.assert(
    app.subscription_is_active('b1111111-1111-4111-8111-111111111111'),
    'Le cabinet B est en essai non expiré : l''accès doit être accordé.');
end
$$;
rollback;

begin;
-- Essai expiré : l'accès tombe, sans intervention de l'application.
update public.practice_subscriptions
   set status = 'trialing', trial_ends_at = now() - interval '1 day'
 where practice_id = 'b1111111-1111-4111-8111-111111111111';
select tests.authenticate_as('b0000000-0000-4000-8000-000000000001'::uuid);
do $$
begin
  perform tests.assert(
    not app.subscription_is_active('b1111111-1111-4111-8111-111111111111'),
    'Un essai expiré ne doit plus donner accès.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  6. Un membre ne peut pas s'auto-activer ni se promouvoir
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as('b0000000-0000-4000-8000-000000000002'::uuid);
do $$
begin
  perform tests.assert_affects_nothing(
    format('update public.practice_members set role = ''owner'' where id = %L',
           'b2222222-2222-4222-8222-222222222222'),
    'Un assistant ne doit pas pouvoir se promouvoir propriétaire.');
  perform tests.assert_affects_nothing(
    format('update public.practice_subscriptions set status = ''active'', manual_override = true
            where practice_id = %L', 'b1111111-1111-4111-8111-111111111111'),
    'Un membre ne doit pas pouvoir s''auto-activer.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  7. Une seule configuration fiscale ouverte à la fois
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as('a0000000-0000-4000-8000-000000000001'::uuid);
do $$
begin
  perform tests.assert_fails(
    format('insert into public.fiscal_configurations
              (practice_id, valid_from, tax_regime)
            values (%L, date ''2027-01-01'', ''bnc_reel'')',
           'a1111111-1111-4111-8111-111111111111'),
    'Deux configurations fiscales ouvertes simultanément doivent être refusées.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  8. Les identifiants professionnels sont datés et exclusifs
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as('a0000000-0000-4000-8000-000000000001'::uuid);
do $$
begin
  -- Un identifiant se rattache soit au praticien, soit à l'entité juridique.
  perform tests.assert_fails(
    format('insert into public.professional_identifiers
              (practice_id, practitioner_profile_id, legal_entity_id, kind, value)
            values (%L, %L, %L, ''rpps'', ''x'')',
           'a1111111-1111-4111-8111-111111111111',
           'a3333333-3333-4333-8333-333333333331',
           'a4444444-4444-4444-8444-444444444441'),
    'Un identifiant rattaché aux deux à la fois doit être refusé.');

  perform tests.assert_fails(
    format('insert into public.professional_identifiers
              (practice_id, practitioner_profile_id, kind, value, valid_from, valid_to)
            values (%L, %L, ''rpps'', ''y'', date ''2026-01-01'', date ''2025-01-01'')',
           'a1111111-1111-4111-8111-111111111111',
           'a3333333-3333-4333-8333-333333333331'),
    'Une période de validité inversée doit être refusée.');

  -- L'ADELI du cabinet A porte bien une date de fin : un document ancien
  -- reste lisible avec l'identifiant qui valait à sa date. [A-13]
  perform tests.assert_rows(
    'select 1 from public.professional_identifiers
      where kind = ''adeli'' and valid_to is not null', 1,
    'L''ADELI doit porter une date de fin de validité.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  9. Supprimer un cabinet reste possible, malgré le garde du dernier
--     propriétaire
-- ---------------------------------------------------------------------------
--  Le garde-fou protège le dernier propriétaire ACTIF d'un cabinet qui
--  subsiste. Il ne doit pas rendre le cabinet lui-même indestructible : sans
--  cette distinction, un cabinet créé par erreur ne pouvait plus être nettoyé.
begin;
do $$
declare
  v_membres bigint;
begin
  -- Suppression directe, comme le ferait une opération d'administration.
  delete from public.practices where id = 'a1111111-1111-4111-8111-111111111111';

  select count(*) into v_membres from public.practice_members
   where practice_id = 'a1111111-1111-4111-8111-111111111111';
  perform tests.assert_equals(v_membres, 0::bigint,
    'La suppression du cabinet doit emporter ses appartenances.');

  perform tests.assert_rows(
    'select 1 from public.patients where practice_id = ''a1111111-1111-4111-8111-111111111111''',
    0, 'La suppression du cabinet doit emporter ses dossiers.');
end
$$;
rollback;

-- Mais un cabinet qui SUBSISTE garde son dernier propriétaire.
begin;
select tests.authenticate_as('a0000000-0000-4000-8000-000000000001'::uuid);
do $$
begin
  perform tests.assert_fails(
    format('delete from public.practice_members where id = %L',
           'a2222222-2222-4222-8222-222222222221'),
    'Retirer le dernier propriétaire d''un cabinet vivant reste refusé.');
end
$$;
rollback;
