-- ============================================================
--  PSYCHOMOTIME — Migration 004 : SaaS multi-compte + abonnements
--  À coller dans : Supabase > SQL Editor > New query > Run
--  (Relançable sans danger.)
-- ============================================================

-- ---------- Table des abonnements (1 ligne par compte) ----------
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  status text not null default 'trialing',       -- trialing | active | inactive | past_due | canceled
  is_admin boolean not null default false,        -- super-administrateur
  manual_override boolean not null default false, -- accès accordé manuellement
  trial_end timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

-- ---------- Helper : l'utilisateur courant est-il admin ? ----------
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select is_admin from public.subscriptions where user_id = auth.uid()),
    false
  );
$$;

-- ---------- Politiques RLS ----------
drop policy if exists "sub read" on public.subscriptions;
create policy "sub read" on public.subscriptions for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "sub self insert" on public.subscriptions;
create policy "sub self insert" on public.subscriptions for insert
  with check (auth.uid() = user_id);

drop policy if exists "sub admin update" on public.subscriptions;
create policy "sub admin update" on public.subscriptions for update
  using (public.is_admin()) with check (public.is_admin());

-- ---------- Création auto à l'inscription (settings + abonnement) ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.settings (user_id) values (new.id)
  on conflict (user_id) do nothing;

  insert into public.subscriptions (user_id, email, is_admin, manual_override, status, trial_end)
  values (
    new.id,
    new.email,
    (new.email = 'tom.marcon@live.fr'),
    (new.email = 'tom.marcon@live.fr'),
    case when new.email = 'tom.marcon@live.fr' then 'active' else 'trialing' end,
    now() + interval '7 days'
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Backfill des comptes déjà existants ----------
insert into public.subscriptions (user_id, email, is_admin, manual_override, status, trial_end)
select
  id,
  email,
  (email = 'tom.marcon@live.fr'),
  (email = 'tom.marcon@live.fr'),
  case when email = 'tom.marcon@live.fr' then 'active' else 'trialing' end,
  now() + interval '7 days'
from auth.users
on conflict (user_id) do nothing;

-- S'assurer que le compte admin est bien admin (au cas où la ligne existait déjà)
update public.subscriptions
  set is_admin = true, manual_override = true, status = 'active'
  where email = 'tom.marcon@live.fr';
