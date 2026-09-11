-- ============================================================================
--  060 — REGISTRE D'INSTRUMENTS, ÉCHELLES ET BANDES
-- ============================================================================
\set ON_ERROR_STOP on

\set alpha '''a0000000-0000-4000-8000-000000000001'''
\set cab_a '''a1111111-1111-4111-8111-111111111111'''
\set instrument_ref  '''a8000000-0000-4000-8000-000000000001'''
\set instrument_cote '''a8000000-0000-4000-8000-000000000002'''
\set echelle '''a9000000-0000-4000-8000-000000000001'''
\set jeu_valide    '''ab000000-0000-4000-8000-000000000001'''
\set jeu_defectueux '''ab000000-0000-4000-8000-000000000002'''

-- ---------------------------------------------------------------------------
--  1. Le statut de licence commande ce que le logiciel s'autorise
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
begin
  -- En « référence seule », l'instrument est nommé, rien de plus : aucune
  -- échelle, donc aucun résultat structuré, aucune bande, aucune couleur.
  perform tests.assert_fails(
    format('insert into public.instrument_scales
              (practice_id, instrument_id, name, result_type)
            values (%L, %L, ''Tentative'', ''note_standard'')',
           'a1111111-1111-4111-8111-111111111111',
           'a8000000-0000-4000-8000-000000000001'),
    'Une échelle sur un instrument en référence seule doit être refusée.');

  -- Sur un instrument que le praticien cote lui-même, c'est permis.
  insert into public.instrument_scales
    (practice_id, instrument_id, name, result_type, direction)
  values ('a1111111-1111-4111-8111-111111111111',
          'a8000000-0000-4000-8000-000000000002',
          'Seconde échelle d''essai', 'percentile', 'croissant_favorable');
end
$$;
rollback;

-- Un accord éditeur sans référence ni vérification n'est pas un accord.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
begin
  perform tests.assert_fails(
    format('insert into public.instruments
              (practice_id, name, licence_status)
            values (%L, ''Prétendu accord'', ''integration_editeur_autorisee'')',
           'a1111111-1111-4111-8111-111111111111'),
    'Un accord éditeur sans référence, date ni vérificateur doit être refusé.');

  -- « Librement accessible » n'est pas « libre de droits » : la preuve est exigée.
  perform tests.assert_fails(
    format('insert into public.instruments
              (practice_id, name, licence_status)
            values (%L, ''Trouvé en ligne'', ''outil_libre_valide'')',
           'a1111111-1111-4111-8111-111111111111'),
    'Un outil déclaré libre sans URL ni date de vérification doit être refusé.');

  -- Avec les preuves, c'est accepté.
  insert into public.instruments
    (practice_id, name, licence_status, licence_url, licence_checked_on)
  values ('a1111111-1111-4111-8111-111111111111', 'Outil libre vérifié',
          'outil_libre_valide', 'https://exemple-fictif.test/licence', current_date);
end
$$;
rollback;

