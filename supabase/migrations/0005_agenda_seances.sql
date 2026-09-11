-- ============================================================================
--  0005 — AGENDA, SÉANCES ET PRÉSENCES
-- ============================================================================
--  CE QUE CE FICHIER APPORTE. Les séances de suivi — l'essentiel du temps de
--  travail — n'existaient dans le système que sous forme de MONTANT SUR UNE
--  FACTURE. La praticienne ne pouvait pas savoir depuis le logiciel combien de
--  séances un enfant avait eues, ni ce qui s'y était passé. Et les dates de
--  séance commençaient à entrer dans le produit par la comptabilité : la trace
--  clinique de l'activité allait finir par vivre dans la facturation.
--
--  UNE SEULE TABLE, ET POURQUOI. Un rendez-vous et une séance ne sont pas deux
--  objets : dans une pratique libérale, l'un devient l'autre dans la quasi-
--  totalité des cas. Deux tables en relation un-à-un auraient produit deux
--  sources de vérité pour la même date. `appointments` porte donc le créneau
--  ET son issue ; `kind` dit ce qui était prévu, `attendance` ce qui s'est
--  réellement passé.
--
--  CE QUE CELA PRÉPARE. Une attestation de présence ne pourra être établie que
--  sur des rendez-vous marqués HONORÉS. C'est la raison de la contrainte la
--  plus importante de ce fichier : on ne peut pas marquer « honoré » un
--  rendez-vous qui n'a pas encore commencé.
-- ============================================================================

-- ============================================================================
--  LISTE D'ATTENTE — portée par le parcours, pas par une table de plus
-- ============================================================================
--  `care_pathways.status = 'liste_attente'` EST la liste d'attente. Une table
--  séparée aurait dupliqué la demande, le motif et le patient. On complète
--  donc le parcours de ce qui manque pour l'exploiter.
alter table public.care_pathways
  add column waitlisted_on date,
  add column waitlist_priority text
    check (waitlist_priority is null or waitlist_priority in ('normale', 'prioritaire')),
  -- Disponibilités annoncées par la famille : « mardi après 16 h, pas le
  -- mercredi ». Texte libre à dessein — toute tentative de structurer cela
  -- tombe sur un cas particulier dès la deuxième famille.
  add column availability_note text;

comment on column public.care_pathways.waitlisted_on is
  'Date d''entrée en liste d''attente. Sert à répondre honnêtement à « depuis combien de temps j''attends ? ».';

-- ============================================================================
--  RENDEZ-VOUS ET SÉANCES
-- ============================================================================
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,

  -- Nullable : une réunion d'équipe ou un temps administratif occupe l'agenda
  -- sans concerner un patient. Un rendez-vous de soin, lui, en a toujours un.
  patient_id uuid references public.patients(id) on delete cascade,
  pathway_id uuid references public.care_pathways(id) on delete set null,

  -- Qui reçoit. Dans un cabinet solo c'est toujours le même ; l'écrire permet
  -- d'accueillir un remplaçant sans réécrire la table.
  practitioner_member_id uuid references public.practice_members(id) on delete set null,
  location_id uuid references public.practice_locations(id) on delete set null,

  kind text not null default 'seance' check (kind in (
    'seance',        -- séance de suivi
    'bilan',         -- temps de passation
    'entretien',     -- anamnèse, entretien parental
    'restitution',   -- remise et explication d'un compte rendu
    'reunion',       -- équipe éducative, coordination
    'administratif', -- temps bloqué sans patient
    'autre'
  )),

  starts_at timestamptz not null,
  ends_at timestamptz not null,

  -- Ce qui s'est réellement passé. `a_venir` tant que rien n'est constaté :
  -- un rendez-vous passé et non qualifié reste visible comme tel, plutôt que
  -- de basculer tout seul dans un état qu'on n'a pas choisi.
  attendance text not null default 'a_venir' check (attendance in (
    'a_venir',
    'honore',
    'absent_excuse',
    'absent_non_excuse',
    'annule_praticien',
    'annule_patient',
    'reporte'
  )),
  attendance_note text,

  -- Une absence non facturable ne doit produire aucune ligne de facture. Le
  -- défaut suit l'issue ; le praticien garde la main, parce que la règle
  -- d'un cabinet à l'autre n'est pas la même.
  billable boolean not null default false,

  -- Pour un créneau sans patient.
  title text,
  note text,

  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),

  constraint appointments_duree_ck check (ends_at > starts_at),
  -- Un rendez-vous de soin concerne quelqu'un ; un temps administratif porte
  -- au moins un intitulé, sans quoi l'agenda affiche une case muette.
  constraint appointments_objet_ck check (
    patient_id is not null
    or (kind in ('reunion', 'administratif', 'autre')
        and length(btrim(coalesce(title, ''))) > 0)
  ),
  -- Un motif est attendu quand le rendez-vous n'a pas eu lieu : c'est ce qui
  -- permettra, plus tard, de distinguer une absence facturable d'une autre.
  constraint appointments_motif_ck check (
    attendance not in ('absent_non_excuse', 'annule_praticien', 'reporte')
    or length(btrim(coalesce(attendance_note, ''))) > 0
  )
);

