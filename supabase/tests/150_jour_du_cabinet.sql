-- ============================================================================
--  150 — LE JOUR DU CABINET, PAS CELUI DE LA SESSION DE LA BASE
-- ============================================================================
--  La base locale tourne dans le fuseau de la machine ; une base de production
--  peut tourner en UTC. Pour éprouver une garde qui dépendait du fuseau de la
--  session, ces contrôles le FONT VARIER dans leur transaction
--  (`set_config('TimeZone', …, true)`).
--
--  POURQUOI DEUX FUSEAUX EXTRÊMES. À tout instant, l'un d'eux donne une autre
--  date qu'à Paris : UTC−12 est encore la veille tant qu'il est moins de 13 h
--  ou 14 h à Paris ; UTC+14 est déjà le lendemain dès 11 h ou 12 h. Le cas
--  discriminant se construit donc à n'importe quelle heure d'exécution.
--
--  Données entièrement fictives.
-- ============================================================================
\set ON_ERROR_STOP on
\set alpha '''a0000000-0000-4000-8000-000000000001'''

-- ---------------------------------------------------------------------------
--  1. Le jour du cabinet ne dépend pas du fuseau de la session
-- ---------------------------------------------------------------------------
begin;
do $$
declare v_ref date; v_z text;
begin
  v_ref := app.jour_du_cabinet('a1111111-1111-4111-8111-111111111111');
  perform tests.assert_equals(v_ref, (now() at time zone 'Europe/Paris')::date,
    'Un cabinet au fuseau par défaut vit à l''heure de Paris.');
  foreach v_z in array array['UTC', 'Pacific/Kiritimati', 'Etc/GMT+12', 'America/Los_Angeles'] loop
    perform set_config('TimeZone', v_z, true);
    perform tests.assert_equals(app.jour_du_cabinet('a1111111-1111-4111-8111-111111111111'), v_ref,
      format('Session réglée sur %s : le jour du cabinet ne bouge pas.', v_z));
  end loop;
end $$;
rollback;

-- ---------------------------------------------------------------------------
--  2. C'est le fuseau DE CE cabinet qui fait foi
-- ---------------------------------------------------------------------------
--  UTC+14 et UTC−12 sont à 26 heures l'un de l'autre : leurs jours diffèrent
--  TOUJOURS. Une fonction qui figerait un fuseau unique les rendrait égaux, à
--  n'importe quelle heure.
begin;
update public.practices set timezone = 'Pacific/Kiritimati' where id = 'a1111111-1111-4111-8111-111111111111';
update public.practices set timezone = 'Etc/GMT+12'         where id = 'b1111111-1111-4111-8111-111111111111';
do $$
begin
  perform tests.assert_equals(app.jour_du_cabinet('a1111111-1111-4111-8111-111111111111'),
    (now() at time zone 'Pacific/Kiritimati')::date, 'Le cabinet réglé sur UTC+14 lit son propre jour.');
  perform tests.assert_equals(app.jour_du_cabinet('b1111111-1111-4111-8111-111111111111'),
    (now() at time zone 'Etc/GMT+12')::date, 'Le cabinet réglé sur UTC−12 lit son propre jour.');
  perform tests.assert(
    app.jour_du_cabinet('a1111111-1111-4111-8111-111111111111')
      <> app.jour_du_cabinet('b1111111-1111-4111-8111-111111111111'),
    'Deux cabinets à 26 heures d''écart n''ont jamais le même jour.');
end $$;
rollback;

-- ---------------------------------------------------------------------------
--  3. Un fuseau illisible ne fait pas échouer : il retombe sur le défaut
-- ---------------------------------------------------------------------------
begin;
update public.practices set timezone = 'Mars/Olympus' where id = 'a1111111-1111-4111-8111-111111111111';
do $$
begin
  perform tests.assert_equals(app.jour_du_cabinet('a1111111-1111-4111-8111-111111111111'),
    (now() at time zone 'Europe/Paris')::date,
    'La colonne n''a pas de contrainte de validité : un fuseau illisible vaut le défaut de la base.');
end $$;
rollback;

