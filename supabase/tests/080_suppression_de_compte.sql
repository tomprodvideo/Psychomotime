-- ============================================================================
--  080 — SUPPRIMER SON COMPTE
--  La v1 tenait cette promesse ; la refonte l'avait perdue sans le dire.
-- ============================================================================
\set ON_ERROR_STOP on

\set alpha '''a0000000-0000-4000-8000-000000000001'''
\set cab_alpha '''a1111111-1111-4111-8111-111111111111'''
\set beta_proprio '''b0000000-0000-4000-8000-000000000001'''
\set beta_assistant '''b0000000-0000-4000-8000-000000000002'''
\set cab_beta '''b1111111-1111-4111-8111-111111111111'''

-- ---------------------------------------------------------------------------
--  1. Un compte SEUL dans son cabinet : tout part, pièces émises comprises
-- ---------------------------------------------------------------------------
--  C'est le défaut trouvé par la relecture protection des données : le cabinet
--  et ses données survivaient à la suppression du compte, orphelins et
--  invisibles, pendant que l'écran promettait le contraire.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_cab uuid := 'a1111111-1111-4111-8111-111111111111';
  v_pat uuid;
  v_doc uuid;
  v_att uuid;
  v_lettre uuid;
  v_synthese uuid;
  v_dossiers bigint;
  v_resultat jsonb;
