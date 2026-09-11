-- ============================================================================
--  0001 — SOCLE D'IDENTITÉ ET D'ISOLATION
-- ============================================================================
--  Pose le locataire du système : le CABINET (`practices`), et non le compte
--  utilisateur. Un utilisateur accède aux données d'un cabinet parce qu'il en
--  est membre actif, jamais parce qu'il en est propriétaire nominal.
--
--  Principes tenus par ce fichier, et vérifiés par `supabase/tests/` :
--   1. RLS activée ET forcée sur chaque table ; aucune table sans politique.
--   2. Refus par défaut : ce qui n'est pas explicitement autorisé est refusé.
--   3. Les fonctions `security definer` vivent dans le schéma `app`, ne sont
--      pas exposées par PostgREST, ont un `search_path` épinglé et ne
--      répondent que sur l'utilisateur courant — jamais sur un utilisateur arbitraire.
--   4. L'argent est en CENTIMES ENTIERS (`bigint`), les taux en POINTS DE BASE
--      (`integer`, 1 bp = 0,01 %). Aucun flottant monétaire, jamais.
--   5. Les paramètres qui changent dans le temps sont DATÉS, pour qu'une pièce
--      émise puisse être relue avec les paramètres en vigueur à sa date.
-- ============================================================================

create extension if not exists pgcrypto;

-- ============================================================================
--  SCHÉMA app — fonctions internes, hors de la surface d'API
-- ============================================================================
create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to authenticated;

-- ---------- horodatage ----------
create or replace function app.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ============================================================================
--  CABINETS
-- ============================================================================
create table public.practices (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 200),
  -- Sert au rendu documentaire par défaut quand aucune entité juridique n'est
  -- encore saisie. Jamais une source de vérité fiscale.
  timezone text not null default 'Europe/Paris',
  locale text not null default 'fr-FR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create trigger practices_updated_at before update on public.practices
  for each row execute function app.set_updated_at();

-- ============================================================================
--  APPARTENANCES
-- ============================================================================
--  `role` et `status` sont contraints par CHECK plutôt que par un type ENUM :
--  ajouter un rôle reste une migration simple, et la contrainte est aussi
--  ferme. Voir ADR-002.
create table public.practice_members (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'practitioner'
    check (role in ('owner', 'practitioner', 'assistant', 'accountant', 'readonly')),
  status text not null default 'invited'
    check (status in ('invited', 'active', 'suspended', 'revoked')),
  invited_at timestamptz not null default now(),
  joined_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (practice_id, user_id)
);
create index idx_practice_members_user_active
  on public.practice_members (user_id) where status = 'active';
create index idx_practice_members_practice on public.practice_members (practice_id);
create trigger practice_members_updated_at before update on public.practice_members
  for each row execute function app.set_updated_at();

-- Un cabinet garde au moins un propriétaire actif.
create or replace function app.guard_last_owner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_practice uuid := coalesce(old.practice_id, new.practice_id);
  v_owners integer;
begin
  select count(*) into v_owners
  from public.practice_members m
  where m.practice_id = v_practice
    and m.role = 'owner'
    and m.status = 'active'
    and m.id <> coalesce(old.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if tg_op = 'UPDATE'
     and new.role = 'owner' and new.status = 'active' then
    return new;   -- la ligne reste un propriétaire actif
  end if;

  if v_owners = 0 and old.role = 'owner' and old.status = 'active' then
    raise exception
      'Un cabinet doit conserver au moins un propriétaire actif.'
      using errcode = 'check_violation';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger practice_members_last_owner
  before update or delete on public.practice_members
  for each row execute function app.guard_last_owner();

-- ============================================================================
--  ADMINISTRATION DE LA PLATEFORME
-- ============================================================================
--  Remplace l'adresse e-mail codée en dur dans l'ancien SQL. Le privilège est
--  une DONNÉE, révocable par une ligne supprimée.
create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  note text
);

