-- ============================================================
--  PSYCHOMOTIME — Schéma de base de données
--  À coller dans : Supabase > SQL Editor > New query > Run
--  (Ce script peut être relancé sans danger.)
-- ============================================================

-- ---------- PARAMÈTRES (1 ligne par utilisateur) ----------
create table if not exists public.settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  retrocession_rate numeric not null default 0.25,   -- 25 %
  urssaf_rate numeric not null default 0.232,         -- 23,2 %
  charge_mode text not null default 'retrocession' check (charge_mode in ('retrocession','loyer')),
  monthly_rent numeric not null default 0,            -- loyer mensuel
  profile jsonb not null default '{}'::jsonb,         -- logo (base64), adresse, SIRET, ADELI, mentions, contacts
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- PATIENTS ----------
create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  birth_date date,
  email text,
  phone text,
  address text,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------- FACTURES (comptabilité) ----------
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete set null,
  patient_name text not null default '',
  invoice_number text,
  billing_month text,
  billing_year integer,
  has_pco boolean not null default false,
  revenue_gross numeric not null default 0,           -- revenu brut
  revenue_gross_paid numeric not null default 0,      -- revenu brut payé
  payment_method text,                                -- ex: Virement, Espèces, Chèque, CB
  payment_date date,
  issue_date date,                                    -- date d'émission de la facture
  service_label text,                                 -- libellé de la prestation
  retrocession_amount numeric not null default 0,     -- montant rétrocession (ou 0 en mode loyer)
  urssaf_amount numeric not null default 0,           -- montant URSSAF estimé
  after_retro numeric generated always as (revenue_gross - retrocession_amount) stored,
  net_revenue numeric generated always as (revenue_gross - retrocession_amount - urssaf_amount) stored,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------- CHARGES / LOYERS ----------
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text not null default 'loyer',                 -- loyer, urssaf, autre
  label text,
  amount numeric not null default 0,
  expense_date date,
  period_month text,
  period_year integer,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------- BILANS PSYCHOMOTEURS ----------
create table if not exists public.bilans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete set null,
  patient_name text not null default '',
  title text not null default 'Bilan psychomoteur',
  bilan_date date,
  author text,
  status text not null default 'brouillon' check (status in ('brouillon','finalisé')),
  content jsonb not null default '{}'::jsonb,
  tests jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
--  SÉCURITÉ (Row Level Security) — chaque compte ne voit
--  que ses propres données.
-- ============================================================
alter table public.settings  enable row level security;
alter table public.patients  enable row level security;
alter table public.invoices  enable row level security;
alter table public.expenses  enable row level security;
alter table public.bilans    enable row level security;

drop policy if exists "own settings" on public.settings;
drop policy if exists "own patients" on public.patients;
drop policy if exists "own invoices" on public.invoices;
drop policy if exists "own expenses" on public.expenses;
drop policy if exists "own bilans"   on public.bilans;

create policy "own settings" on public.settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own patients" on public.patients for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own invoices" on public.invoices for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own expenses" on public.expenses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own bilans"   on public.bilans   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- INDEX ----------
create index if not exists idx_invoices_user on public.invoices(user_id);
create index if not exists idx_patients_user on public.patients(user_id);
create index if not exists idx_bilans_user   on public.bilans(user_id);
create index if not exists idx_expenses_user on public.expenses(user_id);

-- ---------- Création auto de la ligne "settings" à l'inscription ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.settings (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
