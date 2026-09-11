-- ============================================================================
--  0002 — DOSSIER PATIENT, ENTOURAGE ET PARCOURS DE PRISE EN SOIN
-- ============================================================================
--  CE QUE CE FICHIER CORRIGE dans le modèle actuel :
--
--   · Un patient portait UN responsable légal, dans un objet JSON sans identité
--     propre, non partageable entre deux enfants d'une même fratrie, et jamais
--     destinataire d'un envoi. Une garde alternée, deux domiciles, un beau-parent
--     n'étaient pas représentables.
--   · « Tuteur / Parent » confondait deux régimes juridiques distincts :
--     l'autorité parentale sur un mineur, et la protection d'un majeur (tutelle,
--     curatelle, habilitation familiale). Ce ne sont pas des synonymes.
--   · Responsable légal, destinataire, payeur, assuré, prescripteur et adresseur
--     étaient au mieux des champs texte, au pire confondus. Ce sont SIX rôles
--     différents, qui peuvent être tenus par la même personne ou par six.
--   · Rien ne reliait un bilan initial, le suivi qui l'a suivi et la
--     réévaluation d'un an après. Aucun début, aucune fin, aucun statut.
--   · L'article L1111-7 du CSP exclut du droit d'accès les informations
--     concernant un tiers n'intervenant pas dans la prise en charge. Aucun
--     marquage ne permettait de préparer une communication de dossier conforme.
--
--  CE QU'IL NE FAIT PAS. Il ne touche pas aux tables de la v1. Le schéma cible
--  se construit à part (voir `supabase/schema-v1/README.md`) ; la bascule fera
--  l'objet d'un lot dédié, avec un plan de retour arrière et une autorisation
--  explicite au moment de l'action.
-- ============================================================================

-- ============================================================================
--  LECTURE CLINIQUE — un rôle de plus que « membre »
-- ============================================================================
--  Un assistant administratif a besoin des coordonnées, des rendez-vous et de
--  la facturation. Il n'a pas besoin des notes cliniques. La distinction est
--  portée ici plutôt que par l'interface.
--  [VALIDATION HUMAINE] Le périmètre exact de l'accès administratif reste à
--  arbitrer avec une psychomotricienne en exercice (docs/context/USERS.md).
create or replace function app.can_read_clinical(p_practice_id uuid)
returns boolean
language sql
stable
as $$
  select app.has_role(p_practice_id, array['owner', 'practitioner']);
$$;
revoke all on function app.can_read_clinical(uuid) from public;
grant execute on function app.can_read_clinical(uuid) to authenticated;

-- ============================================================================
--  PATIENTS
-- ============================================================================
create table public.patients (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,

  -- Identité. `last_name` est le nom employé au quotidien ; `birth_name` n'est
  -- saisi que s'il diffère et qu'il sert réellement (courrier administratif,
  -- correspondance avec un autre professionnel).
  first_name text not null default '',
  last_name text not null default '',
  birth_name text,
  preferred_name text,
  birth_date date,

  -- Sexe de référence pour l'ÉTALONNAGE d'un instrument, et rien d'autre.
  -- Plusieurs épreuves ont des normes distinctes ; sans cette donnée, un score
  -- dérivé ne peut pas être lu correctement. Volontairement nullable : un bilan
  -- sans aucun score n'en a aucun besoin, et la minimisation l'exige.
  -- [VALIDATION HUMAINE] Intitulé et valeurs à valider par une praticienne.
  norm_reference_sex text
    check (norm_reference_sex is null or norm_reference_sex in ('f', 'm', 'autre')),

  -- Coordonnées propres au patient. Pour un enfant, elles sont normalement
  -- VIDES : ce sont celles des titulaires de l'autorité parentale, qui vivent
  -- dans `contacts`. Les y recopier était précisément le défaut de la v1.
  email text,
  phone text,
  address_line1 text,
  address_line2 text,
  postal_code text,
  city text,
  country_code text not null default 'FR',

  -- Notes ADMINISTRATIVES : préférence d'horaire, accès au cabinet, langue.
  -- Le contenu clinique a sa propre table, datée et attribuée.
  administrative_notes text,

  status text not null default 'actif'
    check (status in ('actif', 'archive')),
  archived_at timestamptz,
  archive_reason text,

  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),

  constraint patients_identite_ck
    check (length(btrim(first_name)) > 0 or length(btrim(last_name)) > 0),
  constraint patients_archive_ck
    check ((status = 'archive') = (archived_at is not null))
);
create index idx_patients_practice on public.patients (practice_id)
  where status = 'actif';