create index idx_appointments_agenda
  on public.appointments (practice_id, starts_at desc);
create index idx_appointments_patient
  on public.appointments (patient_id, starts_at desc) where patient_id is not null;
create index idx_appointments_pathway
  on public.appointments (pathway_id) where pathway_id is not null;
-- Les rendez-vous passés qui n'ont pas encore été qualifiés : c'est la première
-- chose que le tableau de bord doit savoir montrer.
create index idx_appointments_a_qualifier
  on public.appointments (practice_id, starts_at) where attendance = 'a_venir';

create trigger appointments_updated_at before update on public.appointments
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
--  Cohérence et garde-fous
-- ---------------------------------------------------------------------------
create or replace function app.guard_appointment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Le patient et le parcours appartiennent au même cabinet que le rendez-vous.
  if new.patient_id is not null and not exists (
    select 1 from public.patients p
    where p.id = new.patient_id and p.practice_id = new.practice_id
  ) then
    raise exception 'Le patient n''appartient pas à ce cabinet.'
      using errcode = 'foreign_key_violation';
  end if;

  if new.pathway_id is not null and not exists (
    select 1 from public.care_pathways c
    where c.id = new.pathway_id
      and c.practice_id = new.practice_id
      and c.patient_id is not distinct from new.patient_id
  ) then
    raise exception 'Le parcours ne correspond pas à ce patient.'
      using errcode = 'foreign_key_violation';
  end if;

  -- LA CONTRAINTE QUI COMPTE. Une attestation de présence ne pourra être
  -- établie que sur des rendez-vous honorés : marquer « honoré » un créneau qui
  -- n'a pas commencé reviendrait à pouvoir attester d'une séance future.
  if new.attendance = 'honore' and new.starts_at > now() then
    raise exception
      'Un rendez-vous à venir ne peut pas être marqué comme honoré : il n''a pas encore eu lieu.'
      using errcode = 'check_violation';
  end if;

  -- Une absence ou une annulation n'est pas facturable par défaut. Le praticien
  -- peut le décider explicitement, mais jamais par inadvertance.
  if tg_op = 'INSERT' and new.attendance = 'a_venir' then
    new.billable := true;
  end if;

  return new;
end;
$$;

create trigger appointments_guard
  before insert or update on public.appointments
  for each row execute function app.guard_appointment();