-- ============================================================================
--  ABONNEMENT — porté par le cabinet, pas par l'utilisateur
-- ============================================================================
create table public.practice_subscriptions (
  practice_id uuid primary key references public.practices(id) on delete cascade,
  status text not null default 'trialing'
    check (status in ('trialing', 'active', 'past_due', 'inactive', 'canceled')),
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  -- Activation manuelle, tant qu'aucun encaissement n'est branché.
  manual_override boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger practice_subscriptions_updated_at before update on public.practice_subscriptions
  for each row execute function app.set_updated_at();

-- Vérité unique de l'accès payant, lisible depuis SQL comme depuis le serveur.
create or replace function app.subscription_is_active(p_practice_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.practice_subscriptions s
    where s.practice_id = p_practice_id
      and (
        s.manual_override
        or s.status = 'active'
        or (s.status = 'trialing' and coalesce(s.trial_ends_at, now()) > now())
      )
  );
$$;
revoke all on function app.subscription_is_active(uuid) from public;
grant execute on function app.subscription_is_active(uuid) to authenticated;

-- ============================================================================
--  PROFIL PROFESSIONNEL
-- ============================================================================
create table public.practitioner_profiles (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  member_id uuid not null references public.practice_members(id) on delete cascade,
  display_name text not null default '',
  -- Titre protégé, imprimé après le nom. Champ structuré : plus une suggestion
  -- noyée dans le nom affiché.
  diploma_title text not null default 'Psychomotricien D.E.',
  email text,
  phone text,
  signature_storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id)
);
create index idx_practitioner_profiles_practice on public.practitioner_profiles (practice_id);
create trigger practitioner_profiles_updated_at before update on public.practitioner_profiles
  for each row execute function app.set_updated_at();