create index idx_patients_nom on public.patients
  (practice_id, lower(last_name), lower(first_name));
-- Détection de doublons : même nom, même date de naissance, même cabinet.
create index idx_patients_doublon on public.patients
  (practice_id, lower(last_name), birth_date) where birth_date is not null;
create trigger patients_updated_at before update on public.patients
  for each row execute function app.set_updated_at();

-- ============================================================================
--  CONTACTS — toute personne ou organisation gravitant autour d'un dossier
-- ============================================================================
--  Un contact a une IDENTITÉ PROPRE. C'est ce qui permet à une mère d'être
--  rattachée à ses deux enfants suivis, avec une seule adresse à tenir à jour.
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,

  kind text not null default 'personne'
    check (kind in ('personne', 'organisation')),

  -- Personne
  first_name text,
  last_name text,
  -- Organisation : école, PCO, CMPP, établissement, organisme payeur…
  organisation_name text,

  -- Pour un professionnel de santé : profession déclarée et identifiant.
  -- Déclaratif, jamais vérifié par le logiciel.
  profession text,
  rpps text,

  email text,
  phone text,
  address_line1 text,
  address_line2 text,
  postal_code text,
  city text,
  country_code text not null default 'FR',

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint contacts_nom_ck check (
    (kind = 'personne'
      and (length(btrim(coalesce(first_name, ''))) > 0
        or length(btrim(coalesce(last_name, ''))) > 0))
    or
    (kind = 'organisation'
      and length(btrim(coalesce(organisation_name, ''))) > 0)
  )
);
create index idx_contacts_practice on public.contacts (practice_id);
create index idx_contacts_nom on public.contacts
  (practice_id, lower(coalesce(last_name, organisation_name)));
create trigger contacts_updated_at before update on public.contacts
  for each row execute function app.set_updated_at();

-- ============================================================================
--  LIENS PATIENT ↔ CONTACT — un rôle, une période
-- ============================================================================
--  LE POINT CENTRAL DE CE LOT. Un même contact peut tenir plusieurs rôles pour
--  un même patient : la mère peut être à la fois titulaire de l'autorité
--  parentale, destinataire des comptes rendus et payeuse. Ce sont trois lignes,
--  parce que ce sont trois droits différents, révocables séparément.
--
--  Les liens sont DATÉS : une autorité parentale, une mesure de protection, une
--  prise en charge par un organisme ont un début et parfois une fin. Écraser la
--  ligne ferait disparaître à qui l'on avait légitimement écrit l'an dernier.
create table public.patient_contacts (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,

  role text not null check (role in (
    'responsable_legal',   -- titulaire de l'autorité parentale, ou protecteur
    'parent_sans_autorite',-- parent ne détenant pas l'autorité parentale
    'proche',              -- entourage sans droit particulier
    'destinataire',        -- reçoit les documents
    'payeur',              -- règle les honoraires
    'assure',              -- ouvre les droits, distinct du payeur
    'adresseur',           -- a orienté vers le cabinet
    'professionnel',       -- autre professionnel intervenant
    'etablissement',       -- école, crèche, établissement d'accueil
    'autre'
  )),

  -- Qualifie UNIQUEMENT le rôle « responsable_legal ». L'autorité parentale sur
  -- un mineur et la protection d'un majeur sont deux régimes distincts ; les
  -- confondre sous le mot « tuteur » est une erreur de droit.
  legal_basis text check (legal_basis is null or legal_basis in (
    'autorite_parentale',
    'tutelle_majeur',
    'curatelle',
    'habilitation_familiale',
    'mandat_protection_future',
    'autre'
  )),

  -- Lien de parenté ou de fonction, en clair. Déclaratif.
  relationship text,

  valid_from date,
  valid_to date,

  -- Destinataire par défaut des envois, pour ce rôle.
  is_primary boolean not null default false,

  note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint patient_contacts_periode_ck
    check (valid_to is null or valid_from is null or valid_to >= valid_from),
  -- Un fondement juridique n'a de sens que pour un responsable légal.
  constraint patient_contacts_base_ck
    check (legal_basis is null or role = 'responsable_legal')
);
create index idx_patient_contacts_patient on public.patient_contacts (patient_id, role);
create index idx_patient_contacts_contact on public.patient_contacts (contact_id);
create index idx_patient_contacts_practice on public.patient_contacts (practice_id);
-- Un seul lien actif par (patient, contact, rôle) : on met fin au précédent
-- avant d'en ouvrir un nouveau.
create unique index uq_patient_contacts_actif
  on public.patient_contacts (patient_id, contact_id, role)
  where valid_to is null;
