-- ============================================================================
--  020 — ISOLATION ENTRE CABINETS
--  Le membre d'un cabinet ne doit accéder à RIEN de l'autre, y compris en
--  fournissant l'UUID exact d'une ligne. [C-02]
-- ============================================================================
\set ON_ERROR_STOP on

\set alpha    '''a0000000-0000-4000-8000-000000000001'''
\set beta     '''b0000000-0000-4000-8000-000000000001'''
\set gamma    '''c0000000-0000-4000-8000-000000000001'''
\set cab_a    '''a1111111-1111-4111-8111-111111111111'''
\set cab_b    '''b1111111-1111-4111-8111-111111111111'''
\set membre_b '''b2222222-2222-4222-8222-222222222221'''
\set entite_b '''b4444444-4444-4444-8444-444444444441'''

-- ---------------------------------------------------------------------------
--  Le stub doit d'abord se comporter comme Supabase, sinon tout le reste de
--  ce fichier ne prouve rien.
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
begin
  perform tests.assert_equals(current_user::text, 'authenticated',
    'Le rôle courant doit être `authenticated` après authenticate_as.');
  perform tests.assert_equals(auth.uid()::text, 'a0000000-0000-4000-8000-000000000001',
    'auth.uid() doit rendre l''utilisateur simulé.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  1. Lecture — Alpha ne voit que son cabinet
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
begin
  perform tests.assert_rows('select * from public.practices', 1,
    'Alpha ne doit voir que son propre cabinet.');
  perform tests.assert_rows(
    format('select * from public.practices where id = %L', 'b1111111-1111-4111-8111-111111111111'), 0,
    'Alpha ne doit pas voir le cabinet B, même en fournissant son UUID exact.');
  perform tests.assert_rows(
    format('select * from public.practice_members where practice_id = %L', 'b1111111-1111-4111-8111-111111111111'), 0,
    'Alpha ne doit voir aucun membre du cabinet B.');
  perform tests.assert_rows(
    format('select * from public.legal_entities where id = %L', 'b4444444-4444-4444-8444-444444444441'), 0,
    'Alpha ne doit pas voir l''entité juridique du cabinet B.');
  perform tests.assert_rows('select * from public.fiscal_configurations', 1,
    'Alpha ne doit voir que sa propre configuration fiscale.');
  perform tests.assert_rows('select * from public.professional_identifiers', 3,
    'Alpha ne doit voir que les identifiants de son cabinet.');
  perform tests.assert_rows('select * from public.practitioner_profiles', 1,
    'Alpha ne doit voir que le profil de son cabinet.');
  perform tests.assert_rows('select * from public.practice_locations', 1,
    'Alpha ne doit voir que son lieu d''exercice.');
  perform tests.assert_rows('select * from public.practice_settings', 1,
    'Alpha ne doit voir que ses propres paramètres.');
  perform tests.assert_rows('select * from public.practice_subscriptions', 1,
    'Alpha ne doit voir que son propre abonnement.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  2. Écriture — Alpha ne peut rien modifier chez B
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
begin
  perform tests.assert_affects_nothing(
    format('update public.practices set name = ''détourné'' where id = %L',
           'b1111111-1111-4111-8111-111111111111'),
    'Alpha ne doit pouvoir renommer aucun cabinet de B.');

  perform tests.assert_affects_nothing(
    format('update public.fiscal_configurations set retrocession_rate_bp = 9999 where practice_id = %L',
           'b1111111-1111-4111-8111-111111111111'),
    'Alpha ne doit pouvoir modifier aucun taux de B.');

  perform tests.assert_affects_nothing(
    format('delete from public.practice_members where id = %L',
           'b2222222-2222-4222-8222-222222222221'),
    'Alpha ne doit pouvoir révoquer aucun membre de B.');

  -- Un INSERT qui viole WITH CHECK lève, lui, une erreur franche.
  perform tests.assert_fails(
    format('insert into public.practice_members (practice_id, user_id, role, status)
            values (%L, %L, ''owner'', ''active'')',
           'b1111111-1111-4111-8111-111111111111',
           'a0000000-0000-4000-8000-000000000001'),
    'Alpha ne doit pas pouvoir s''ajouter comme propriétaire du cabinet B.');

  perform tests.assert_fails(
    format('insert into public.practice_locations (practice_id, label) values (%L, ''intrus'')',
           'b1111111-1111-4111-8111-111111111111'),
    'Alpha ne doit pas pouvoir créer un lieu d''exercice chez B.');

  perform tests.assert_fails(
    format('insert into public.practice_settings (practice_id, settings) values (%L, ''{}''::jsonb)',
           'b1111111-1111-4111-8111-111111111111'),
    'Alpha ne doit pas pouvoir écrire les paramètres de B.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  3. Un utilisateur sans appartenance ne voit rien du tout
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as(:gamma::uuid);
do $$
declare
  t record;
  v_sum bigint := 0;
  v_n bigint;
begin
  for t in
    select tablename from pg_tables
    where schemaname = 'public' and tablename <> 'platform_admins'
  loop
    execute format('select count(*) from public.%I', t.tablename) into v_n;
    v_sum := v_sum + v_n;
  end loop;
  perform tests.assert_equals(v_sum, 0::bigint,
    'Un utilisateur sans appartenance ne doit voir aucune ligne, sur aucune table.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  4. Un visiteur anonyme n'a aucun privilège
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as_anon();
do $$
declare
  t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public'
  loop
    perform tests.assert_fails(
      format('select 1 from public.%I limit 1', t.tablename),
      format('anon ne doit avoir aucun privilège sur public.%s.', t.tablename));
  end loop;
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  5. L'administrateur de plateforme ne franchit pas la frontière métier
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as('d0000000-0000-4000-8000-000000000001'::uuid);
do $$
begin
  perform tests.assert_rows('select * from public.practice_subscriptions', 2,
    'L''administrateur de plateforme doit voir les abonnements des deux cabinets.');
  perform tests.assert_rows('select * from public.practices', 0,
    'L''administrateur de plateforme ne doit voir AUCUN cabinet.');
  perform tests.assert_rows('select * from public.practitioner_profiles', 0,
    'L''administrateur de plateforme ne doit voir aucun profil de praticien.');
  perform tests.assert_rows('select * from public.legal_entities', 0,
    'L''administrateur de plateforme ne doit voir aucune entité juridique.');
  perform tests.assert_rows('select * from public.audit_events', 0,
    'L''administrateur de plateforme ne doit voir aucun journal de cabinet.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  6. Le rôle « assistant » lit mais n'administre pas
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as('b0000000-0000-4000-8000-000000000002'::uuid);
do $$
begin
  perform tests.assert_rows('select * from public.practices', 1,
    'L''assistant doit voir son cabinet.');
  perform tests.assert_affects_nothing(
    format('update public.practices set name = ''renommé par l''''assistant'' where id = %L',
           'b1111111-1111-4111-8111-111111111111'),
    'L''assistant ne doit pas pouvoir renommer le cabinet.');
  perform tests.assert_fails(
    format('insert into public.practice_members (practice_id, user_id, role, status)
            values (%L, %L, ''owner'', ''active'')',
           'b1111111-1111-4111-8111-111111111111',
           'c0000000-0000-4000-8000-000000000001'),
    'L''assistant ne doit pas pouvoir inviter un membre.');
  -- Une UPDATE refusée par le USING d'une politique n'échoue pas : elle ne
  -- voit aucune ligne. C'est le compte de lignes affectées qui fait foi.
  perform tests.assert_affects_nothing(
    format('update public.fiscal_configurations set retrocession_rate_bp = 1
            where practice_id = %L', 'b1111111-1111-4111-8111-111111111111'),
    'L''assistant ne doit pas pouvoir modifier la configuration fiscale.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  UNE APPARTENANCE QUI N'EST PLUS ACTIVE N'OUVRE PLUS RIEN
-- ---------------------------------------------------------------------------
--  `practice_members.status` connaît quatre valeurs : invited, active,
--  suspended, revoked. Toutes les fonctions d'appartenance exigent `active` —
--  et AUCUN contrôle ne le vérifiait. Remplacer `status = 'active'` par
--  `status is not null` dans `app.mes_cabinets()` survivait aux dix fichiers.
--
--  Ce qui était donc invérifié : qu'un compte dont l'accès a été retiré cesse
--  réellement de lire les dossiers. C'est le geste qu'on fait le jour où une
--  collaboration s'arrête — le seul moment où cette règle compte.
--
--  Trouvé par mutation, en réécrivant les politiques de lecture au lot 8.
begin;
do $$
declare
  v_etat text;
  v_patient uuid;
  v_piece uuid;
begin
  select id into v_patient from public.patients
   where practice_id = 'a1111111-1111-4111-8111-111111111111' limit 1;
  select id into v_piece from public.billing_documents
   where practice_id = 'a1111111-1111-4111-8111-111111111111' limit 1;

  foreach v_etat in array array['invited', 'suspended', 'revoked']
  loop
    -- Gamma est rattachée au cabinet Alpha, mais pas activement.
    delete from public.practice_members
     where practice_id = 'a1111111-1111-4111-8111-111111111111'
       and user_id = 'c0000000-0000-4000-8000-000000000001';
    insert into public.practice_members (practice_id, user_id, role, status)
    values ('a1111111-1111-4111-8111-111111111111',
            'c0000000-0000-4000-8000-000000000001', 'practitioner', v_etat);

    perform tests.authenticate_as('c0000000-0000-4000-8000-000000000001'::uuid);
    perform tests.assert_rows(
      format('select 1 from public.patients where id = %L', v_patient), 0,
      format('Une appartenance « %s » ne doit donner accès à aucun dossier.', v_etat));
    perform tests.assert_rows(
      'select 1 from public.appointments', 0,
      format('Une appartenance « %s » ne doit donner accès à aucun rendez-vous.', v_etat));
    perform tests.assert_rows(
      'select 1 from public.billing_documents', 0,
      format('Une appartenance « %s » ne doit donner accès à aucune pièce.', v_etat));

    -- LE CLINIQUE, qui passe par une autre porte que le reste.
    perform tests.assert_rows(
      'select 1 from public.patient_notes', 0,
      format('Une appartenance « %s » ne doit donner accès à aucune note clinique.', v_etat));
    perform tests.assert_rows(
      'select 1 from public.care_objectives', 0,
      format('Une appartenance « %s » ne doit donner accès à aucun objectif.', v_etat));

    /* ET LES FONCTIONS À PRIVILÈGES. Elles s'exécutent AU-DESSUS de la RLS et
     * vérifient l'appartenance elles-mêmes : une politique correcte ne les
     * couvre pas. `document_balance_cents` a déjà laissé fuir un solde d'un
     * autre cabinet une fois — la porte est différente, la règle est la même. */
    perform tests.assert_fails(
      format('select public.document_balance_cents(%L)', v_piece),
      format('Une appartenance « %s » ne doit pas donner le solde d''une pièce.', v_etat));
    perform tests.assert_fails(
      format('select public.log_audit_event(%L, ''essai'', ''patient'', %L, null)',
             'a1111111-1111-4111-8111-111111111111', v_patient),
      format('Une appartenance « %s » ne doit pas pouvoir écrire au journal.', v_etat));

    /* ET L'ÉCRITURE. Lire et écrire passent par deux chemins distincts —
     * `app.is_member` d'un côté, `app.has_role` de l'autre — et chacun porte
     * sa propre exigence d'appartenance active. Ne contrôler que la lecture
     * laissait un compte retiré capable de créer un dossier, d'en modifier un
     * et d'en supprimer un. */
    perform tests.assert_fails(
      format('insert into public.patients (practice_id, first_name, last_name)
              values (%L, ''Intrus'', ''Fictif'')',
             'a1111111-1111-4111-8111-111111111111'),
      format('Une appartenance « %s » ne doit pas pouvoir créer un dossier.', v_etat));
    perform tests.assert_affects_nothing(
      format('update public.patients set first_name = ''Modifié'' where id = %L', v_patient),
      format('Une appartenance « %s » ne doit pas pouvoir modifier un dossier.', v_etat));
    perform tests.assert_affects_nothing(
      format('delete from public.patients where id = %L', v_patient),
      format('Une appartenance « %s » ne doit pas pouvoir supprimer un dossier.', v_etat));
    reset role;
  end loop;

  -- LE CONTRE-CONTRÔLE. Passée à « active », la même personne voit le dossier :
  -- sans lui, les trois contrôles ci-dessus passeraient tout aussi bien si la
  -- ligne d'appartenance n'existait pas du tout.
  update public.practice_members set status = 'active'
   where practice_id = 'a1111111-1111-4111-8111-111111111111'
     and user_id = 'c0000000-0000-4000-8000-000000000001';
  perform tests.authenticate_as('c0000000-0000-4000-8000-000000000001'::uuid);
  perform tests.assert_rows(
    format('select 1 from public.patients where id = %L', v_patient), 1,
    'Une appartenance active, elle, donne bien accès au dossier.');
  perform tests.assert_affects_rows(
    format('update public.patients set administrative_notes = ''vu'' where id = %L',
           v_patient), 1,
    'Et elle permet bien d''écrire : sans quoi les refus ci-dessus ne prouveraient rien.');
end
$$;
rollback;
