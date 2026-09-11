-- ============================================================================
--  COUVERTURE RLS — BASE LOCALE UNIQUEMENT
--  Une table du schéma `public` sans RLS, ou avec RLS mais sans politique,
--  est une fuite en attente. Ce contrôle refuse les deux.
-- ============================================================================

create or replace function tests.check_rls_coverage()
returns table (issue text)
language sql
stable
as $$
  -- 1. Tables sans RLS activée
  select format('Table %I.%I : RLS non activée.', n.nspname, c.relname)
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity

  union all

  -- 2. Tables sans RLS forcée (le propriétaire contournerait la politique)
  select format('Table %I.%I : RLS non forcée (FORCE ROW LEVEL SECURITY).', n.nspname, c.relname)
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and c.relrowsecurity and not c.relforcerowsecurity

  union all

  -- 3. Tables avec RLS mais sans aucune politique : inaccessibles, donc
  --    probablement un oubli plutôt qu'un choix.
  select format('Table %I.%I : RLS activée mais aucune politique définie.', n.nspname, c.relname)
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
    and not exists (select 1 from pg_policy p where p.polrelid = c.oid)

  union all

  -- 4. Fonctions SECURITY DEFINER sans search_path épinglé : vecteur
  --    classique d'élévation de privilège.
  select format('Fonction %I.%I : SECURITY DEFINER sans search_path épinglé.', n.nspname, p.proname)
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'app')
    and p.prosecdef
    and (p.proconfig is null or not exists (
      select 1 from unnest(p.proconfig) cfg where cfg like 'search\_path=%'
    ))

  union all

  -- 5. Adhérence à Supabase hors du point de contact unique. `auth.uid()` ne
  --    doit être appelé que par `app.current_user_id()` : c'est ce qui rend le
  --    schéma portable vers un hébergeur certifié sans réécrire les politiques.
  select format('Politique %I sur %I.%I : appelle auth.* directement au lieu de app.current_user_id().',
                pol.polname, n.nspname, c.relname)
  from pg_policy pol
  join pg_class c on c.oid = pol.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and (pg_get_expr(pol.polqual, pol.polrelid) like '%auth.uid()%'
      or pg_get_expr(pol.polwithcheck, pol.polrelid) like '%auth.uid()%')

  union all

  select format('Fonction %I.%I : appelle auth.* directement au lieu de app.current_user_id().',
                n.nspname, p.proname)
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'app')
    -- `prokind = 'f'` : fonctions ordinaires seulement. `pg_get_functiondef`
    -- refuse une fonction d'agrégat, et une extension peut en installer dans
    -- le schéma public.
    and p.prokind = 'f'
    and p.proname <> 'current_user_id'
    and pg_get_functiondef(p.oid) like '%auth.uid()%'

  union all

  -- 6. Privilèges accordés à `anon` sur une table du schéma public : à
  --    n'autoriser qu'en connaissance de cause.
  select format('Table %I.%I : privilège %s accordé à anon.', n.nspname, c.relname, a.privilege_type)
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join information_schema.table_privileges a
    on a.table_schema = n.nspname and a.table_name = c.relname and a.grantee = 'anon'
  where n.nspname = 'public' and c.relkind = 'r';
$$;

grant execute on function tests.check_rls_coverage() to public;