create trigger patient_contacts_updated_at before update on public.patient_contacts
  for each row execute function app.set_updated_at();

-- Le patient et le contact appartiennent au même cabinet que le lien. Sans
-- cette garde, un identifiant deviné suffirait à rattacher le contact d'un
-- autre cabinet — la RLS seule ne vérifie pas la cohérence des trois.
create or replace function app.guard_patient_contact_coherence()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.patients p
    where p.id = new.patient_id and p.practice_id = new.practice_id
  ) then
    raise exception 'Le patient n''appartient pas à ce cabinet.'
      using errcode = 'foreign_key_violation';
  end if;
  if not exists (
    select 1 from public.contacts c
    where c.id = new.contact_id and c.practice_id = new.practice_id
  ) then
    raise exception 'Le contact n''appartient pas à ce cabinet.'
      using errcode = 'foreign_key_violation';
  end if;
  return new;
end;
$$;
create trigger patient_contacts_coherence
  before insert or update on public.patient_contacts
  for each row execute function app.guard_patient_contact_coherence();

-- ============================================================================
--  PARCOURS DE PRISE EN SOIN
-- ============================================================================
--  Un patient peut avoir plusieurs parcours dans sa vie : un bilan à 5 ans, une
--  reprise à 9 ans après un nouvel adressage. Chacun porte SA demande, SA
--  prescription et SES objectifs. C'est le parcours qui reliera bilan initial,
--  séances et réévaluation.
--
--  La prescription vit ici, et non sur le patient : elle est attachée à un
--  épisode de soin, pas durablement à la personne. L4332-1 CSP conditionne
--  l'exercice à une prescription médicale ; la tracer par épisode est le seul
--  moyen de savoir laquelle couvre quoi.
create table public.care_pathways (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,

  label text,

  status text not null default 'demande' check (status in (
    'demande',        -- reçue, pas encore instruite
    'liste_attente',
    'actif',
    'en_pause',
    'termine',
    'interrompu',     -- arrêt à l'initiative de la famille ou du patient
    'reoriente'
  )),

  -- Motif tel qu'il est exprimé par le demandeur. On le conserve dans ses
  -- termes : c'est à lui que le compte rendu devra répondre.
  referral_reason text,
  referral_source_contact_id uuid references public.contacts(id) on delete set null,

  prescriber_contact_id uuid references public.contacts(id) on delete set null,
  prescription_date date,
  prescription_reference text,

  -- Dispositif de financement particulier (PCO, MDPH, établissement…).
  -- Le circuit complet est traité au lot 5 ; ce champ n'est qu'un rattachement.
  funding_scheme text check (funding_scheme is null or funding_scheme in (
    'liberal', 'pco', 'mdph', 'etablissement', 'autre'
  )),

  requested_on date,
  started_on date,
  ended_on date,
  end_reason text,

  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),

  constraint care_pathways_periode_ck
    check (ended_on is null or started_on is null or ended_on >= started_on),
  constraint care_pathways_fin_ck
    check ((status in ('termine', 'interrompu', 'reoriente')) = (ended_on is not null))
);
create index idx_care_pathways_patient on public.care_pathways (patient_id, status);
create index idx_care_pathways_practice on public.care_pathways (practice_id)
  where status in ('demande', 'liste_attente', 'actif');
create trigger care_pathways_updated_at before update on public.care_pathways
  for each row execute function app.set_updated_at();

create or replace function app.guard_pathway_coherence()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.patients p
    where p.id = new.patient_id and p.practice_id = new.practice_id
  ) then
    raise exception 'Le patient n''appartient pas à ce cabinet.'
      using errcode = 'foreign_key_violation';
  end if;
  return new;
end;
$$;
create trigger care_pathways_coherence
  before insert or update on public.care_pathways
  for each row execute function app.guard_pathway_coherence();