begin
  -- Une facture ÉMISE, que la garde d'immuabilité refuse normalement de
  -- supprimer. Sans elle, ce test passerait sans rien prouver.
  -- Un dossier qui porte au moins une séance honorée : l'attestation de
  -- présence, plus bas, refuse d'affirmer ce qu'elle ne peut pas montrer.
  select r.patient_id into v_pat from public.realised_sessions r
   where r.practice_id = v_cab limit 1;
  insert into public.billing_documents (practice_id, kind, patient_id, payer_is_patient)
  values (v_cab, 'facture', v_pat, true) returning id into v_doc;
  insert into public.billing_lines
    (practice_id, document_id, position, label, unit_price_cents, amount_cents)
  values (v_cab, v_doc, 1, 'Séance de psychomotricité', 4500, 4500);
  perform public.issue_billing_document(v_doc);

  /* ET LES TROIS ÉCRITS CLINIQUES REMIS, pour la même raison. Chacun porte une
   * garde qui refuse la suppression d'une pièce remise, et chacune de ces
   * gardes fait une DÉROGATION quand le cabinet lui-même disparaît : il n'y a
   * alors plus de série à tenir ni personne à qui rendre des comptes.
   *
   * Ces dérogations portent la promesse d'effacement du compte, et aucune
   * n'était contrôlée : les désarmer laissait la suite entièrement verte
   * pendant que `delete_my_account` échouait. Mesuré par la relecture de
   * sécurité du rang 3. */
  insert into public.attestations (practice_id, kind, patient_id)
  values (v_cab, 'presence', v_pat) returning id into v_att;
  insert into public.attestation_sessions (attestation_id, appointment_id, practice_id)
  select v_att, r.appointment_id, v_cab from public.realised_sessions r
   where r.patient_id = v_pat limit 1;
  perform public.issue_attestation(v_att);

  insert into public.liaison_letters
    (practice_id, patient_id, recipient_contact_id, subject, body)
  values (v_cab, v_pat,
          (select id from public.contacts where practice_id = v_cab limit 1),
          'Objet', 'Corps')
  returning id into v_lettre;
  perform public.issue_liaison_letter(v_lettre);

  insert into public.follow_up_summaries
    (practice_id, patient_id, period_start, period_end, observed_evolution)
  values (v_cab, v_pat, date '2026-08-01', date '2026-08-31', 'Texte.')
  returning id into v_synthese;
  perform public.issue_follow_up_summary(v_synthese);

  select count(*) into v_dossiers from public.patients where practice_id = v_cab;
  perform tests.assert(v_dossiers > 0, 'Le cabinet doit porter des dossiers avant le test.');

  v_resultat := public.delete_my_account();

  perform tests.assert_equals((v_resultat ->> 'cabinets_supprimes')::integer, 1,
    'Le cabinet dont le compte est le seul membre doit être supprimé.');
  perform tests.assert_equals((v_resultat ->> 'cabinets_quittes')::integer, 0,
    'Aucun cabinet n''est simplement quitté dans ce cas.');

  /* HORS SESSION POUR TOUT CE QUI SUIT, ET C'EST LE POINT DU TEST.
   *
   * Un compte qui vient d'être supprimé n'est plus membre de rien : la RLS lui
   * cache le cabinet, qu'il ait été détruit ou non. Contrôler depuis cette
   * position-là aurait donné un test VACANT — il serait passé exactement de la
   * même façon avec l'ancienne fonction, qui ne supprimait rien.
   *
   * C'est vérifié : rejoué contre la version d'avant, ce fichier échoue sur la
   * première assertion ci-dessous. */
  reset role;

  -- Et RIEN ne subsiste. C'est toute la question.
  perform tests.assert_rows(
    format('select 1 from public.practices where id = %L', v_cab), 0,
    'Le cabinet ne doit plus exister.');
  perform tests.assert_rows(
    format('select 1 from public.patients where practice_id = %L', v_cab), 0,
    'Aucun dossier ne doit survivre au compte.');
  perform tests.assert_rows(
    format('select 1 from public.billing_documents where practice_id = %L', v_cab), 0,
    'Aucune pièce comptable ne doit survivre, émise comprise.');
  perform tests.assert_rows(
    format('select 1 from public.billing_lines where practice_id = %L', v_cab), 0,
    'Aucune ligne de facture ne doit survivre — elles portent des libellés.');
  perform tests.assert_rows(
    format('select 1 from public.appointments where practice_id = %L', v_cab), 0,
    'Aucun rendez-vous ne doit survivre.');
  perform tests.assert_rows(
    format('select 1 from public.contacts where practice_id = %L', v_cab), 0,
    'Aucun contact ne doit survivre.');
  perform tests.assert_rows(
    format('select 1 from public.practice_members where practice_id = %L', v_cab), 0,
    'Aucune appartenance ne doit survivre.');

  -- Le compte lui-même est parti.
  perform tests.assert_rows(
    'select 1 from auth.users where id = ''a0000000-0000-4000-8000-000000000001''',
    0, 'Le compte doit être supprimé.');

  -- La trace, elle, demeure : effacer le journal effacerait la preuve que la
  -- suppression a eu lieu. Elle ne porte aucun nom de personne.
  --
  perform tests.assert_rows(
    'select 1 from public.audit_events
      where action = ''practice.delete_with_account'' and practice_id is null',
    1, 'La suppression doit laisser une trace, détachée du cabinet disparu.');

  -- Et cette trace ne porte AUCUN nom : ni patient, ni praticien, ni cabinet.
  perform tests.assert_rows(
    'select 1 from public.audit_events
      where action = ''practice.delete_with_account''
        and metadata::text ~* ''[a-z]{4,}''
        and metadata ?| array[''nom'', ''name'', ''patient'', ''email'']',
    0, 'La trace ne doit contenir aucun nom ni aucune adresse.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  2. Un membre qui n'est pas le dernier propriétaire ne détruit rien
-- ---------------------------------------------------------------------------
--  Les données du cabinet appartiennent aussi aux autres. Les détruire parce
--  qu'un assistant s'en va serait détruire le travail de quelqu'un d'autre.
begin;
select tests.authenticate_as(:beta_assistant::uuid);
do $$
declare
  v_cab uuid := 'b1111111-1111-4111-8111-111111111111';
  v_avant bigint;
  v_resultat jsonb;
begin
  select count(*) into v_avant from public.patients where practice_id = v_cab;

  v_resultat := public.delete_my_account();

  perform tests.assert_equals((v_resultat ->> 'cabinets_supprimes')::integer, 0,
    'Un cabinet partagé ne doit pas être supprimé.');
  perform tests.assert_equals((v_resultat ->> 'cabinets_quittes')::integer, 1,
    'Seule l''appartenance doit être retirée.');

  -- Hors session pour le contrôle : l'ancien membre ne voit plus le cabinet,
  -- et c'est exactement ce qu'on veut. Ce qu'on vérifie ici, c'est que le
  -- cabinet EXISTE encore, pas qu'il lui reste visible.
  reset role;
  perform tests.assert_rows(
    format('select 1 from public.practices where id = %L', v_cab), 1,
    'Le cabinet doit survivre au départ d''un de ses membres.');
  perform tests.assert_equals(
    (select count(*) from public.patients where practice_id = v_cab), v_avant,
    'Les dossiers du cabinet ne doivent pas bouger.');
  perform tests.assert_rows(
    format('select 1 from public.practice_members
             where practice_id = %L and user_id = ''b0000000-0000-4000-8000-000000000002''', v_cab),
    0, 'L''appartenance du compte supprimé doit être retirée.');
  perform tests.assert_rows(
    format('select 1 from public.practice_members where practice_id = %L', v_cab), 1,
    'Le propriétaire restant doit conserver la sienne.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  3. Le dernier propriétaire d'un cabinet partagé est REFUSÉ
-- ---------------------------------------------------------------------------
--  Les deux autres issues seraient mauvaises : détruire les données d'autrui,
--  ou laisser un cabinet que plus personne ne peut administrer. On refuse, et
--  on dit quoi faire.
begin;
select tests.authenticate_as(:beta_proprio::uuid);
do $$
declare
  v_cab uuid := 'b1111111-1111-4111-8111-111111111111';
  v_message text;
begin
  /* `assert_fails` accepte N'IMPORTE QUELLE erreur : le déclencheur du dernier
   * propriétaire lève de toute façon, et ce scénario passait donc même sans le
   * premier passage de la fonction. Or c'est précisément ce passage qui produit
   * le message ACTIONNABLE, et ce message s'affiche tel quel à l'utilisatrice.
   * On vérifie donc le message, pas seulement l'échec. */
  begin
    perform public.delete_my_account();
    perform tests.assert(false,
      'Le dernier propriétaire d''un cabinet partagé ne doit pas pouvoir supprimer son compte.');
  exception
    when assert_failure then raise;
    when others then
      get stacked diagnostics v_message = message_text;
  end;
  perform tests.assert(v_message like '%dernier propriétaire%',
    'Le refus doit venir du contrôle de la fonction, pas du déclencheur : ' || coalesce(v_message, '(aucun)'));
  perform tests.assert(v_message like '%Transférez la propriété%',
    'Le refus doit dire quoi faire ensuite.');

  -- ET RIEN N'A BOUGÉ. Un refus qui laisserait des dégâts derrière lui serait
  -- pire qu'une suppression : la moitié d'un effacement n'est demandée par
  -- personne.
  perform tests.assert_rows(
    format('select 1 from public.practices where id = %L', v_cab), 1,
    'Le cabinet doit être intact après le refus.');
  perform tests.assert_rows(
    format('select 1 from public.practice_members where practice_id = %L', v_cab), 2,
    'Les deux appartenances doivent être intactes après le refus.');
  perform tests.assert_rows(
    'select 1 from auth.users where id = ''b0000000-0000-4000-8000-000000000001''',
    1, 'Le compte ne doit pas avoir été supprimé.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  4. Sans session, la fonction ne supprime rien
-- ---------------------------------------------------------------------------
--  Elle est `security definer` : sans ce contrôle, elle s'exécuterait avec les
--  droits de son propriétaire pour un appelant qu'on ne connaît pas.
begin;
do $$
begin
  perform tests.authenticate_as_anon();
  perform tests.assert_fails(
    'select public.delete_my_account()',
    'Un visiteur anonyme ne doit pas pouvoir appeler la suppression de compte.');
  reset role;
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  5. Une panne en cours de route ne laisse pas une suppression à moitié faite
-- ---------------------------------------------------------------------------
--  La fonction parcourt les cabinets un par un. Si le deuxième échoue après
--  que le premier a été détruit, l'appelant se retrouverait avec la moitié de
--  ses données effacées et son compte toujours là — un état que personne n'a
--  demandé et dont on ne peut pas revenir.
--
--  Une fonction PL/pgSQL s'exécute dans la transaction de son appelant, et
--  PostgREST en ouvre une par appel : l'exception doit donc tout annuler. Ce
--  scénario le DÉMONTRE au lieu de s'en remettre au raisonnement.
begin;
do $$
declare
  v_a bigint; v_c bigint; v_u bigint;
begin
  -- Un second cabinet, dont le même compte est aussi le seul membre.
  insert into public.practices (id, name)
  values ('c1111111-1111-4111-8111-111111111111', 'Cabinet jetable (fictif)');
  insert into public.practice_members (practice_id, user_id, role, status)
  values ('c1111111-1111-4111-8111-111111111111',
          'a0000000-0000-4000-8000-000000000001', 'owner', 'active');
end
$$;

-- Une panne provoquée sur la suppression du SECOND cabinet.
create or replace function pg_temp.panne_simulee() returns trigger
language plpgsql as $$
begin
  if old.name like 'Cabinet jetable%' then
    raise exception 'panne simulée en cours de suppression';
  end if;
  return old;
end
$$;
create trigger panne_simulee before delete on public.practices
  for each row execute function pg_temp.panne_simulee();

select tests.authenticate_as('a0000000-0000-4000-8000-000000000001'::uuid);
do $$
begin
  perform tests.assert_fails(
    'select public.delete_my_account()',
    'Une panne en cours de suppression doit faire échouer l''ensemble.');
  reset role;

  -- CE QUI COMPTE : le premier cabinet a-t-il été emporté au passage ?
  perform tests.assert_rows(
    'select 1 from public.practices where id = ''a1111111-1111-4111-8111-111111111111''',
    1, 'Le premier cabinet ne doit PAS avoir été supprimé.');
  perform tests.assert_rows(
    'select 1 from public.practices where id = ''c1111111-1111-4111-8111-111111111111''',
    1, 'Le second cabinet non plus.');
  perform tests.assert_rows(
    'select 1 from auth.users where id = ''a0000000-0000-4000-8000-000000000001''',
    1, 'Et le compte doit être intact : une suppression à moitié faite n''est demandée par personne.');
end
$$;
drop trigger panne_simulee on public.practices;
rollback;

-- ---------------------------------------------------------------------------
--  6. Une appartenance révoquée ne bloque pas l'effacement
-- ---------------------------------------------------------------------------
--  Le premier jet comptait TOUS les membres. Une invitation jamais acceptée ou
--  une appartenance révoquée suffisait donc à rendre la suppression impossible
--  — et le message demandait de retirer ces membres par un écran qui n'existe
--  pas. Un effacement qu'on ne peut pas obtenir n'est pas un effacement.
begin;
do $$
begin
  insert into public.practice_members (practice_id, user_id, role, status)
  values ('a1111111-1111-4111-8111-111111111111',
          'b0000000-0000-4000-8000-000000000002', 'assistant', 'revoked');
end
$$;
select tests.authenticate_as('a0000000-0000-4000-8000-000000000001'::uuid);
do $$
declare
  v_resultat jsonb;
begin
  v_resultat := public.delete_my_account();
  perform tests.assert_equals((v_resultat ->> 'cabinets_supprimes')::integer, 1,
    'Un membre révoqué ne doit pas empêcher la suppression du cabinet.');
  reset role;
  perform tests.assert_rows(
    'select 1 from public.practices where id = ''a1111111-1111-4111-8111-111111111111''',
    0, 'Le cabinet doit bien avoir été supprimé.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  7. Un compte présent dans plusieurs cabinets : les comptes rendus s'additionnent
-- ---------------------------------------------------------------------------
--  Les compteurs étaient écrasés à chaque tour de boucle : le compte rendu ne
--  portait que le dernier cabinet parcouru. C'est ce compte rendu qui justifie
--  que la fonction rende autre chose que `void`.
begin;
do $$
begin
  insert into public.practices (id, name)
  values ('c1111111-1111-4111-8111-111111111111', 'Second cabinet (fictif)');
  insert into public.practice_members (practice_id, user_id, role, status)
  values ('c1111111-1111-4111-8111-111111111111',
          'a0000000-0000-4000-8000-000000000001', 'owner', 'active');
end
$$;
select tests.authenticate_as('a0000000-0000-4000-8000-000000000001'::uuid);
do $$
declare
  v_attendu bigint;
  v_resultat jsonb;
begin
  select count(*) into v_attendu from public.patients
   where practice_id = 'a1111111-1111-4111-8111-111111111111';

  v_resultat := public.delete_my_account();

  perform tests.assert_equals((v_resultat ->> 'cabinets_supprimes')::integer, 2,
    'Les deux cabinets dont le compte est seul membre doivent partir.');
  perform tests.assert_equals(
    (v_resultat ->> 'dossiers_supprimes')::bigint, v_attendu,
    'Le nombre de dossiers doit être la SOMME des cabinets, pas celui du dernier.');
  reset role;
  perform tests.assert_rows(
    'select 1 from public.practices
      where id in (''a1111111-1111-4111-8111-111111111111'',
                   ''c1111111-1111-4111-8111-111111111111'')',
    0, 'Aucun des deux cabinets ne doit subsister.');
end
$$;
rollback;
