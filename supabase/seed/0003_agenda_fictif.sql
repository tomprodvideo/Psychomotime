-- ============================================================================
--  SEEDS — AGENDA ENTIÈREMENT FICTIF
-- ============================================================================
--  Couvre les issues qui comptent : une séance honorée, une absence excusée,
--  une absence non excusée, une annulation par la praticienne, un rendez-vous
--  passé NON QUALIFIÉ, et un créneau sans patient.
--
--  Les dates sont relatives à `now()` : le jeu reste pertinent quelle que soit
--  la date à laquelle il est chargé, et l'on ne risque pas de marquer « honoré »
--  un rendez-vous futur — ce que la base refuse.
-- ============================================================================

-- Séances passées et honorées de Zéphyr, sur son parcours actif.
insert into public.appointments
  (practice_id, patient_id, pathway_id, practitioner_member_id,
   kind, starts_at, ends_at, attendance, billable, created_by)
select
  'a1111111-1111-4111-8111-111111111111',
  'a6000000-0000-4000-8000-000000000001',
  'a7000000-0000-4000-8000-000000000001',
  'a2222222-2222-4222-8222-222222222221',
  'seance',
  date_trunc('hour', now()) - (n || ' weeks')::interval - interval '3 days',
  date_trunc('hour', now()) - (n || ' weeks')::interval - interval '3 days' + interval '45 minutes',
  'honore', true,
  'a0000000-0000-4000-8000-000000000001'
from generate_series(1, 6) as n;

-- Le temps de passation du bilan, honoré lui aussi.
insert into public.appointments
  (practice_id, patient_id, pathway_id, practitioner_member_id,
   kind, starts_at, ends_at, attendance, billable, created_by)
values (
  'a1111111-1111-4111-8111-111111111111',
  'a6000000-0000-4000-8000-000000000001',
  'a7000000-0000-4000-8000-000000000001',
  'a2222222-2222-4222-8222-222222222221',
  'bilan',
  date_trunc('hour', now()) - interval '8 weeks',
  date_trunc('hour', now()) - interval '8 weeks' + interval '90 minutes',
  'honore', true,
  'a0000000-0000-4000-8000-000000000001');

-- Absence excusée : prévenue, non facturée.
insert into public.appointments
  (practice_id, patient_id, pathway_id, practitioner_member_id,
   kind, starts_at, ends_at, attendance, attendance_note, billable, created_by)
values (
  'a1111111-1111-4111-8111-111111111111',
  'a6000000-0000-4000-8000-000000000001',
  'a7000000-0000-4000-8000-000000000001',
  'a2222222-2222-4222-8222-222222222221',
  'seance',
  date_trunc('hour', now()) - interval '2 weeks' - interval '3 days',
  date_trunc('hour', now()) - interval '2 weeks' - interval '3 days' + interval '45 minutes',
  'absent_excuse', 'Prévenue la veille, enfant malade.', false,
  'a0000000-0000-4000-8000-000000000001');

-- Absence non excusée : un motif est exigé par la contrainte.
insert into public.appointments
  (practice_id, patient_id, pathway_id, practitioner_member_id,
   kind, starts_at, ends_at, attendance, attendance_note, billable, created_by)
values (
  'a1111111-1111-4111-8111-111111111111',
  'a6000000-0000-4000-8000-000000000001',
  'a7000000-0000-4000-8000-000000000001',
  'a2222222-2222-4222-8222-222222222221',
  'seance',
  date_trunc('hour', now()) - interval '5 weeks' - interval '1 day',
  date_trunc('hour', now()) - interval '5 weeks' - interval '1 day' + interval '45 minutes',
  'absent_non_excuse', 'Aucune nouvelle. Relancée par téléphone le lendemain.', true,
  'a0000000-0000-4000-8000-000000000001');

-- Annulation par la praticienne : jamais facturable.
insert into public.appointments
  (practice_id, patient_id, pathway_id, practitioner_member_id,
   kind, starts_at, ends_at, attendance, attendance_note, billable, created_by)
values (
  'a1111111-1111-4111-8111-111111111111',
  'a6000000-0000-4000-8000-000000000002',
  'a7000000-0000-4000-8000-000000000002',
  'a2222222-2222-4222-8222-222222222221',
  'seance',
  date_trunc('hour', now()) - interval '1 week' - interval '2 days',
  date_trunc('hour', now()) - interval '1 week' - interval '2 days' + interval '45 minutes',
  'annule_praticien', 'Reportée : formation.', false,
  'a0000000-0000-4000-8000-000000000001');