-- Une autorisation éditeur expirée retombe d'elle-même au statut inférieur.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
begin
  perform tests.assert_equals(
    app.effective_licence_status('integration_editeur_autorisee', current_date - 1),
    'scores_saisis_par_le_praticien',
    'Une autorisation expirée doit retomber au statut inférieur.');
  perform tests.assert_equals(
    app.effective_licence_status('integration_editeur_autorisee', current_date + 30),
    'integration_editeur_autorisee',
    'Une autorisation valide reste en vigueur.');
  -- Le repli est descendant, jamais ascendant.
  perform tests.assert_equals(
    app.effective_licence_status('reference_seule', null),
    'reference_seule',
    'Aucun statut ne se relève tout seul.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  2. Le découpage défectueux d'origine ne peut PAS être appliqué
-- ---------------------------------------------------------------------------
--  C'est le test de non-régression de la refonte : deux bandes contenant la
--  valeur 7, c'est exactement ce qui faisait dire « moyenne » à la légende et
--  « fragilité » au tableau, sur la même page.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_problemes text;
begin
  select string_agg(probleme, ' | ') into v_problemes
    from public.validate_band_set('ab000000-0000-4000-8000-000000000002');

  perform tests.assert(v_problemes is not null,
    'Le découpage défectueux doit être signalé.');
  perform tests.assert(v_problemes like '%chevauchent%',
    'Le chevauchement doit être nommé explicitement.');

  perform tests.assert_fails(
    format('select public.activate_band_set(%L)',
           'ab000000-0000-4000-8000-000000000002'),
    'Un découpage qui se chevauche ne doit pas pouvoir devenir actif.');

  -- Le jeu valide, lui, ne pose aucun problème.
  perform tests.assert_rows(
    format('select 1 from public.validate_band_set(%L)',
           'ab000000-0000-4000-8000-000000000001'),
    0, 'Le découpage valide ne doit soulever aucun problème.');
end
$$;
rollback;

-- Un trou entre deux bandes est refusé aussi : une valeur sans bande n'a pas
-- de couleur, et ce serait invisible pour le praticien.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_set uuid;
  v_problemes text;
begin
  insert into public.scale_band_sets
    (practice_id, scale_id, vocabulary_id, version, origin, source)
  values ('a1111111-1111-4111-8111-111111111111',
          'a9000000-0000-4000-8000-000000000001',
          'aa000000-0000-4000-8000-000000000001',
          'v-trou', 'convention_praticien', 'Test de trou.')
  returning id into v_set;

  insert into public.scale_bands
    (practice_id, band_set_id, position, lower_bound, upper_bound, label_key)
  values
    ('a1111111-1111-4111-8111-111111111111', v_set, 1, 1, 5, 'b1'),
    ('a1111111-1111-4111-8111-111111111111', v_set, 2, 9, 19, 'b3');

  select string_agg(probleme, ' | ') into v_problemes
    from public.validate_band_set(v_set);
  perform tests.assert(v_problemes like '%Aucune bande ne couvre%',
    'Un trou entre deux bandes doit être signalé.');
  perform tests.assert_fails(
    format('select public.activate_band_set(%L)', v_set),
    'Un découpage à trou ne doit pas pouvoir devenir actif.');
end
$$;
rollback;

-- Un libellé absent du vocabulaire est refusé : une bande sans mot ne peut
-- rien dire.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_set uuid;
  v_problemes text;
begin
  insert into public.scale_band_sets
    (practice_id, scale_id, vocabulary_id, version, origin, source)
  values ('a1111111-1111-4111-8111-111111111111',
          'a9000000-0000-4000-8000-000000000001',
          'aa000000-0000-4000-8000-000000000001',
          'v-libelle', 'convention_praticien', 'Test de libellé.')
  returning id into v_set;

  insert into public.scale_bands
    (practice_id, band_set_id, position, lower_bound, upper_bound, upper_inclusive, label_key)
  values ('a1111111-1111-4111-8111-111111111111', v_set, 1, 1, 19, true, 'b-inexistant');

  select string_agg(probleme, ' | ') into v_problemes
    from public.validate_band_set(v_set);
  perform tests.assert(v_problemes like '%absent du vocabulaire%',
    'Un libellé absent du vocabulaire doit être signalé.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  3. Un seul découpage actif par échelle
-- ---------------------------------------------------------------------------
--  Deux découpages actifs sur la même échelle, ce serait deux réponses à la
--  même valeur : précisément le défaut que ce lot supprime.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_set uuid;
begin
  perform tests.assert_rows(
    format('select 1 from public.scale_band_sets where scale_id = %L and active',
           'a9000000-0000-4000-8000-000000000001'),
    1, 'Un seul découpage doit être actif au départ.');

  -- On crée un second découpage valide, et on l'active.
  insert into public.scale_band_sets
    (practice_id, scale_id, vocabulary_id, version, origin, source)
  values ('a1111111-1111-4111-8111-111111111111',
          'a9000000-0000-4000-8000-000000000001',
          'aa000000-0000-4000-8000-000000000001',
          'v2', 'convention_praticien', 'Découpage révisé.')
  returning id into v_set;

  insert into public.scale_bands
    (practice_id, band_set_id, position, lower_bound, upper_bound, upper_inclusive, label_key)
  values
    ('a1111111-1111-4111-8111-111111111111', v_set, 1, 1, 7, false, 'b1'),
    ('a1111111-1111-4111-8111-111111111111', v_set, 2, 7, 19, true,  'b3');

  perform public.activate_band_set(v_set, 'Praticienne');

  perform tests.assert_rows(
    format('select 1 from public.scale_band_sets where scale_id = %L and active',
           'a9000000-0000-4000-8000-000000000001'),
    1, 'Activer un découpage doit désactiver le précédent, pas s''ajouter à lui.');
  perform tests.assert_rows(
    format('select 1 from public.scale_band_sets where id = %L and active',
           'ab000000-0000-4000-8000-000000000001'),
    0, 'Le découpage précédent doit être désactivé.');

  -- Mais PAS supprimé : un compte rendu ancien garde la trace du découpage
  -- sous lequel il a été produit.
  perform tests.assert_rows(
    format('select 1 from public.scale_band_sets where id = %L',
           'ab000000-0000-4000-8000-000000000001'),
    1, 'Le découpage précédent est conservé, jamais effacé.');

  perform tests.assert_rows(
    'select 1 from public.audit_events where action = ''band_set.activate''',
    1, 'L''activation d''un découpage doit être journalisée.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  4. Un seul mot par bande dans un vocabulaire
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
begin
  -- Deux bandes portant le même mot seraient illisibles sur un document et
  -- indécidables sur un graphique.
  perform tests.assert_fails(
    format('insert into public.band_vocabulary_labels
              (practice_id, vocabulary_id, key, text)
            values (%L, %L, ''b5'', ''Dans la moyenne'')',
           'a1111111-1111-4111-8111-111111111111',
           'aa000000-0000-4000-8000-000000000001'),
    'Deux bandes ne doivent pas pouvoir porter le même mot.');

  -- Une même clé ne peut pas être définie deux fois.
  perform tests.assert_fails(
    format('insert into public.band_vocabulary_labels
              (practice_id, vocabulary_id, key, text)
            values (%L, %L, ''b1'', ''Autre mot'')',
           'a1111111-1111-4111-8111-111111111111',
           'aa000000-0000-4000-8000-000000000001'),
    'Une clé de libellé ne doit pas pouvoir être redéfinie.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  5. Isolation
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  t text;
  v_n bigint;
begin
  foreach t in array array['instruments', 'instrument_scales', 'band_vocabularies',
                           'band_vocabulary_labels', 'scale_band_sets', 'scale_bands']
  loop
    execute format('select count(*) from public.%I where practice_id = %L',
                   t, 'b1111111-1111-4111-8111-111111111111') into v_n;
    perform tests.assert_equals(v_n, 0::bigint,
      format('Le cabinet A ne doit voir aucune ligne de %s appartenant à B.', t));
  end loop;

  perform tests.assert_rows(
    format('select 1 from public.instruments where id = %L',
           'b8000000-0000-4000-8000-000000000001'),
    0, 'L''instrument du cabinet B ne doit pas être lisible par son UUID.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  6. Le schéma ne peut PAS accueillir de contenu éditeur
-- ---------------------------------------------------------------------------
--  Garde-fou structurel : si une migration ultérieure ajoute une colonne
--  destinée à stocker des items, des consignes ou une table d'étalonnage, ce
--  test la signale. C'est une revue automatisée, pas une preuve — mais elle
--  attrape le cas évident.
begin;
do $$
declare
  v_suspects text;
begin
  select string_agg(format('%I.%I', table_name, column_name), ', ')
    into v_suspects
  from information_schema.columns
  where table_schema = 'public'
    and table_name in ('instruments', 'instrument_scales', 'scale_band_sets', 'scale_bands')
    and (column_name ~* '(item|stimul|consigne|etalonnage|bareme|conversion|norme_table|cotation_table)');

  if v_suspects is not null then
    raise exception
      'ÉCHEC : colonnes suspectes de contenir du matériel éditeur : %', v_suspects
      using errcode = 'assert_failure';
  end if;
end
$$;
rollback;