-- ---------------------------------------------------------------------------
--  4. La garde de signature suit le jour du cabinet
-- ---------------------------------------------------------------------------
--  Deux branches, dont l'une est toujours constructible (voir l'en-tête) :
--   · session EN RETARD sur le cabinet : signer au jour du cabinet doit
--     RÉUSSIR — l'ancienne garde le refusait comme « futur » ;
--   · session EN AVANCE : signer au jour de la session, déjà le lendemain au
--     cabinet, doit ÉCHOUER — l'ancienne garde l'acceptait.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_att uuid;
  v_seance uuid;
  v_jour date := (now() at time zone 'Europe/Paris')::date;  -- calculé ici, sans la fonction éprouvée
begin
  insert into public.attestations (practice_id, kind, patient_id)
  values ('a1111111-1111-4111-8111-111111111111', 'presence', 'a6000000-0000-4000-8000-000000000001')
  returning id into v_att;
  select appointment_id into v_seance from public.realised_sessions
   where patient_id = 'a6000000-0000-4000-8000-000000000001' order by session_date desc limit 1;
  insert into public.attestation_sessions (attestation_id, appointment_id, practice_id)
  values (v_att, v_seance, 'a1111111-1111-4111-8111-111111111111');

  if (now() at time zone 'Etc/GMT+12')::date < v_jour then
    perform set_config('TimeZone', 'Etc/GMT+12', true);
    perform tests.assert(current_date < v_jour, 'Préparation : la session est bien en retard sur le cabinet.');
    perform public.issue_attestation(v_att, v_jour);
    perform tests.assert_equals((select issued_on from public.attestations where id = v_att), v_jour,
      'Session en retard : l''attestation se signe au jour du cabinet, sans être refusée comme future.');
  else
    perform set_config('TimeZone', 'Pacific/Kiritimati', true);
    perform tests.assert(current_date > v_jour, 'Préparation : la session est bien en avance sur le cabinet.');
    perform tests.assert_fails(
      format('select public.issue_attestation(%L::uuid, %L::date)', v_att, current_date),
      'Session en avance : signer au jour de la session, qui est déjà le lendemain au cabinet, reste une date future.');
  end if;
end $$;
rollback;

-- ---------------------------------------------------------------------------
--  5. Sans date fournie, la signature prend le jour du cabinet
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_att uuid;
  v_seance uuid;
  v_jour date := (now() at time zone 'Europe/Paris')::date;
begin
  insert into public.attestations (practice_id, kind, patient_id)
  values ('a1111111-1111-4111-8111-111111111111', 'presence', 'a6000000-0000-4000-8000-000000000001')
  returning id into v_att;
  select appointment_id into v_seance from public.realised_sessions
   where patient_id = 'a6000000-0000-4000-8000-000000000001' order by session_date desc limit 1;
  insert into public.attestation_sessions (attestation_id, appointment_id, practice_id)
  values (v_att, v_seance, 'a1111111-1111-4111-8111-111111111111');

  -- Une session dont le jour DIFFÈRE de celui du cabinet — l'une des deux l'est toujours.
  perform set_config('TimeZone',
    case when (now() at time zone 'Etc/GMT+12')::date <> v_jour then 'Etc/GMT+12' else 'Pacific/Kiritimati' end,
    true);
  perform tests.assert(current_date <> v_jour, 'Préparation : le jour de la session diffère de celui du cabinet.');
  perform public.issue_attestation(v_att);
  perform tests.assert_equals((select issued_on from public.attestations where id = v_att), v_jour,
    'Sans date fournie : le jour du cabinet, pas celui de la session.');
end $$;
rollback;

-- ---------------------------------------------------------------------------
--  6. Les droits
-- ---------------------------------------------------------------------------
do $$
begin
  perform tests.assert(has_function_privilege('authenticated', 'public.issue_attestation(uuid, date)', 'execute'),
    'Un membre authentifié peut toujours signer.');
  perform tests.assert(not has_function_privilege('anon', 'public.issue_attestation(uuid, date)', 'execute'),
    'Un visiteur anonyme ne signe rien.');
  perform tests.assert(not has_function_privilege('authenticated', 'app.jour_du_cabinet(uuid)', 'execute'),
    'Personne n''interroge le fuseau d''un cabinet par son identifiant.');
  perform tests.assert(not has_function_privilege('anon', 'app.jour_du_cabinet(uuid)', 'execute'),
    'Ni un visiteur anonyme.');
end $$;