-- Rendez-vous PASSÉ et non qualifié : c'est ce que le tableau de bord doit
-- signaler en premier, plutôt que de le basculer tout seul dans un état.
insert into public.appointments
  (practice_id, patient_id, pathway_id, practitioner_member_id,
   kind, starts_at, ends_at, created_by)
values (
  'a1111111-1111-4111-8111-111111111111',
  'a6000000-0000-4000-8000-000000000002',
  'a7000000-0000-4000-8000-000000000002',
  'a2222222-2222-4222-8222-222222222221',
  'seance',
  date_trunc('hour', now()) - interval '2 days',
  date_trunc('hour', now()) - interval '2 days' + interval '45 minutes',
  'a0000000-0000-4000-8000-000000000001');

-- Rendez-vous à venir.
insert into public.appointments
  (practice_id, patient_id, pathway_id, practitioner_member_id,
   kind, starts_at, ends_at, created_by)
select
  'a1111111-1111-4111-8111-111111111111',
  'a6000000-0000-4000-8000-000000000001',
  'a7000000-0000-4000-8000-000000000001',
  'a2222222-2222-4222-8222-222222222221',
  'seance',
  date_trunc('hour', now()) + (n || ' weeks')::interval + interval '4 days',
  date_trunc('hour', now()) + (n || ' weeks')::interval + interval '4 days' + interval '45 minutes',
  'a0000000-0000-4000-8000-000000000001'
from generate_series(1, 3) as n;

-- Restitution du bilan aux deux parents.
insert into public.appointments
  (practice_id, patient_id, pathway_id, practitioner_member_id,
   kind, starts_at, ends_at, note, created_by)
values (
  'a1111111-1111-4111-8111-111111111111',
  'a6000000-0000-4000-8000-000000000001',
  'a7000000-0000-4000-8000-000000000001',
  'a2222222-2222-4222-8222-222222222221',
  'restitution',
  date_trunc('hour', now()) + interval '10 days',
  date_trunc('hour', now()) + interval '10 days' + interval '60 minutes',
  'Les deux titulaires de l''autorité parentale sont conviés.',
  'a0000000-0000-4000-8000-000000000001');

-- Créneau SANS patient : la contrainte exige alors un intitulé.
insert into public.appointments
  (practice_id, practitioner_member_id, kind, starts_at, ends_at, title, created_by)
values (
  'a1111111-1111-4111-8111-111111111111',
  'a2222222-2222-4222-8222-222222222221',
  'administratif',
  date_trunc('hour', now()) + interval '1 day',
  date_trunc('hour', now()) + interval '1 day' + interval '2 hours',
  'Rédaction des comptes rendus',
  'a0000000-0000-4000-8000-000000000001');

-- Une note rattachée à une séance honorée.
insert into public.patient_notes
  (practice_id, patient_id, pathway_id, appointment_id, body, written_on,
   author_member_id)
select
  'a1111111-1111-4111-8111-111111111111',
  'a6000000-0000-4000-8000-000000000001',
  'a7000000-0000-4000-8000-000000000001',
  a.id,
  'Reprend l''enchaînement proposé la semaine passée sans le rappel. Tient la posture assise sur toute la durée de l''atelier.',
  (a.starts_at at time zone 'Europe/Paris')::date,
  'a2222222-2222-4222-8222-222222222221'
from public.appointments a
where a.patient_id = 'a6000000-0000-4000-8000-000000000001'
  and a.attendance = 'honore' and a.kind = 'seance'
order by a.starts_at desc
limit 1;

-- Liste d'attente : le parcours d'Aristide y est déjà, on le complète.
update public.care_pathways
   set waitlisted_on = current_date - 21,
       waitlist_priority = 'prioritaire',
       availability_note = 'Disponible en matinée uniquement, transport adapté.'
 where id = 'a7000000-0000-4000-8000-000000000003';

-- Cabinet B, pour l'isolation.
insert into public.appointments
  (practice_id, patient_id, pathway_id, kind, starts_at, ends_at, attendance, billable)
values (
  'b1111111-1111-4111-8111-111111111111',
  'b6000000-0000-4000-8000-000000000001',
  'b7000000-0000-4000-8000-000000000001',
  'seance',
  date_trunc('hour', now()) - interval '4 days',
  date_trunc('hour', now()) - interval '4 days' + interval '45 minutes',
  'honore', true);