-- ============================================================================
--  OBJECTIFS
-- ============================================================================
--  Posés par le professionnel, réévalués par lui. Le logiciel ne les propose
--  pas, ne les note pas, ne conclut pas à leur atteinte.
create table public.care_objectives (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  pathway_id uuid not null references public.care_pathways(id) on delete cascade,

  -- Formulé en termes fonctionnels et observables.
  label text not null check (length(btrim(label)) > 0),
  detail text,

  status text not null default 'en_cours' check (status in (
    'en_cours', 'atteint', 'partiellement_atteint', 'abandonne', 'reformule'
  )),
  position integer not null default 0,

  set_on date,
  reviewed_on date,
  review_note text,

  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
create index idx_care_objectives_pathway on public.care_objectives (pathway_id, position);
create index idx_care_objectives_practice on public.care_objectives (practice_id);
create trigger care_objectives_updated_at before update on public.care_objectives
  for each row execute function app.set_updated_at();

-- ============================================================================
--  NOTES CLINIQUES
-- ============================================================================
--  Remplace le champ texte libre du dossier patient, qui n'avait ni auteur, ni
--  date, ni statut — ce que la sécurité clinique exige pourtant.
--
--  `third_party_information` applique l'article L1111-7 du CSP : le droit
--  d'accès du patient exclut les informations recueillies auprès d'un tiers
--  n'intervenant pas dans la prise en charge, ou concernant un tel tiers.
--  Marquer l'information est le SEUL moyen technique de préparer un jour une
--  communication de dossier conforme. Le produit ne promet pas que la note est
--  inaccessible : il permet de la distinguer.
--  [VALIDATION HUMAINE] Régime exact d'accès aux notes du praticien libéral :
--  à instruire auprès d'un DPO ou d'un juriste santé.
create table public.patient_notes (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  pathway_id uuid references public.care_pathways(id) on delete set null,

  body text not null check (length(btrim(body)) > 0),
  written_on date not null default current_date,

  author_member_id uuid references public.practice_members(id) on delete set null,

  third_party_information boolean not null default false,
  third_party_source text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint patient_notes_tiers_ck
    check (third_party_source is null or third_party_information)
);
create index idx_patient_notes_patient on public.patient_notes (patient_id, written_on desc);
create index idx_patient_notes_practice on public.patient_notes (practice_id);
create trigger patient_notes_updated_at before update on public.patient_notes
  for each row execute function app.set_updated_at();

-- ============================================================================
--  CONSENTEMENTS ET AUTORISATIONS
-- ============================================================================
--  Un consentement se DONNE et se RETIRE. Une ligne retirée reste : savoir
--  qu'une autorisation a existé puis a été révoquée fait partie de la trace.
create table public.patient_consents (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,

  kind text not null check (kind in (
    'information_recue',       -- la personne a reçu la notice d'information
    'partage_professionnels',  -- échange avec d'autres professionnels nommés
    'partage_etablissement',
    'transmission_prescripteur',
    'photo_video',
    'autre'
  )),
  scope text,

  -- Qui a consenti : le patient lui-même, ou un responsable légal.
  granted_by_contact_id uuid references public.contacts(id) on delete set null,
  granted_by_patient boolean not null default false,

  granted_on date,
  withdrawn_on date,
  evidence text,   -- « formulaire signé du 12/03 », « accord oral tracé »

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint patient_consents_retrait_ck
    check (withdrawn_on is null or granted_on is null or withdrawn_on >= granted_on)
);
create index idx_patient_consents_patient on public.patient_consents (patient_id, kind);
create index idx_patient_consents_practice on public.patient_consents (practice_id);
create trigger patient_consents_updated_at before update on public.patient_consents
  for each row execute function app.set_updated_at();

-- ============================================================================
--  ROW LEVEL SECURITY — refus par défaut
-- ============================================================================
alter table public.patients         enable row level security;
alter table public.contacts         enable row level security;
alter table public.patient_contacts enable row level security;
alter table public.care_pathways    enable row level security;
alter table public.care_objectives  enable row level security;
alter table public.patient_notes    enable row level security;
alter table public.patient_consents enable row level security;

alter table public.patients         force row level security;
alter table public.contacts         force row level security;
alter table public.patient_contacts force row level security;
alter table public.care_pathways    force row level security;
alter table public.care_objectives  force row level security;
alter table public.patient_notes    force row level security;
alter table public.patient_consents force row level security;

-- Dossier administratif : tout membre actif lit, les praticiens écrivent.
create policy patients_select on public.patients
  for select to authenticated using (app.is_member(practice_id));
create policy patients_write on public.patients
  for all to authenticated
  using (app.can_write(practice_id)) with check (app.can_write(practice_id));

create policy contacts_select on public.contacts
  for select to authenticated using (app.is_member(practice_id));
create policy contacts_write on public.contacts
  for all to authenticated
  using (app.can_write(practice_id)) with check (app.can_write(practice_id));

create policy patient_contacts_select on public.patient_contacts
  for select to authenticated using (app.is_member(practice_id));
create policy patient_contacts_write on public.patient_contacts
  for all to authenticated
  using (app.can_write(practice_id)) with check (app.can_write(practice_id));

create policy care_pathways_select on public.care_pathways
  for select to authenticated using (app.is_member(practice_id));
create policy care_pathways_write on public.care_pathways
  for all to authenticated
  using (app.can_write(practice_id)) with check (app.can_write(practice_id));

create policy patient_consents_select on public.patient_consents
  for select to authenticated using (app.is_member(practice_id));
create policy patient_consents_write on public.patient_consents
  for all to authenticated
  using (app.can_write(practice_id)) with check (app.can_write(practice_id));

-- Contenu clinique : réservé aux praticiens. Un assistant administratif voit le
-- dossier et l'agenda, pas les objectifs thérapeutiques ni les notes.
create policy care_objectives_select on public.care_objectives
  for select to authenticated using (app.can_read_clinical(practice_id));
create policy care_objectives_write on public.care_objectives
  for all to authenticated
  using (app.can_write(practice_id)) with check (app.can_write(practice_id));

create policy patient_notes_select on public.patient_notes
  for select to authenticated using (app.can_read_clinical(practice_id));
create policy patient_notes_write on public.patient_notes
  for all to authenticated
  using (app.can_write(practice_id)) with check (app.can_write(practice_id));

-- ============================================================================
--  PRIVILÈGES
-- ============================================================================
grant select, insert, update, delete on public.patients         to authenticated;
grant select, insert, update, delete on public.contacts         to authenticated;
grant select, insert, update, delete on public.patient_contacts to authenticated;
grant select, insert, update, delete on public.care_pathways    to authenticated;
grant select, insert, update, delete on public.care_objectives  to authenticated;
grant select, insert, update, delete on public.patient_notes    to authenticated;
grant select, insert, update, delete on public.patient_consents to authenticated;

-- ============================================================================
--  ARCHIVAGE
-- ============================================================================
--  Un dossier ne se supprime pas d'un clic : des pièces comptables en dépendent,
--  et le référentiel CNIL 2020-081 retient 5 ans en base active puis 15 ans
--  d'archivage intermédiaire. L'archivage est donc la voie normale ; la
--  suppression restera une opération distincte, instruite au lot dédié aux
--  droits des personnes.
--  [VALIDATION HUMAINE] Durées de conservation : DPO et expert-comptable.
create or replace function public.archive_patient(
  p_patient_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_practice uuid;
begin
  select practice_id into v_practice from public.patients where id = p_patient_id;
  if v_practice is null or not app.can_write(v_practice) then
    raise exception 'Accès refusé.' using errcode = 'insufficient_privilege';
  end if;

  update public.patients
     set status = 'archive',
         archived_at = now(),
         archive_reason = p_reason
   where id = p_patient_id;

  -- Un parcours encore ouvert sur un dossier archivé serait incohérent.
  update public.care_pathways
     set status = 'termine',
         ended_on = coalesce(ended_on, current_date),
         end_reason = coalesce(end_reason, 'Dossier archivé')
   where patient_id = p_patient_id
     and status in ('demande', 'liste_attente', 'actif', 'en_pause');

  insert into public.audit_events
    (practice_id, actor_user_id, action, subject_type, subject_id)
  values
    (v_practice, app.current_user_id(), 'patient.archive', 'patient', p_patient_id);
end;
$$;
revoke all on function public.archive_patient(uuid, text) from public;
grant execute on function public.archive_patient(uuid, text) to authenticated;

create or replace function public.unarchive_patient(p_patient_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_practice uuid;
begin
  select practice_id into v_practice from public.patients where id = p_patient_id;
  if v_practice is null or not app.can_write(v_practice) then
    raise exception 'Accès refusé.' using errcode = 'insufficient_privilege';
  end if;

  -- Les parcours clos le restent : les rouvrir serait une décision clinique,
  -- pas une conséquence mécanique.
  update public.patients
     set status = 'actif', archived_at = null, archive_reason = null
   where id = p_patient_id;

  insert into public.audit_events
    (practice_id, actor_user_id, action, subject_type, subject_id)
  values
    (v_practice, app.current_user_id(), 'patient.unarchive', 'patient', p_patient_id);
end;
$$;
revoke all on function public.unarchive_patient(uuid) from public;
grant execute on function public.unarchive_patient(uuid) to authenticated;
