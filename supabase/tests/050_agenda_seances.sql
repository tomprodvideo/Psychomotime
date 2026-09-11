-- ============================================================================
--  050 — AGENDA, SÉANCES ET PRÉSENCES
-- ============================================================================
\set ON_ERROR_STOP on

\set alpha     '''a0000000-0000-4000-8000-000000000001'''
\set assistant '''b0000000-0000-4000-8000-000000000002'''
\set zephyr    '''a6000000-0000-4000-8000-000000000001'''
\set capucine  '''a6000000-0000-4000-8000-000000000002'''
\set cab_a     '''a1111111-1111-4111-8111-111111111111'''

-- ---------------------------------------------------------------------------
--  1. On ne peut pas attester d'une séance qui n'a pas eu lieu
-- ---------------------------------------------------------------------------
--  C'est LA contrainte du lot : l'attestation de présence ne s'appuiera que
--  sur des rendez-vous honorés. Pouvoir marquer « honoré » un créneau futur
--  reviendrait à pouvoir attester d'une séance à venir.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
begin
  perform tests.assert_fails(
    format('insert into public.appointments
              (practice_id, patient_id, kind, starts_at, ends_at, attendance)
            values (%L, %L, ''seance'', now() + interval ''3 days'',
                    now() + interval ''3 days'' + interval ''45 minutes'', ''honore'')',
           'a1111111-1111-4111-8111-111111111111',
           'a6000000-0000-4000-8000-000000000001'),
    'Marquer honoré un rendez-vous à venir doit être refusé.');

  -- Le même créneau, dans le passé, est accepté.
  insert into public.appointments
    (practice_id, patient_id, kind, starts_at, ends_at, attendance)
  values ('a1111111-1111-4111-8111-111111111111',
          'a6000000-0000-4000-8000-000000000001', 'seance',
          now() - interval '3 days',
          now() - interval '3 days' + interval '45 minutes', 'honore');

  -- Et l'on ne peut pas non plus faire glisser un rendez-vous honoré vers le
  -- futur en gardant son issue.
  perform tests.assert_fails(
    'update public.appointments
        set starts_at = now() + interval ''7 days'',
            ends_at = now() + interval ''7 days'' + interval ''45 minutes''
      where attendance = ''honore''
        and patient_id = ''a6000000-0000-4000-8000-000000000001''',
    'Déplacer un rendez-vous honoré dans le futur doit être refusé.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  2. La vue des séances réalisées ne contient QUE des séances réalisées
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_total bigint;
  v_realisees bigint;
begin
  select count(*) into v_total from public.appointments
   where patient_id = 'a6000000-0000-4000-8000-000000000001';
  select count(*) into v_realisees from public.realised_sessions
   where patient_id = 'a6000000-0000-4000-8000-000000000001';

  perform tests.assert(v_realisees < v_total,
    'La vue doit écarter des rendez-vous : elle ne peut pas tous les contenir.');

  -- Aucune issue autre que « honoré » n'y figure.
  perform tests.assert_rows(
    'select 1 from public.realised_sessions r
       join public.appointments a on a.id = r.appointment_id
      where a.attendance <> ''honore''',
    0,
    'La vue ne doit contenir que des rendez-vous honorés.');

  -- Ni les absences, ni les annulations, ni les créneaux à venir.
  perform tests.assert_rows(
    'select 1 from public.realised_sessions where starts_at > now()', 0,
    'Aucune séance à venir ne doit figurer dans les séances réalisées.');

  -- Ni les créneaux sans patient.
  perform tests.assert_rows(
    'select 1 from public.realised_sessions where patient_id is null', 0,
    'Un créneau administratif n''est pas une séance.');
  perform tests.assert_rows(
    'select 1 from public.realised_sessions where kind = ''administratif''', 0,
    'Un temps administratif ne doit jamais nourrir une attestation de présence.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  3. Une absence non facturable ne produit rien à facturer
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_id uuid;
  v_billable boolean;
  v_attendance text;
begin
  -- Le rendez-vous passé non qualifié du jeu d'essai.
  select id into v_id from public.appointments
   where attendance = 'a_venir' and starts_at < now()
   order by starts_at desc limit 1;
  perform tests.assert(v_id is not null,
    'Le jeu d''essai doit contenir un rendez-vous passé non qualifié.');

  -- Annulation par la praticienne : jamais facturable, même par défaut.
  perform public.set_appointment_attendance(v_id, 'annule_praticien', 'Imprévu.');
  select billable, attendance into v_billable, v_attendance
    from public.appointments where id = v_id;
  perform tests.assert_equals(v_attendance, 'annule_praticien',
    'L''issue doit être enregistrée.');
  perform tests.assert(not v_billable,
    'Une annulation par le praticien ne doit jamais être facturable par défaut.');

  -- Absence excusée : non facturable non plus.
  perform public.set_appointment_attendance(v_id, 'absent_excuse', 'Prévenu la veille.');
  select billable into v_billable from public.appointments where id = v_id;
  perform tests.assert(not v_billable,
    'Une absence excusée ne doit pas être facturable par défaut.');

  -- Absence NON excusée : facturable par défaut, parce que le créneau a été
  -- immobilisé. Le praticien peut toujours en décider autrement.
  perform public.set_appointment_attendance(v_id, 'absent_non_excuse', 'Sans nouvelle.');
  select billable into v_billable from public.appointments where id = v_id;
  perform tests.assert(v_billable,
    'Une absence non excusée est facturable par défaut.');

  -- Le choix explicite l'emporte sur le défaut.
  perform public.set_appointment_attendance(
    v_id, 'absent_non_excuse', 'Sans nouvelle, mais premier oubli.', false);
  select billable into v_billable from public.appointments where id = v_id;
  perform tests.assert(not v_billable,
    'Le praticien doit pouvoir décider de ne pas facturer une absence.');

  -- Chaque qualification laisse une trace.
  perform tests.assert_rows(
    'select 1 from public.audit_events where action = ''appointment.attendance''',
    4, 'Chaque qualification d''issue doit être journalisée.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  4. Un motif est exigé quand le rendez-vous n'a pas eu lieu
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
begin
  -- Sans motif, une absence non excusée ou une annulation praticien seraient
  -- inexploitables : on ne saurait ni relancer, ni justifier une facturation.
  for i in 1..1 loop
    perform tests.assert_fails(
      format('insert into public.appointments
                (practice_id, patient_id, kind, starts_at, ends_at, attendance)
              values (%L, %L, ''seance'', now() - interval ''1 day'',
                      now() - interval ''1 day'' + interval ''45 minutes'',
                      ''absent_non_excuse'')',
             'a1111111-1111-4111-8111-111111111111',
             'a6000000-0000-4000-8000-000000000001'),
      'Une absence non excusée sans motif doit être refusée.');

    perform tests.assert_fails(
      format('insert into public.appointments
                (practice_id, patient_id, kind, starts_at, ends_at, attendance)
              values (%L, %L, ''seance'', now() - interval ''1 day'',
                      now() - interval ''1 day'' + interval ''45 minutes'',
                      ''annule_praticien'')',
             'a1111111-1111-4111-8111-111111111111',
             'a6000000-0000-4000-8000-000000000001'),
      'Une annulation par le praticien sans motif doit être refusée.');
  end loop;

  -- Une absence EXCUSÉE n'exige pas de motif : « prévenue » se suffit.
  insert into public.appointments
    (practice_id, patient_id, kind, starts_at, ends_at, attendance)
  values ('a1111111-1111-4111-8111-111111111111',
          'a6000000-0000-4000-8000-000000000001', 'seance',
          now() - interval '1 day',
          now() - interval '1 day' + interval '45 minutes', 'absent_excuse');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  5. Intégrité du créneau
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
begin
  perform tests.assert_fails(
    format('insert into public.appointments
              (practice_id, patient_id, kind, starts_at, ends_at)
            values (%L, %L, ''seance'', now(), now() - interval ''1 hour'')',
           'a1111111-1111-4111-8111-111111111111',
           'a6000000-0000-4000-8000-000000000001'),
    'Un rendez-vous qui finit avant de commencer doit être refusé.');

  -- Un créneau sans patient DOIT porter un intitulé, sinon l'agenda affiche
  -- une case muette.
  perform tests.assert_fails(
    format('insert into public.appointments
              (practice_id, kind, starts_at, ends_at)
            values (%L, ''administratif'', now(), now() + interval ''1 hour'')',
           'a1111111-1111-4111-8111-111111111111'),
    'Un créneau sans patient ni intitulé doit être refusé.');

  insert into public.appointments (practice_id, kind, starts_at, ends_at, title)
  values ('a1111111-1111-4111-8111-111111111111', 'administratif',
          now(), now() + interval '1 hour', 'Comptabilité');

  -- Une séance sans patient n'a pas de sens.
  perform tests.assert_fails(
    format('insert into public.appointments
              (practice_id, kind, starts_at, ends_at, title)
            values (%L, ''seance'', now(), now() + interval ''1 hour'', ''Sans patient'')',
           'a1111111-1111-4111-8111-111111111111'),
    'Une séance sans patient doit être refusée.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  6. Un rendez-vous ne franchit pas la frontière d'un cabinet
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
begin
  perform tests.assert_fails(
    format('insert into public.appointments
              (practice_id, patient_id, kind, starts_at, ends_at)
            values (%L, %L, ''seance'', now(), now() + interval ''45 minutes'')',
           'a1111111-1111-4111-8111-111111111111',
           'b6000000-0000-4000-8000-000000000001'),
    'Poser un rendez-vous sur le patient d''un autre cabinet doit être refusé.');

  -- Un parcours qui ne correspond pas au patient est refusé lui aussi : c'est
  -- ainsi qu'une séance atterrirait dans le mauvais dossier.
  perform tests.assert_fails(
    format('insert into public.appointments
              (practice_id, patient_id, pathway_id, kind, starts_at, ends_at)
            values (%L, %L, %L, ''seance'', now(), now() + interval ''45 minutes'')',
           'a1111111-1111-4111-8111-111111111111',
           'a6000000-0000-4000-8000-000000000001',
           'a7000000-0000-4000-8000-000000000002'),
    'Rattacher un rendez-vous au parcours d''un autre patient doit être refusé.');

  perform tests.assert_rows(
    format('select 1 from public.appointments where practice_id = %L',
           'b1111111-1111-4111-8111-111111111111'),
    0, 'Aucun rendez-vous du cabinet B ne doit être visible.');
  perform tests.assert_rows(
    format('select 1 from public.realised_sessions where practice_id = %L',
           'b1111111-1111-4111-8111-111111111111'),
    0, 'La vue des séances réalisées doit respecter l''isolation.');
end
$$;
rollback;

-- Qualifier le rendez-vous d'un autre cabinet est refusé.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare v_id uuid;
begin
  -- On récupère l'identifiant en contournant la RLS, comme le ferait quelqu'un
  -- qui l'aurait deviné ou lu ailleurs.
  reset role;
  select id into v_id from public.appointments
   where practice_id = 'b1111111-1111-4111-8111-111111111111' limit 1;
  perform tests.authenticate_as('a0000000-0000-4000-8000-000000000001'::uuid);

  perform tests.assert_fails(
    format('select public.set_appointment_attendance(%L, ''honore'')', v_id),
    'Qualifier le rendez-vous d''un autre cabinet doit être refusé.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  7. L'assistant administratif tient l'agenda, pas le dossier clinique
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as(:assistant::uuid);
do $$
begin
  -- Il voit l'agenda : c'est son travail.
  perform tests.assert_rows('select 1 from public.appointments', 1,
    'L''assistant doit voir les rendez-vous de son cabinet.');
  perform tests.assert_rows('select 1 from public.realised_sessions', 1,
    'L''assistant doit voir les séances réalisées, pour la facturation.');

  -- Mais pas les notes qui y sont rattachées.
  perform tests.assert_rows('select 1 from public.patient_notes', 0,
    'L''assistant ne doit lire aucune note de séance.');

  -- Et il ne pose pas de rendez-vous : le rôle est en lecture sur les données
  -- d'exercice tant que la délégation n'est pas arbitrée.
  perform tests.assert_fails(
    format('insert into public.appointments
              (practice_id, patient_id, kind, starts_at, ends_at)
            values (%L, %L, ''seance'', now(), now() + interval ''45 minutes'')',
           'b1111111-1111-4111-8111-111111111111',
           'b6000000-0000-4000-8000-000000000001'),
    'L''assistant ne doit pas pouvoir poser un rendez-vous.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  8. Liste d'attente portée par le parcours
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_depuis date;
begin
  perform tests.assert_rows(
    'select 1 from public.care_pathways where status = ''liste_attente''', 1,
    'Un parcours en liste d''attente doit être identifiable comme tel.');

  select waitlisted_on into v_depuis from public.care_pathways
   where status = 'liste_attente';
  perform tests.assert(v_depuis is not null,
    'La date d''entrée en liste d''attente doit être connue : « depuis combien de temps j''attends ? » est une question légitime.');
  perform tests.assert(current_date - v_depuis = 21,
    'L''ancienneté doit se calculer à partir de cette date.');

  perform tests.assert_rows(
    'select 1 from public.care_pathways
      where status = ''liste_attente'' and availability_note is not null', 1,
    'Les disponibilités annoncées doivent pouvoir être notées.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  9. Une note peut se rattacher à la séance où elle a été prise
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
begin
  perform tests.assert_rows(
    'select 1 from public.patient_notes where appointment_id is not null', 1,
    'Une note doit pouvoir être rattachée à une séance.');

  -- Le rattachement n'invente rien : la note garde son auteur et sa date.
  perform tests.assert_rows(
    'select 1 from public.patient_notes
      where appointment_id is not null and author_member_id is null', 0,
    'Une note de séance porte son auteur comme toute autre note.');

  -- Supprimer un rendez-vous ne doit pas emporter la note clinique.
  delete from public.appointments
   where id = (select appointment_id from public.patient_notes
               where appointment_id is not null limit 1);
  perform tests.assert_rows(
    'select 1 from public.patient_notes where body like ''%enchaînement%''', 1,
    'Supprimer un rendez-vous ne doit jamais effacer la note clinique prise ce jour-là.');
end
$$;
rollback;
