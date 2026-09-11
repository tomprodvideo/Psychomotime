-- ============================================================================
--  STUB SUPABASE POUR BASE LOCALE — NE JAMAIS APPLIQUER SUR SUPABASE
-- ============================================================================
--  Supabase fournit nativement le schéma `auth`, les rôles `anon`,
--  `authenticated`, `service_role` et les fonctions `auth.uid()` / `auth.jwt()`.
--  La machine de développement n'a ni Docker ni la CLI Supabase : ce fichier
--  recrée le strict minimum sur un PostgreSQL local pour que les migrations
--  s'appliquent à l'identique et que les politiques RLS soient testables dans
--  le rôle réel d'un utilisateur connecté.
--
--  Ce fichier vit dans `supabase/local/`, hors de `supabase/migrations/` :
--  il n'est jamais envoyé au projet distant.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------- rôles PostgREST ----------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

-- ---------- schéma auth ----------
create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  created_at timestamptz not null default now()
);

-- `auth.uid()` lit la revendication `sub` du JWT posée par PostgREST.
-- La forme exacte utilisée par Supabase est reproduite ici, replis compris.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(
    coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    ),
    ''
  )::uuid
$$;

create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb,
    '{}'::jsonb
  )
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
    current_setting('role', true)
  )
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to authenticated, service_role;

-- `authenticated` doit pouvoir se connecter au schéma applicatif.
grant usage on schema public to anon, authenticated, service_role;