-- ============================================================================
--  ENTITÉ JURIDIQUE
-- ============================================================================
--  Ne confond pas forme juridique, régime fiscal, régime social, méthode
--  comptable et régime de TVA : ce sont cinq axes indépendants. La
--  micro-entreprise n'est pas une société, c'est un RÉGIME de l'entreprise
--  individuelle — d'où `legal_form = 'entreprise_individuelle'` et
--  `tax_regime = 'micro_bnc'` dans `fiscal_configurations`.
create table public.legal_entities (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  legal_name text not null default '',
  trade_name text,
  legal_form text not null default 'entreprise_individuelle'
    check (legal_form in (
      'entreprise_individuelle', 'eurl', 'sarl', 'sasu', 'sas',
      'selarl', 'selasu', 'selas', 'sci', 'association', 'autre'
    )),
  address_line1 text,
  address_line2 text,
  postal_code text,
  city text,
  country_code text not null default 'FR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_legal_entities_practice on public.legal_entities (practice_id);
create trigger legal_entities_updated_at before update on public.legal_entities
  for each row execute function app.set_updated_at();

-- ============================================================================
--  IDENTIFIANTS PROFESSIONNELS — datés
-- ============================================================================
--  L'ADELI a cessé d'être le référentiel des psychomotriciens au profit du
--  RPPS. Un identifiant porte donc sa période de validité : un document émis
--  en 2023 peut légitimement porter un identifiant qui ne vaut plus en 2026.
--  [VALIDATION HUMAINE] Les dates exactes de bascule restent à confirmer —
--  voir docs/refonte/recherche/01-clinique-domaines.md.
create table public.professional_identifiers (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  practitioner_profile_id uuid references public.practitioner_profiles(id) on delete cascade,
  legal_entity_id uuid references public.legal_entities(id) on delete cascade,
  kind text not null check (kind in (
    'rpps', 'adeli', 'siret', 'siren', 'ape', 'tva_intracom',
    'finess', 'numero_am', 'assurance_rcp', 'autre'
  )),
  value text not null check (length(btrim(value)) > 0),
  valid_from date,
  valid_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Un identifiant se rattache soit à un praticien, soit à l'entité juridique.
  constraint professional_identifiers_owner_ck check (
    (practitioner_profile_id is not null) <> (legal_entity_id is not null)
  ),
  constraint professional_identifiers_period_ck check (
    valid_to is null or valid_from is null or valid_to >= valid_from
  )
);
create index idx_professional_identifiers_practice on public.professional_identifiers (practice_id);
create trigger professional_identifiers_updated_at before update on public.professional_identifiers
  for each row execute function app.set_updated_at();

-- ============================================================================
--  CONFIGURATION FISCALE ET SOCIALE — datée
-- ============================================================================
--  Aucun taux n'est codé en dur dans l'application : il est lu ici, à la date
--  qui s'applique. Ré-enregistrer une pièce ancienne ne peut donc plus la
--  retarifer au taux du jour.
create table public.fiscal_configurations (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  legal_entity_id uuid references public.legal_entities(id) on delete set null,
  valid_from date not null,
  valid_to date,

  tax_regime text not null
    check (tax_regime in ('micro_bnc', 'bnc_reel', 'is', 'autre')),
  social_scheme text not null default 'tns'
    check (social_scheme in ('tns', 'assimile_salarie', 'autre')),
  accounting_method text not null default 'recettes_depenses'
    check (accounting_method in ('recettes_depenses', 'creances_dettes')),
  -- L'exonération des soins (CGI art. 261-4-1°) et la franchise en base
  -- (CGI art. 293 B) sont deux choses différentes : elles ne se cumulent pas
  -- dans un même champ. [VALIDATION HUMAINE] expert-comptable.
  vat_regime text not null default 'exoneration_soins'
    check (vat_regime in ('exoneration_soins', 'franchise_en_base', 'assujetti', 'mixte')),

  -- Rétrocession ET loyer coexistent : changer de mode n'efface plus l'autre
  -- valeur. Le mode dit seulement laquelle s'applique au calcul.
  charge_arrangement text not null default 'aucun'
    check (charge_arrangement in ('aucun', 'retrocession', 'loyer', 'mixte')),
  retrocession_rate_bp integer not null default 0
    check (retrocession_rate_bp between 0 and 10000),
  monthly_rent_cents bigint not null default 0
    check (monthly_rent_cents >= 0),

  -- Estimation, jamais un calcul de cotisations. L'intitulé porté à l'écran
  -- doit le dire.
  social_contribution_rate_bp integer not null default 0
    check (social_contribution_rate_bp between 0 and 10000),

  -- Traçabilité de la valeur : d'où elle vient et quand elle a été vérifiée.
  source_url text,
  source_checked_on date,
  note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fiscal_configurations_period_ck check (valid_to is null or valid_to > valid_from)
);
create index idx_fiscal_configurations_practice on public.fiscal_configurations (practice_id, valid_from desc);
-- Une seule configuration ouverte à la fois par cabinet.
create unique index uq_fiscal_configurations_open
  on public.fiscal_configurations (practice_id) where valid_to is null;
create trigger fiscal_configurations_updated_at before update on public.fiscal_configurations
  for each row execute function app.set_updated_at();

-- ============================================================================
--  LIEUX D'EXERCICE
-- ============================================================================
create table public.practice_locations (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  label text not null default '',
  address_line1 text,
  address_line2 text,
  postal_code text,
  city text,
  country_code text not null default 'FR',
  is_primary boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_practice_locations_practice on public.practice_locations (practice_id);
create unique index uq_practice_locations_primary
  on public.practice_locations (practice_id) where is_primary;
create trigger practice_locations_updated_at before update on public.practice_locations
  for each row execute function app.set_updated_at();

-- ============================================================================
--  PARAMÈTRES DU CABINET — datés
-- ============================================================================
--  Un document finalisé référence la version de paramètres en vigueur à sa
--  date. Changer l'apparence ou la formule de fin ne réécrit plus l'historique.
create table public.practice_settings (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  valid_from timestamptz not null default now(),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
create index idx_practice_settings_practice on public.practice_settings (practice_id, valid_from desc);

-- ============================================================================
--  JOURNAL D'ÉVÉNEMENTS — en ajout seul
-- ============================================================================
--  Aucune politique INSERT, UPDATE ou DELETE n'est créée : une ligne ne peut
--  entrer que par `public.log_audit_event`, et rien ne peut la modifier ni
--  l'effacer depuis l'API. `metadata` ne doit JAMAIS contenir de contenu
--  clinique — seulement des identifiants et des libellés d'action.
create table public.audit_events (
  id bigint generated always as identity primary key,
  practice_id uuid references public.practices(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (length(btrim(action)) > 0),
  subject_type text,
  subject_id uuid,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);
create index idx_audit_events_practice on public.audit_events (practice_id, occurred_at desc);
create index idx_audit_events_subject on public.audit_events (subject_type, subject_id);

create or replace function public.log_audit_event(
  p_practice_id uuid,
  p_action text,
  p_subject_type text default null,
  p_subject_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id bigint;
begin
  if not app.is_member(p_practice_id) then
    raise exception 'Accès refusé.' using errcode = 'insufficient_privilege';
  end if;

  insert into public.audit_events
    (practice_id, actor_user_id, action, subject_type, subject_id, metadata)
  values
    (p_practice_id, app.current_user_id(), p_action, p_subject_type, p_subject_id,
     coalesce(p_metadata, '{}'::jsonb))
  returning id into v_id;

  return v_id;
end;
$$;
revoke all on function public.log_audit_event(uuid, text, text, uuid, jsonb) from public;
grant execute on function public.log_audit_event(uuid, text, text, uuid, jsonb) to authenticated;

-- ============================================================================
--  CRÉATION D'UN CABINET
-- ============================================================================
--  Le cabinet et son propriétaire naissent dans la même transaction : aucune
--  fenêtre où un cabinet existerait sans membre. C'est pourquoi `practices`
--  n'a pas de politique INSERT.
create or replace function public.create_practice(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_practice_id uuid;
  v_member_id uuid;
  v_user uuid := app.current_user_id();
begin
  if v_user is null then
    raise exception 'Session requise.' using errcode = 'insufficient_privilege';
  end if;
  if coalesce(length(btrim(p_name)), 0) = 0 then
    raise exception 'Le nom du cabinet est obligatoire.' using errcode = 'check_violation';
  end if;

  insert into public.practices (name) values (btrim(p_name))
  returning id into v_practice_id;

  insert into public.practice_members (practice_id, user_id, role, status, joined_at)
  values (v_practice_id, v_user, 'owner', 'active', now())
  returning id into v_member_id;

  insert into public.practitioner_profiles (practice_id, member_id)
  values (v_practice_id, v_member_id);

  insert into public.practice_subscriptions (practice_id, status, trial_ends_at)
  values (v_practice_id, 'trialing', now() + interval '14 days');

  insert into public.audit_events (practice_id, actor_user_id, action, subject_type, subject_id)
  values (v_practice_id, v_user, 'practice.create', 'practice', v_practice_id);

  return v_practice_id;
end;
$$;
revoke all on function public.create_practice(text) from public;
grant execute on function public.create_practice(text) to authenticated;

-- ---------- identité de l'appelant ----------
--  SEUL POINT DE CONTACT AVEC SUPABASE DANS TOUT LE SCHÉMA.
--
--  `auth.uid()` est fourni par Supabase. Si l'hébergement doit changer — et
--  l'audit HDS du 2026-09-11 rend cette hypothèse sérieuse — c'est cette
--  fonction, et elle seule, qui sera réécrite. Aucune politique RLS, aucune
--  autre fonction n'appelle `auth.` directement ; un test de couverture le
--  vérifie (`supabase/tests/010_couverture_rls.sql`).
create or replace function app.current_user_id()
returns uuid
language sql
stable
as $$
  select auth.uid();
$$;
revoke all on function app.current_user_id() from public;
grant execute on function app.current_user_id() to authenticated;

-- ---------- appartenance ----------
-- SECURITY DEFINER : lit `practice_members` sans déclencher la RLS de cette
-- même table, ce qui rendrait les politiques récursives. Borne stricte : la
-- fonction ne répond QUE sur l'utilisateur courant. Elle ne prend pas d'utilisateur en
-- paramètre et ne peut donc pas servir à interroger les droits d'un tiers.
create or replace function app.member_practice_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.practice_id
  from public.practice_members m
  where m.user_id = app.current_user_id()
    and m.status = 'active';
$$;

create or replace function app.is_member(p_practice_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_practice_id is not null
     and exists (
       select 1
       from public.practice_members m
       where m.practice_id = p_practice_id
         and m.user_id = app.current_user_id()
         and m.status = 'active'
     );
$$;

create or replace function app.has_role(p_practice_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_practice_id is not null
     and exists (
       select 1
       from public.practice_members m
       where m.practice_id = p_practice_id
         and m.user_id = app.current_user_id()
         and m.status = 'active'
         and m.role = any (p_roles)
     );
$$;

-- Droit d'administrer le cabinet : gérer les membres, l'entité juridique,
-- la configuration fiscale et les paramètres.
create or replace function app.can_administer(p_practice_id uuid)
returns boolean
language sql
stable
as $$
  select app.has_role(p_practice_id, array['owner']);
$$;

-- Droit d'écrire les données d'exercice (patients, bilans, séances…).
create or replace function app.can_write(p_practice_id uuid)
returns boolean
language sql
stable
as $$
  select app.has_role(p_practice_id, array['owner', 'practitioner']);
$$;

-- Administration de la PLATEFORME (abonnements). Volontairement sans aucun
-- accès aux données d'exercice : un administrateur de la plateforme ne lit
-- jamais un patient, un bilan ou une facture.
create or replace function app.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.platform_admins a where a.user_id = app.current_user_id()
  );
$$;

revoke all on function app.member_practice_ids() from public;
revoke all on function app.is_member(uuid) from public;
revoke all on function app.has_role(uuid, text[]) from public;
revoke all on function app.can_administer(uuid) from public;
revoke all on function app.can_write(uuid) from public;
revoke all on function app.is_platform_admin() from public;
grant execute on function app.member_practice_ids() to authenticated;
grant execute on function app.is_member(uuid) to authenticated;
grant execute on function app.has_role(uuid, text[]) to authenticated;
grant execute on function app.can_administer(uuid) to authenticated;
grant execute on function app.can_write(uuid) to authenticated;
grant execute on function app.is_platform_admin() to authenticated;

-- ============================================================================
--  ROW LEVEL SECURITY — refus par défaut
-- ============================================================================
alter table public.practices                enable row level security;
alter table public.practice_members         enable row level security;
alter table public.platform_admins          enable row level security;
alter table public.practice_subscriptions   enable row level security;
alter table public.practitioner_profiles    enable row level security;
alter table public.legal_entities           enable row level security;
alter table public.professional_identifiers enable row level security;
alter table public.fiscal_configurations    enable row level security;
alter table public.practice_locations       enable row level security;
alter table public.practice_settings        enable row level security;
alter table public.audit_events             enable row level security;

alter table public.practices                force row level security;
alter table public.practice_members         force row level security;
alter table public.platform_admins          force row level security;
alter table public.practice_subscriptions   force row level security;
alter table public.practitioner_profiles    force row level security;
alter table public.legal_entities           force row level security;
alter table public.professional_identifiers force row level security;
alter table public.fiscal_configurations    force row level security;
alter table public.practice_locations       force row level security;
alter table public.practice_settings        force row level security;
alter table public.audit_events             force row level security;

-- ---------- practices ----------
-- Pas de politique INSERT : un cabinet ne naît que par `create_practice`.
create policy practices_select on public.practices
  for select to authenticated
  using (app.is_member(id));
create policy practices_update on public.practices
  for update to authenticated
  using (app.can_administer(id))
  with check (app.can_administer(id));
-- Pas de politique DELETE : un cabinet s'archive (`archived_at`), il ne
-- s'efface pas — des pièces comptables en dépendent.

-- ---------- practice_members ----------
create policy practice_members_select on public.practice_members
  for select to authenticated
  using (app.is_member(practice_id));
create policy practice_members_insert on public.practice_members
  for insert to authenticated
  with check (app.can_administer(practice_id));
create policy practice_members_update on public.practice_members
  for update to authenticated
  using (app.can_administer(practice_id))
  with check (app.can_administer(practice_id));
create policy practice_members_delete on public.practice_members
  for delete to authenticated
  using (app.can_administer(practice_id));

-- ---------- platform_admins ----------
-- Lisible seulement par un administrateur de la plateforme. Aucune écriture
-- par l'API : le privilège s'accorde hors application.
create policy platform_admins_select on public.platform_admins
  for select to authenticated
  using (app.is_platform_admin());

-- ---------- practice_subscriptions ----------
create policy practice_subscriptions_select on public.practice_subscriptions
  for select to authenticated
  using (app.is_member(practice_id) or app.is_platform_admin());
create policy practice_subscriptions_update on public.practice_subscriptions
  for update to authenticated
  using (app.is_platform_admin())
  with check (app.is_platform_admin());

-- ---------- practitioner_profiles ----------
create policy practitioner_profiles_select on public.practitioner_profiles
  for select to authenticated
  using (app.is_member(practice_id));
create policy practitioner_profiles_insert on public.practitioner_profiles
  for insert to authenticated
  with check (app.can_administer(practice_id));
-- Un praticien édite son propre profil ; un propriétaire édite ceux du cabinet.
create policy practitioner_profiles_update on public.practitioner_profiles
  for update to authenticated
  using (
    app.can_administer(practice_id)
    or member_id in (
      select m.id from public.practice_members m
      where m.practice_id = practitioner_profiles.practice_id
        and m.user_id = app.current_user_id()
        and m.status = 'active'
    )
  )
  with check (app.is_member(practice_id));
create policy practitioner_profiles_delete on public.practitioner_profiles
  for delete to authenticated
  using (app.can_administer(practice_id));

-- ---------- tables de configuration du cabinet ----------
-- Lecture par tout membre actif, écriture réservée au propriétaire.
create policy legal_entities_select on public.legal_entities
  for select to authenticated using (app.is_member(practice_id));
create policy legal_entities_write on public.legal_entities
  for all to authenticated
  using (app.can_administer(practice_id))
  with check (app.can_administer(practice_id));

create policy professional_identifiers_select on public.professional_identifiers
  for select to authenticated using (app.is_member(practice_id));
create policy professional_identifiers_write on public.professional_identifiers
  for all to authenticated
  using (app.can_administer(practice_id))
  with check (app.can_administer(practice_id));

create policy fiscal_configurations_select on public.fiscal_configurations
  for select to authenticated using (app.is_member(practice_id));
create policy fiscal_configurations_write on public.fiscal_configurations
  for all to authenticated
  using (app.can_administer(practice_id))
  with check (app.can_administer(practice_id));

create policy practice_locations_select on public.practice_locations
  for select to authenticated using (app.is_member(practice_id));
create policy practice_locations_write on public.practice_locations
  for all to authenticated
  using (app.can_administer(practice_id))
  with check (app.can_administer(practice_id));

create policy practice_settings_select on public.practice_settings
  for select to authenticated using (app.is_member(practice_id));
create policy practice_settings_insert on public.practice_settings
  for insert to authenticated with check (app.can_administer(practice_id));
-- Pas d'UPDATE ni de DELETE : une version de paramètres est un fait daté.
-- On en ajoute une nouvelle, on ne réécrit pas la précédente.

-- ---------- audit_events ----------
create policy audit_events_select on public.audit_events
  for select to authenticated
  using (app.is_member(practice_id));
-- Aucune politique d'écriture : seul `log_audit_event` insère.

-- ============================================================================
--  PRIVILÈGES DE TABLE
-- ============================================================================
--  La RLS ne s'applique qu'aux tables où le rôle a déjà le privilège SQL.
--  On accorde explicitement, table par table, plutôt qu'en bloc.
grant select                         on public.practices                to authenticated;
grant update                         on public.practices                to authenticated;
grant select, insert, update, delete on public.practice_members         to authenticated;
grant select                         on public.platform_admins          to authenticated;
grant select, update                 on public.practice_subscriptions   to authenticated;
grant select, insert, update, delete on public.practitioner_profiles    to authenticated;
grant select, insert, update, delete on public.legal_entities           to authenticated;
grant select, insert, update, delete on public.professional_identifiers to authenticated;
grant select, insert, update, delete on public.fiscal_configurations    to authenticated;
grant select, insert, update, delete on public.practice_locations       to authenticated;
grant select, insert                 on public.practice_settings        to authenticated;
grant select                         on public.audit_events             to authenticated;

-- `anon` ne reçoit aucun privilège sur ces tables : un visiteur non
-- authentifié n'a rien à y lire.
