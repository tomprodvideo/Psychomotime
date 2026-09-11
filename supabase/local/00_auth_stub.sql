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

-- Supabase installe ses extensions dans le schéma `extensions`, jamais dans
-- `public`. On reproduit ce placement : sinon `gen_salt`, `crypt` et les autres
-- se retrouvent exposées en RPC ici et pas là-bas, et le test ment.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;
-- `gen_random_uuid()` doit rester résolvable sans préfixe dans les valeurs par
-- défaut de colonnes, comme sur Supabase — qui place `extensions` dans le
-- search_path des rôles.
do $$
begin
  execute format(
    'alter database %I set search_path = "$user", public, extensions',
    current_database());
end
$$;

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

-- PRIVILÈGES PAR DÉFAUT — reproduits à l'identique de Supabase.
--  Sans eux, le stub est PLUS SÉVÈRE que la production : une fonction créée
--  dans `public` y reçoit automatiquement EXECUTE pour anon et authenticated,
--  et un `revoke all ... from public` ne le retire pas. C'est exactement
--  l'écart qui a laissé passer des fonctions appelables sans session, détecté
--  par l'analyseur Supabase et non par le test local. Le stub doit donc être
--  aussi permissif que la production pour que le test soit sincère.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

-- ---------- schéma storage ----------
--  Minimum permettant aux migrations v1 de s'appliquer telles quelles pendant
--  la répétition de bascule. Aucun fichier n'est réellement stocké : seules la
--  structure et les politiques sont reproduites, pour que rien ne diverge
--  silencieusement de ce qui tourne en production.
create schema if not exists storage;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz not null default now()
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text,
  owner uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);
alter table storage.objects enable row level security;

-- Découpe un chemin « dossier/sous-dossier/fichier » en tableau de segments,
-- sans le nom de fichier final. C'est la fonction sur laquelle reposent les
-- politiques de stockage de la v1.
create or replace function storage.foldername(name text)
returns text[]
language plpgsql
immutable
as $$
declare
  parts text[];
begin
  parts := string_to_array(name, '/');
  return parts[1 : array_length(parts, 1) - 1];
end;
$$;

grant usage on schema storage to anon, authenticated, service_role;
grant select on storage.buckets to anon, authenticated;
grant select, insert, update, delete on storage.objects to authenticated;