-- ---------------------------------------------------------------------------
--  Qualifier l'issue d'un rendez-vous
-- ---------------------------------------------------------------------------
--  Passe par une fonction plutôt que par un UPDATE direct, pour trois raisons :
--  le défaut de facturation suit l'issue, l'événement est journalisé, et la
--  règle « une séance honorée est la seule source d'une attestation » reste
--  énoncée en un seul endroit.
create or replace function public.set_appointment_attendance(
  p_appointment_id uuid,
  p_attendance text,
  p_note text default null,
  p_billable boolean default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_practice uuid;
  v_billable boolean;
begin
  select practice_id into v_practice
    from public.appointments where id = p_appointment_id;

  if v_practice is null or not app.can_write(v_practice) then
    raise exception 'Accès refusé.' using errcode = 'insufficient_privilege';
  end if;

  -- Défaut raisonné : seuls un rendez-vous honoré et une absence non excusée
  -- sont facturables par défaut. Une annulation par le praticien ne l'est
  -- jamais. Le paramètre explicite l'emporte.
  v_billable := coalesce(
    p_billable,
    p_attendance in ('honore', 'absent_non_excuse')
  );

  update public.appointments
     set attendance = p_attendance,
         attendance_note = p_note,
         billable = v_billable
   where id = p_appointment_id;

  insert into public.audit_events
    (practice_id, actor_user_id, action, subject_type, subject_id, metadata)
  values (v_practice, app.current_user_id(), 'appointment.attendance',
          'appointment', p_appointment_id,
          jsonb_build_object('attendance', p_attendance, 'billable', v_billable));
end;
$$;
revoke all on function public.set_appointment_attendance(uuid, text, text, boolean) from public;
revoke execute on function public.set_appointment_attendance(uuid, text, text, boolean) from anon;
grant execute on function public.set_appointment_attendance(uuid, text, text, boolean) to authenticated;

-- ============================================================================
--  NOTES RATTACHÉES À UNE SÉANCE
-- ============================================================================
--  Une note de séance est une note clinique comme une autre : même table, même
--  auteur, même date, même marquage d'information de tiers. Seul le
--  rattachement change.
alter table public.patient_notes
  add column appointment_id uuid references public.appointments(id) on delete set null;

create index idx_patient_notes_appointment
  on public.patient_notes (appointment_id) where appointment_id is not null;

-- ============================================================================
--  SÉANCES RÉALISÉES — source unique d'une attestation de présence
-- ============================================================================
--  Une vue plutôt qu'une requête recopiée : l'attestation de présence du lot 5
--  lira ceci, et rien d'autre. Elle ne peut donc pas s'appuyer sur des
--  rendez-vous annulés, à venir ou non qualifiés.
--
--  `security_invoker` fait que la RLS de `appointments` s'applique à l'appelant :
--  la vue ne contourne aucune isolation.
create view public.realised_sessions
with (security_invoker = true)
as
select
  a.id as appointment_id,
  a.practice_id,
  a.patient_id,
  a.pathway_id,
  a.kind,
  a.starts_at,
  a.ends_at,
  (a.starts_at at time zone 'Europe/Paris')::date as session_date,
  a.billable
from public.appointments a
where a.attendance = 'honore'
  and a.patient_id is not null
  and a.kind in ('seance', 'bilan', 'entretien', 'restitution');

comment on view public.realised_sessions is
  'Séances réellement réalisées. SEULE source admissible pour une attestation de présence : ni les rendez-vous à venir, ni les annulations, ni les absences n''y figurent.';

grant select on public.realised_sessions to authenticated;

-- ============================================================================
--  ROW LEVEL SECURITY
-- ============================================================================
alter table public.appointments enable row level security;
alter table public.appointments force row level security;

-- L'agenda est une donnée d'organisation : un assistant administratif doit le
-- voir pour tenir les rendez-vous. Les NOTES rattachées, elles, restent
-- réservées aux rôles cliniques — c'est la table `patient_notes` qui le tient.
create policy appointments_select on public.appointments
  for select to authenticated using (app.is_member(practice_id));
create policy appointments_write on public.appointments
  for all to authenticated
  using (app.can_write(practice_id)) with check (app.can_write(practice_id));

revoke all on public.appointments from anon, authenticated;
grant select, insert, update, delete on public.appointments to authenticated;
