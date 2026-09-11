-- ============================================================================
--  OUTILLAGE DE TEST — BASE LOCALE UNIQUEMENT
--  Jamais appliqué sur Supabase. Vit hors de `supabase/migrations/`.
-- ============================================================================

create schema if not exists tests;

-- ---------- se faire passer pour un utilisateur connecté ----------
--  Reproduit ce que PostgREST pose sur la session : le rôle `authenticated`
--  et la revendication `sub` du JWT. Tout ce qui suit dans la transaction
--  s'exécute donc avec exactement les droits d'un utilisateur de l'application.
create or replace function tests.authenticate_as(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user_id::text, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';
end;
$$;

-- ---------- visiteur anonyme ----------
create or replace function tests.authenticate_as_anon()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
end;
$$;

-- ---------- assertions ----------
create or replace function tests.assert(p_condition boolean, p_message text)
returns void
language plpgsql
as $$
begin
  if p_condition is not true then
    raise exception 'ÉCHEC : %', p_message using errcode = 'assert_failure';
  end if;
end;
$$;

create or replace function tests.assert_equals(p_actual anyelement, p_expected anyelement, p_message text)
returns void
language plpgsql
as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'ÉCHEC : % (attendu %, obtenu %)', p_message, p_expected, p_actual
      using errcode = 'assert_failure';
  end if;
end;
$$;

-- Exécute une requête et vérifie le nombre de lignes rendues.
create or replace function tests.assert_rows(p_query text, p_expected bigint, p_message text)
returns void
language plpgsql
as $$
declare
  v_count bigint;
begin
  execute format('select count(*) from (%s) _q', p_query) into v_count;
  if v_count is distinct from p_expected then
    raise exception 'ÉCHEC : % (attendu % ligne(s), obtenu %)', p_message, p_expected, v_count
      using errcode = 'assert_failure';
  end if;
end;
$$;

-- Vérifie qu'une instruction ÉCHOUE. Sert aux tests négatifs : une écriture
-- refusée par la RLS lève `42501`, une contrainte violée lève `23514`, etc.
create or replace function tests.assert_fails(p_statement text, p_message text)
returns void
language plpgsql
as $$
begin
  begin
    execute p_statement;
  exception when others then
    return;   -- l'échec attendu s'est produit
  end;
  raise exception 'ÉCHEC : % — l''instruction a réussi alors qu''elle devait être refusée.', p_message
    using errcode = 'assert_failure';
end;
$$;

-- Vérifie qu'une écriture n'a affecté AUCUNE ligne. La RLS ne lève pas
-- d'erreur sur un UPDATE ou un DELETE qui ne voit rien : elle n'en voit
-- simplement aucune. Le test doit donc porter sur le compte, pas sur l'erreur.
create or replace function tests.assert_affects_nothing(p_statement text, p_message text)
returns void
language plpgsql
as $$
declare
  v_count bigint;
begin
  execute p_statement;
  get diagnostics v_count = row_count;
  if v_count <> 0 then
    raise exception 'ÉCHEC : % — % ligne(s) affectée(s) alors qu''aucune ne devait l''être.',
      p_message, v_count using errcode = 'assert_failure';
  end if;
end;
$$;

grant usage on schema tests to public;
grant execute on all functions in schema tests to public;
