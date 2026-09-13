-- ============================================================================
--  120 — SYNTHÈSE DE SUIVI
--  Premier document du produit dont une partie est PRÉ-REMPLIE depuis la base.
--  Ce qui est vérifié ici, c'est la ligne qui sépare les deux moitiés :
--  les FAITS sont recopiés, justes, et figés ; l'INTERPRÉTATION n'est
--  jamais produite, et rien ne part sans que la praticienne ait écrit.
-- ============================================================================
\set ON_ERROR_STOP on

\set alpha  '''a0000000-0000-4000-8000-000000000001'''
\set cab_a  '''a1111111-1111-4111-8111-111111111111'''
\set zephyr '''a6000000-0000-4000-8000-000000000001'''
\set parcours_zephyr '''a7000000-0000-4000-8000-000000000001'''

-- ---------------------------------------------------------------------------
--  1. Les faits sont ceux de la période, et ils sont justes
-- ---------------------------------------------------------------------------
--  Le jeu fictif donne à Zéphyr, en août 2026 : quatre séances honorées, deux
--  absences. Et sur juillet-septembre : sept honorées. Le second nombre est le
--  CONTRE-CONTRÔLE du premier — sans lui, un filtre de période inopérant
--  rendrait toujours le même total et le contrôle passerait sans rien prouver.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_aout jsonb;
  v_ete jsonb;
begin
  v_aout := public.follow_up_facts(
    'a6000000-0000-4000-8000-000000000001',
    'a7000000-0000-4000-8000-000000000001',
    date '2026-08-01', date '2026-08-31');
  v_ete := public.follow_up_facts(
    'a6000000-0000-4000-8000-000000000001',
    'a7000000-0000-4000-8000-000000000001',
    date '2026-07-01', date '2026-09-13');

  perform tests.assert_equals((v_aout ->> 'seances_honorees')::int, 4,
    'Le nombre de séances honorées est celui de la période demandée.');
  perform tests.assert_equals((v_ete ->> 'seances_honorees')::int, 7,
    'Une période plus large en compte davantage : la borne filtre réellement.');
  perform tests.assert_equals((v_aout ->> 'absences')::int, 2,
    'Les rendez-vous non honorés sont comptés à part, qu''on les imprime ou non.');
  perform tests.assert(v_aout ? 'annulees_par_le_cabinet',
    'Les séances annulées par le cabinet sont comptées aussi : un chiffre à sens unique est celui qu''un financeur retient.');

  /* SEULES LES SÉANCES HONORÉES COMPTENT. Un rendez-vous à venir n'a pas eu
   * lieu : le faire entrer dans le compte annoncerait un travail qui reste à
   * faire. Le contrôle vaut par la différence avec le total des rendez-vous
   * de la période. */
  perform tests.assert_rows(
    'select 1 from public.appointments
      where pathway_id = ''a7000000-0000-4000-8000-000000000001''
        and (starts_at at time zone ''Europe/Paris'')::date
            between date ''2026-07-01'' and date ''2026-10-31''', 13,
    'Le parcours porte treize rendez-vous sur la période élargie…');
  perform tests.assert_equals(
    (public.follow_up_facts(
      'a6000000-0000-4000-8000-000000000001',
      'a7000000-0000-4000-8000-000000000001',
      date '2026-07-01', date '2026-10-31') ->> 'seances_honorees')::int, 7,
    '…et la synthèse n''en retient que les sept qui ont eu lieu.');

  /* LES OBJECTIFS TELS QU'ELLE LES A POSÉS, sans requalification.
   *
   * ON ASSERTE LES INTITULÉS, PAS LEUR NOMBRE. Le jeu fictif porte désormais
   * des objectifs sur DEUX parcours du même cabinet : compter n'aurait pas
   * distingué « les objectifs de ce parcours » de « tous les objectifs du
   * cabinet ». La relecture de sécurité a mesuré qu'en retirant le filtre par
   * parcours, la suite entière restait verte. */
  perform tests.assert_equals(
    (select string_agg(o ->> 'intitule', ' | ')
       from jsonb_array_elements(v_aout -> 'objectifs') o),
    'Tenir une ligne d''écriture sur dix minutes sans changer de prise | ' ||
    'Se repérer dans l''enchaînement des consignes en classe | ' ||
    'Reprendre la course en récréation sans appréhension',
    'La synthèse reprend les objectifs DE CE PARCOURS, dans leur ordre, et aucun autre.');
  perform tests.assert_rows(
    'select 1 from public.care_objectives
      where practice_id = ''a1111111-1111-4111-8111-111111111111''', 5,
    'Le cabinet en porte cinq au total : sans cet écart, l''assertion ci-dessus ne prouverait rien.');
  perform tests.assert_equals(
    v_aout -> 'objectifs' -> 2 ->> 'statut', 'atteint',
    'Un objectif atteint est recopié atteint : le logiciel ne rejuge rien.');
  perform tests.assert(
    v_aout ->> 'parcours_ouvert_le' = '2026-01-22',
    'La date d''ouverture du parcours vient du parcours.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  2. Aucun fait d'un autre dossier ne peut entrer dans la synthèse
-- ---------------------------------------------------------------------------
--  Le cloisonnement entre cabinets ne protège pas de ce cas-là : les deux
--  dossiers sont du même côté de la frontière. Sans la vérification, le
--  parcours de Capucine ferait imprimer ses objectifs sous le nom de Zéphyr.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
begin
  perform tests.assert_fails(
    'select public.follow_up_facts(
       ''a6000000-0000-4000-8000-000000000001'',
       ''a7000000-0000-4000-8000-000000000002'',
       date ''2026-08-01'', date ''2026-08-31'')',
    'Le parcours d''un autre dossier du même cabinet ne nourrit pas cette synthèse.');

  -- LE CONTRE-CONTRÔLE : appelée avec le bon couple, elle répond.
  perform tests.assert(
    public.follow_up_facts(
      'a6000000-0000-4000-8000-000000000002',
      'a7000000-0000-4000-8000-000000000002',
      date '2026-08-01', date '2026-08-31') is not null,
    'Le bon couple dossier/parcours, lui, est accepté.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  3. Une synthèse qui ne dit rien ne part pas
-- ---------------------------------------------------------------------------
--  C'est le garde-fou central de ce document. Les comptes seuls font un
--  relevé, pas un compte rendu — et un relevé qui part sous une signature
--  laisse croire à une lecture professionnelle qui n'a pas eu lieu.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare v_s uuid;
begin
  insert into public.follow_up_summaries
    (practice_id, patient_id, pathway_id, period_start, period_end)
  values ('a1111111-1111-4111-8111-111111111111',
          'a6000000-0000-4000-8000-000000000001',
          'a7000000-0000-4000-8000-000000000001',
          date '2026-08-01', date '2026-08-31')
  returning id into v_s;

  perform tests.assert_fails(
    format('select public.issue_follow_up_summary(%L)', v_s),
    'Une synthèse sans texte ne se remet pas : les comptes ne parlent pas d''eux-mêmes.');
  perform tests.assert_fails(
    format('update public.follow_up_summaries set observed_evolution = ''  ''
            where id = %L; select public.issue_follow_up_summary(%L)', v_s, v_s),
    'Des espaces ne sont pas un texte.');

  -- LE CONTRE-CONTRÔLE : avec un texte, elle part.
  update public.follow_up_summaries
     set observed_evolution = 'Zéphyr investit davantage les propositions graphiques.'
   where id = v_s;
  perform public.issue_follow_up_summary(v_s);
  perform tests.assert_rows(
    format('select 1 from public.follow_up_summaries where id = %L and status = ''emis''', v_s),
    1, 'Une synthèse écrite se remet : sans quoi les refus ci-dessus ne prouveraient rien.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  4. Une fois remise, elle ne bouge plus — et les faits non plus
-- ---------------------------------------------------------------------------
--  Le point le plus délicat de ce document : ses faits sont RECALCULABLES.
--  S'ils étaient relus à l'affichage, le destinataire et la praticienne
--  finiraient par lire deux chiffres différents sur le même document.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_s uuid;
  v_libre uuid;
  v_instantane jsonb;
  v_objectif uuid;
begin
  insert into public.follow_up_summaries
    (practice_id, patient_id, pathway_id, period_start, period_end,
     observed_evolution, adjustments)
  values ('a1111111-1111-4111-8111-111111111111',
          'a6000000-0000-4000-8000-000000000001',
          'a7000000-0000-4000-8000-000000000001',
          date '2026-08-01', date '2026-08-31',
          'Quatre séances, une participation plus constante.',
          'Poursuite au même rythme jusqu''en décembre.')
  returning id into v_s;
  perform public.issue_follow_up_summary(v_s, date '2026-09-01');

  select snapshot into v_instantane from public.follow_up_summaries where id = v_s;
  perform tests.assert_equals(
    (v_instantane -> 'faits' ->> 'seances_honorees')::int, 4,
    'L''instantané porte les faits de la période.');
  perform tests.assert(v_instantane -> 'praticien' ->> 'nom' is not null,
    'Il porte aussi qui l''a écrite : un compte rendu anonyme n''engage personne.');

  /* ON CHANGE LE MONDE APRÈS COUP : une séance de plus dans la période, et un
   * objectif requalifié. Le document déjà remis doit rester ce qu'il était. */
  insert into public.appointments
    (practice_id, patient_id, pathway_id, kind, starts_at, ends_at, attendance)
  values ('a1111111-1111-4111-8111-111111111111',
          'a6000000-0000-4000-8000-000000000001',
          'a7000000-0000-4000-8000-000000000001', 'seance',
          timestamptz '2026-08-15 09:00+02', timestamptz '2026-08-15 09:45+02',
          'honore');
  select id into v_objectif from public.care_objectives
   where pathway_id = 'a7000000-0000-4000-8000-000000000001' and position = 1;
  update public.care_objectives set status = 'abandonne' where id = v_objectif;

  perform tests.assert_equals(
    (public.follow_up_facts(
      'a6000000-0000-4000-8000-000000000001',
      'a7000000-0000-4000-8000-000000000001',
      date '2026-08-01', date '2026-08-31') ->> 'seances_honorees')::int, 5,
    'La base, elle, a bien changé : cinq séances honorées désormais.');
  select snapshot into v_instantane from public.follow_up_summaries where id = v_s;
  perform tests.assert_equals(
    (v_instantane -> 'faits' ->> 'seances_honorees')::int, 4,
    'La synthèse remise en porte toujours quatre : elle dit ce qui a été remis.');
  perform tests.assert_equals(
    v_instantane -> 'faits' -> 'objectifs' -> 0 ->> 'statut', 'en_cours',
    'Et l''objectif y reste tel qu''il était le jour de la remise.');

  -- Rien ne se réécrit.
  perform tests.assert_fails(
    format('update public.follow_up_summaries set observed_evolution = ''Autre chose.'' where id = %L', v_s),
    'Une synthèse remise ne se réécrit pas.');
  perform tests.assert_fails(
    format('update public.follow_up_summaries set means = ''Autre cadre.'' where id = %L', v_s),
    'Le cadre et les moyens décrits ne se réécrivent pas après la remise.');
  perform tests.assert_fails(
    format('update public.follow_up_summaries set next_step = ''Autre suite.'' where id = %L', v_s),
    'La suite proposée ne se réécrit pas non plus : c''est ce que le destinataire a lu.');
  perform tests.assert_fails(
    format('update public.follow_up_summaries set period_end = date ''2026-09-30'' where id = %L', v_s),
    'Une synthèse remise ne change pas de période.');
  perform tests.assert_fails(
    format('update public.follow_up_summaries set detail_absences = true where id = %L', v_s),
    'Une synthèse remise n''ajoute pas les absences après coup.');
  perform tests.assert_fails(
    format('update public.follow_up_summaries set adjustments = ''Autre chose.'' where id = %L', v_s),
    'Les ajustements ne se réécrivent pas après la remise.');
  perform tests.assert_fails(
    format('update public.follow_up_summaries set note = ''Autre mention.'' where id = %L', v_s),
    'La mention imprimée ne se réécrit pas.');
  perform tests.assert_fails(
    format('update public.follow_up_summaries set period_start = date ''2026-07-01'' where id = %L', v_s),
    'Une synthèse remise ne change pas de date de début.');
  perform tests.assert_fails(
    format('update public.follow_up_summaries set issued_on = date ''2026-01-01'' where id = %L', v_s),
    'Une synthèse remise ne se redate pas.');
  /* CE QUI RATTACHE LA PIÈCE. Le document imprimé ne bougeait pas — il lit
   * l'instantané — mais son IMPUTATION se déplaçait : à quel dossier, à quel
   * parcours, qui a signé, quand elle a été créée. Six clauses de cette liste
   * ne faisaient échouer aucun contrôle ; la relecture de sécurité l'a mesuré
   * en les désarmant une par une. */
  perform tests.assert_fails(
    format('update public.follow_up_summaries set recipient_contact_id = %L where id = %L',
           (select id from public.contacts
             where practice_id = 'a1111111-1111-4111-8111-111111111111' limit 1), v_s),
    'Une synthèse remise ne change pas de destinataire.');
  perform tests.assert_fails(
    format('update public.follow_up_summaries set pathway_id = null where id = %L', v_s),
    'Une synthèse remise ne se détache pas de son parcours.');

  /* CHANGER DE DOSSIER ET CHANGER DE MODE DE REMISE se vérifient sur une AUTRE
   * synthèse, sans parcours et avec un destinataire nommé. Sur celle-ci, les
   * deux écritures butaient d'abord sur la garde de COHÉRENCE — le parcours
   * n'est pas celui du nouveau dossier, et retirer la remise au patient ne
   * laissait plus personne — et les contrôles constataient un refus sans
   * jamais atteindre la garde d'immuabilité qu'ils prétendaient éprouver.
   * Mesuré en désarmant : la suite restait verte. */
  insert into public.follow_up_summaries
    (practice_id, patient_id, recipient_contact_id, recipient_is_patient,
     period_start, period_end, observed_evolution)
  values ('a1111111-1111-4111-8111-111111111111',
          'a6000000-0000-4000-8000-000000000001',
          (select id from public.contacts
            where practice_id = 'a1111111-1111-4111-8111-111111111111' limit 1),
          true, date '2026-08-01', date '2026-08-31', 'Texte.')
  returning id into v_libre;
  perform public.issue_follow_up_summary(v_libre);

  perform tests.assert_fails(
    format('update public.follow_up_summaries set patient_id = %L where id = %L',
           'a6000000-0000-4000-8000-000000000002', v_libre),
    'Une synthèse remise ne change pas de dossier.');
  perform tests.assert_fails(
    format('update public.follow_up_summaries set recipient_is_patient = false where id = %L', v_libre),
    'Une synthèse remise ne change pas de mode de remise.');
  perform tests.assert_fails(
    format('update public.follow_up_summaries set issued_by = null where id = %L', v_s),
    'On ne réécrit pas qui a signé une synthèse remise.');
  perform tests.assert_fails(
    format('update public.follow_up_summaries set created_by = null where id = %L', v_s),
    'Ni qui l''a rédigée.');
  perform tests.assert_fails(
    format('update public.follow_up_summaries set created_at = now() + interval ''1 hour'' where id = %L', v_s),
    'Ni quand elle a été créée.');
  perform tests.assert_fails(
    format('update public.follow_up_summaries set cancellation_reason = ''Motif posé d''''avance.'' where id = %L', v_s),
    'Un motif d''annulation ne se pose pas d''avance sur une synthèse remise.');

  perform tests.assert_fails(
    format('update public.follow_up_summaries set status = ''brouillon'' where id = %L', v_s),
    'Une synthèse remise ne redevient pas un brouillon.');
  /* L'INSTANTANÉ LUI-MÊME. C'est lui, et lui seul, qui fait foi de ce qui a
   * été remis : le protéger des champs alentour sans le protéger lui laisserait
   * réécrire le document par la porte de service. */
  perform tests.assert_fails(
    format('update public.follow_up_summaries
              set snapshot = jsonb_set(snapshot, ''{faits,seances_honorees}'', ''40'')
            where id = %L', v_s),
    'L''instantané d''une synthèse remise ne se réécrit pas.');
  perform tests.assert_fails(
    format('delete from public.follow_up_summaries where id = %L', v_s),
    'Une synthèse remise ne se supprime pas.');

  /* LA NOTE INTERNE, ELLE, RESTE MODIFIABLE : elle ne s'imprime pas et ne
   * fait donc pas partie de ce qui a été remis. Le contrôle le DÉMONTRE,
   * plutôt que de laisser croire à un oubli dans la liste ci-dessus. */
  perform tests.assert_affects_rows(
    format('update public.follow_up_summaries set internal_note = ''Relancer la PCO.'' where id = %L', v_s),
    1, 'Une note interne s''ajoute après la remise : elle n''est pas partie.');

  -- Elle s'annule, avec un motif, et l'annulation ne se défait pas.
  perform tests.assert_fails(
    format('select public.cancel_follow_up_summary(%L, ''   '')', v_s),
    'Une annulation sans motif n''apprend rien à qui a reçu la synthèse.');
  perform public.cancel_follow_up_summary(v_s, 'Période erronée.');
  perform tests.assert_fails(
    format('update public.follow_up_summaries set status = ''emis'' where id = %L', v_s),
    'Une annulation ne se défait pas.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  5. Ce qui ne peut pas être écrit
-- ---------------------------------------------------------------------------
begin;
do $$
declare
  v_patient_b uuid;
  v_dest_b uuid;
  v_dest_a uuid;
begin
  perform tests.authenticate_as('b0000000-0000-4000-8000-000000000001'::uuid);
  select id into v_patient_b from public.patients
   where practice_id = 'b1111111-1111-4111-8111-111111111111' limit 1;
  select id into v_dest_b from public.contacts
   where practice_id = 'b1111111-1111-4111-8111-111111111111' limit 1;
  reset role;

  perform tests.authenticate_as('a0000000-0000-4000-8000-000000000001'::uuid);
  select id into v_dest_a from public.contacts
   where practice_id = 'a1111111-1111-4111-8111-111111111111' limit 1;

  perform tests.assert_fails(
    format('insert into public.follow_up_summaries
              (practice_id, patient_id, period_start, period_end, observed_evolution)
            values (%L, %L, date ''2026-08-01'', date ''2026-08-31'', ''Texte.'')',
           'a1111111-1111-4111-8111-111111111111', v_patient_b),
    'Une synthèse ne porte pas sur le dossier d''un autre cabinet.');

  perform tests.assert_fails(
    format('insert into public.follow_up_summaries
              (practice_id, patient_id, recipient_contact_id, recipient_is_patient,
               period_start, period_end, observed_evolution)
            values (%L, %L, %L, false, date ''2026-08-01'', date ''2026-08-31'', ''Texte.'')',
           'a1111111-1111-4111-8111-111111111111',
           'a6000000-0000-4000-8000-000000000001', v_dest_b),
    'Une synthèse ne se remet pas au contact d''un autre cabinet.');

  perform tests.assert_fails(
    format('insert into public.follow_up_summaries
              (practice_id, patient_id, pathway_id, period_start, period_end, observed_evolution)
            values (%L, %L, %L, date ''2026-08-01'', date ''2026-08-31'', ''Texte.'')',
           'a1111111-1111-4111-8111-111111111111',
           'a6000000-0000-4000-8000-000000000001',
           'a7000000-0000-4000-8000-000000000002'),
    'Une synthèse ne rattache pas le parcours d''un autre dossier.');

  perform tests.assert_fails(
    format('insert into public.follow_up_summaries
              (practice_id, patient_id, recipient_is_patient,
               period_start, period_end, observed_evolution)
            values (%L, %L, false, date ''2026-08-01'', date ''2026-08-31'', ''Texte.'')',
           'a1111111-1111-4111-8111-111111111111',
           'a6000000-0000-4000-8000-000000000001'),
    'Une synthèse remise à personne ne se saura plus, dans un an, remise à qui.');

  perform tests.assert_fails(
    format('insert into public.follow_up_summaries
              (practice_id, patient_id, period_start, period_end, observed_evolution)
            values (%L, %L, date ''2026-08-31'', date ''2026-08-01'', ''Texte.'')',
           'a1111111-1111-4111-8111-111111111111',
           'a6000000-0000-4000-8000-000000000001'),
    'Une période qui finit avant de commencer n''est pas une période.');

  -- LE CONTRE-CONTRÔLE : avec un destinataire du bon cabinet, tout passe.
  perform tests.assert_affects_rows(
    format('insert into public.follow_up_summaries
              (practice_id, patient_id, recipient_contact_id, recipient_is_patient,
               period_start, period_end, observed_evolution)
            values (%L, %L, %L, false, date ''2026-08-01'', date ''2026-08-31'', ''Texte.'')',
           'a1111111-1111-4111-8111-111111111111',
           'a6000000-0000-4000-8000-000000000001', v_dest_a),
    1, 'Un destinataire du cabinet est accepté : sans quoi les refus ne prouveraient rien.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  6. On ne rend pas compte de ce qui n'a pas eu lieu
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare v_s uuid;
begin
  insert into public.follow_up_summaries
    (practice_id, patient_id, period_start, period_end, observed_evolution)
  values ('a1111111-1111-4111-8111-111111111111',
          'a6000000-0000-4000-8000-000000000001',
          current_date, current_date + 30, 'Texte.')
  returning id into v_s;
  perform tests.assert_fails(
    format('select public.issue_follow_up_summary(%L)', v_s),
    'Une période qui se termine dans le futur ne se rend pas compte.');

  update public.follow_up_summaries set period_end = current_date where id = v_s;
  perform tests.assert_fails(
    format('select public.issue_follow_up_summary(%L, current_date + 1)', v_s),
    'Une synthèse ne se date pas du futur.');
  perform public.issue_follow_up_summary(v_s);
  perform tests.assert_rows(
    format('select 1 from public.follow_up_summaries where id = %L and status = ''emis''', v_s),
    1, 'Une période close, elle, se remet.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  7. C'est un contenu clinique : l'assistant ne le lit pas
-- ---------------------------------------------------------------------------
begin;
do $$
begin
  insert into auth.users (id, email)
  values ('a0000000-0000-4000-8000-0000000000b9', 'assistant-synthese@exemple-fictif.test')
  on conflict (id) do nothing;
  insert into public.practice_members (practice_id, user_id, role, status)
  values ('a1111111-1111-4111-8111-111111111111',
          'a0000000-0000-4000-8000-0000000000b9', 'assistant', 'active');

  perform tests.authenticate_as('a0000000-0000-4000-8000-000000000001'::uuid);
  insert into public.follow_up_summaries
    (practice_id, patient_id, period_start, period_end, observed_evolution)
  values ('a1111111-1111-4111-8111-111111111111',
          'a6000000-0000-4000-8000-000000000001',
          date '2026-08-01', date '2026-08-31', 'Texte clinique.');

  reset role;
  perform tests.authenticate_as('a0000000-0000-4000-8000-0000000000b9'::uuid);
  perform tests.assert_rows(
    'select 1 from public.follow_up_summaries', 0,
    'Un assistant ne lit pas les synthèses de suivi de son cabinet.');
  perform tests.assert_fails(
    'select public.follow_up_facts(
       ''a6000000-0000-4000-8000-000000000001'',
       ''a7000000-0000-4000-8000-000000000001'',
       date ''2026-08-01'', date ''2026-08-31'')',
    'Un assistant ne lit pas non plus les objectifs par le calcul des faits.');

  reset role;
  perform tests.authenticate_as('a0000000-0000-4000-8000-000000000001'::uuid);
  perform tests.assert_rows(
    'select 1 from public.follow_up_summaries', 1,
    'La praticienne les lit : sans quoi les refus ci-dessus ne prouveraient rien.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  8. Le cabinet d'à côté n'en voit rien
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
begin
  insert into public.follow_up_summaries
    (practice_id, patient_id, period_start, period_end, observed_evolution)
  values ('a1111111-1111-4111-8111-111111111111',
          'a6000000-0000-4000-8000-000000000001',
          date '2026-08-01', date '2026-08-31', 'Texte confidentiel.');

  reset role;
  perform tests.authenticate_as('b0000000-0000-4000-8000-000000000001'::uuid);
  perform tests.assert_rows(
    'select 1 from public.follow_up_summaries', 0,
    'Le cabinet voisin ne voit aucune synthèse.');
  perform tests.assert_fails(
    'select public.follow_up_facts(
       ''a6000000-0000-4000-8000-000000000001'',
       ''a7000000-0000-4000-8000-000000000001'',
       date ''2026-08-01'', date ''2026-08-31'')',
    'Le cabinet voisin ne calcule pas les faits d''un dossier qui n''est pas le sien.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  9. Les deux comptes se font sur la même base
-- ---------------------------------------------------------------------------
--  Les séances honorées viennent de `realised_sessions`, qui ne retient que
--  quatre natures de rendez-vous. Compter les absences sans ce filtre donnait
--  deux numérateurs sur deux bases : une réunion manquée entrait dans un
--  compteur sans pouvoir jamais entrer dans l'autre.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare v_avant int; v_apres jsonb;
begin
  v_avant := (public.follow_up_facts(
    'a6000000-0000-4000-8000-000000000001',
    'a7000000-0000-4000-8000-000000000001',
    date '2026-08-01', date '2026-08-31') ->> 'absences')::int;

  -- Une réunion d'équipe éducative manquée, et une séance annulée par le
  -- cabinet. La première ne doit entrer dans AUCUN compte ; la seconde dans
  -- le sien.
  -- `attendance_note` est exigé par la base sur ces deux issues-là.
  insert into public.appointments
    (practice_id, patient_id, pathway_id, kind, starts_at, ends_at,
     attendance, attendance_note)
  values ('a1111111-1111-4111-8111-111111111111',
          'a6000000-0000-4000-8000-000000000001',
          'a7000000-0000-4000-8000-000000000001', 'reunion',
          timestamptz '2026-08-11 14:00+02', timestamptz '2026-08-11 15:00+02',
          'absent_non_excuse', 'Réunion fictive non honorée'),
         ('a1111111-1111-4111-8111-111111111111',
          'a6000000-0000-4000-8000-000000000001',
          'a7000000-0000-4000-8000-000000000001', 'seance',
          timestamptz '2026-08-18 09:00+02', timestamptz '2026-08-18 09:45+02',
          'annule_praticien', 'Cabinet fermé');

  v_apres := public.follow_up_facts(
    'a6000000-0000-4000-8000-000000000001',
    'a7000000-0000-4000-8000-000000000001',
    date '2026-08-01', date '2026-08-31');

  perform tests.assert_equals((v_apres ->> 'absences')::int, v_avant,
    'Une réunion manquée n''entre pas dans le compte des rendez-vous non honorés : elle ne peut pas entrer dans celui des séances.');
  perform tests.assert_equals((v_apres ->> 'annulees_par_le_cabinet')::int, 1,
    'Une séance annulée par le cabinet est comptée de son côté.');
  perform tests.assert_equals((v_apres ->> 'seances_honorees')::int, 4,
    'Et aucune des deux n''a été honorée.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  10. Une séance qui ne porte aucun parcours est signalée, pas comptée
-- ---------------------------------------------------------------------------
--  `appointments.pathway_id` est facultatif. Une synthèse rattachée à un
--  parcours dont les rendez-vous ne portent pas ce parcours afficherait zéro
--  sans rien dire — et un zéro se lit « aucune séance ».
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare v_f jsonb; v_s uuid; v_instantane jsonb;
begin
  insert into public.appointments
    (practice_id, patient_id, pathway_id, kind, starts_at, ends_at, attendance)
  values ('a1111111-1111-4111-8111-111111111111',
          'a6000000-0000-4000-8000-000000000001', null, 'seance',
          timestamptz '2026-08-25 09:00+02', timestamptz '2026-08-25 09:45+02',
          'honore');

  v_f := public.follow_up_facts(
    'a6000000-0000-4000-8000-000000000001',
    'a7000000-0000-4000-8000-000000000001',
    date '2026-08-01', date '2026-08-31');
  perform tests.assert_equals((v_f ->> 'seances_honorees')::int, 4,
    'Le compte du parcours ne prend pas une séance qui n''y est pas rattachée.');
  perform tests.assert_equals((v_f ->> 'honorees_sans_parcours')::int, 1,
    'Mais elle est SIGNALÉE, pour qu''un zéro ne passe pas pour une absence de séances.');

  /* L'AVERTISSEMENT NE PART PAS AVEC LE DOCUMENT. Il s'adresse à elle, avant
   * de remettre ; il n'apprend rien au destinataire et un document ne
   * conserve pas ce qu'il n'a pas dit. */
  insert into public.follow_up_summaries
    (practice_id, patient_id, pathway_id, period_start, period_end, observed_evolution)
  values ('a1111111-1111-4111-8111-111111111111',
          'a6000000-0000-4000-8000-000000000001',
          'a7000000-0000-4000-8000-000000000001',
          date '2026-08-01', date '2026-08-31', 'Texte.')
  returning id into v_s;
  perform public.issue_follow_up_summary(v_s);
  select snapshot into v_instantane from public.follow_up_summaries where id = v_s;
  perform tests.assert(
    not (v_instantane -> 'faits' ? 'honorees_sans_parcours'),
    'L''avertissement d''écran ne figure pas dans l''instantané.');
  -- Le contre-contrôle : les autres comptes, eux, y sont bien.
  perform tests.assert(v_instantane -> 'faits' ? 'seances_honorees',
    'Les comptes du document, eux, sont figés : sans quoi le refus ci-dessus ne prouverait rien.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  11. Un objectif posé après la fin de la période n'y figure pas
-- ---------------------------------------------------------------------------
--  Une synthèse « du 1er janvier au 30 juin » remise en septembre reprenait
--  les objectifs posés en août. Le titre annonçait une période, la liste en
--  montrait une autre.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare v_f jsonb;
begin
  insert into public.care_objectives
    (practice_id, pathway_id, label, status, position, set_on)
  values ('a1111111-1111-4111-8111-111111111111',
          'a7000000-0000-4000-8000-000000000001',
          'Objectif posé après la période', 'en_cours', 9, date '2026-09-10');

  v_f := public.follow_up_facts(
    'a6000000-0000-4000-8000-000000000001',
    'a7000000-0000-4000-8000-000000000001',
    date '2026-08-01', date '2026-08-31');
  perform tests.assert_equals(jsonb_array_length(v_f -> 'objectifs'), 3,
    'Un objectif posé après la fin de la période n''entre pas dans la synthèse.');

  -- LE CONTRE-CONTRÔLE : une période qui l'englobe le reprend.
  perform tests.assert_equals(
    jsonb_array_length(public.follow_up_facts(
      'a6000000-0000-4000-8000-000000000001',
      'a7000000-0000-4000-8000-000000000001',
      date '2026-08-01', date '2026-09-13') -> 'objectifs'), 4,
    'Une période qui l''englobe le reprend : sans quoi le refus ci-dessus ne prouverait rien.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  12. Une période sans aucune séance se remet quand même
-- ---------------------------------------------------------------------------
--  Un suivi interrompu est un fait à rapporter, et c'est souvent celui qu'il
--  est le plus utile d'écrire. Refuser d'émettre parce qu'un compteur est à
--  zéro ferait taire exactement cette situation-là.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare v_s uuid;
begin
  insert into public.follow_up_summaries
    (practice_id, patient_id, pathway_id, period_start, period_end, observed_evolution)
  values ('a1111111-1111-4111-8111-111111111111',
          'a6000000-0000-4000-8000-000000000001',
          'a7000000-0000-4000-8000-000000000001',
          date '2026-04-01', date '2026-04-30',
          'Aucune séance n''a pu se tenir sur cette période.')
  returning id into v_s;
  perform public.issue_follow_up_summary(v_s);
  perform tests.assert_rows(
    format('select 1 from public.follow_up_summaries
             where id = %L and (snapshot -> ''faits'' ->> ''seances_honorees'')::int = 0', v_s),
    1, 'Une période sans séance se rapporte : c''est un fait, pas un empêchement.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  13. L'instantané a une liste de clés CLOSE, et rien du dossier n'y entre
-- ---------------------------------------------------------------------------
--  Un jeu de clés fermé attrape N'IMPORTE QUEL ajout, pas seulement ceux qu'on
--  a imaginés. Ajouter un champ au document devra passer par ici, donc par une
--  décision.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_s uuid;
  v_texte text;
  v_cles text;
  v_cles_faits text;
begin
  -- On PLANTE ce qui ne doit pas fuir, sans quoi les sentinelles ci-dessous
  -- passeraient faute de matière à perdre.
  update public.care_pathways
     set referral_reason = 'MOTIFSENTINELLE'
   where id = 'a7000000-0000-4000-8000-000000000001';
  update public.appointments
     set attendance_note = 'NOTERDVSENTINELLE'
   where pathway_id = 'a7000000-0000-4000-8000-000000000001'
     and attendance = 'honore';
  insert into public.patient_notes
    (practice_id, patient_id, pathway_id, written_on, body)
  values ('a1111111-1111-4111-8111-111111111111',
          'a6000000-0000-4000-8000-000000000001',
          'a7000000-0000-4000-8000-000000000001',
          date '2026-08-06', 'NOTECLINIQUESENTINELLE');

  insert into public.follow_up_summaries
    (practice_id, patient_id, pathway_id, period_start, period_end,
     observed_evolution, internal_note)
  values ('a1111111-1111-4111-8111-111111111111',
          'a6000000-0000-4000-8000-000000000001',
          'a7000000-0000-4000-8000-000000000001',
          date '2026-08-01', date '2026-08-31',
          'Texte.', 'NOTEINTERNESENTINELLE')
  returning id into v_s;
  perform public.issue_follow_up_summary(v_s);

  select snapshot::text into v_texte from public.follow_up_summaries where id = v_s;
  perform tests.assert(v_texte not like '%MOTIFSENTINELLE%',
    'Le motif de la demande — la parole d''un tiers, parfois ancienne — ne part pas avec la synthèse.');
  perform tests.assert(v_texte not like '%NOTERDVSENTINELLE%',
    'Ce qui a été noté sur un rendez-vous ne part pas non plus.');
  perform tests.assert(v_texte not like '%NOTECLINIQUESENTINELLE%',
    'Aucune note de séance n''entre dans la synthèse.');
  perform tests.assert(v_texte not like '%NOTEINTERNESENTINELLE%',
    'La note interne n''est jamais imprimée.');

  select string_agg(k, ',' order by k) into v_cles
    from jsonb_object_keys((select snapshot from public.follow_up_summaries where id = v_s)) k;
  perform tests.assert_equals(v_cles,
    'cabinet,destinataire,emis_le,entite_juridique,faits,identifiants,mentions,patient,periode,praticien,remise',
    'L''instantané d''une synthèse a une liste de clés CLOSE. En ajouter une est une décision, pas un détail.');

  /* LES FAITS ONT DEUX FORMES, ET C'EST LA RÈGLE « UN DOCUMENT NE CONSERVE PAS
   * CE QU'IL N'A PAS DIT ». Taire les rendez-vous non honorés au seul rendu
   * laissait l'instantané porter une donnée que le destinataire n'a jamais
   * reçue : tout export, toute lecture d'API la restituait. Trouvé par la
   * relecture de sécurité du rang 3. */
  select string_agg(k, ',' order by k) into v_cles_faits
    from jsonb_object_keys(
      (select snapshot -> 'faits' from public.follow_up_summaries where id = v_s)) k;
  perform tests.assert_equals(v_cles_faits,
    'objectifs,parcours_ouvert_le,seances_honorees',
    'Sans la case cochée, les comptes de rendez-vous non honorés ne sont pas même conservés.');

  /* CHAQUE OBJECTIF AUSSI a son jeu de clés fermé. `note_de_reevaluation`
   * y est parce que le STATUT est un mot du logiciel, choisi dans une
   * énumération, tandis que la note de réévaluation est la sienne : imprimer
   * le premier sans la seconde inverserait la doctrine annoncée. */
  select string_agg(k, ',' order by k) into v_cles_faits
    from jsonb_object_keys(
      (select snapshot -> 'faits' -> 'objectifs' -> 0
         from public.follow_up_summaries where id = v_s)) k;
  perform tests.assert_equals(v_cles_faits,
    'intitule,note_de_reevaluation,pose_le,revu_le,statut',
    'Un objectif figé porte ses mots à elle, pas seulement le statut choisi par le logiciel.');

  /* À QUI ELLE A ÉTÉ REMISE, écrit en toutes lettres — y compris quand aucun
   * destinataire n'est nommé, ce qui est le cas ici. */
  perform tests.assert_equals(v_texte::jsonb ->> 'remise', 'a_la_personne_suivie',
    'L''instantané dit à qui la synthèse a été remise, même sans destinataire nommé.');
  perform tests.assert(
    (v_texte::jsonb -> 'mentions' ->> 'comptes') like '%attestation de présence%',
    'La mention qui encadre les comptes est figée avec le document, et renvoie au document vérifiable.');

  /* LE CONTRE-CONTRÔLE : avec la case cochée, les deux comptes SONT figés.
   * Sans lui, une fonction qui ne les calculerait jamais passerait le contrôle
   * ci-dessus tout aussi bien. */
  insert into public.follow_up_summaries
    (practice_id, patient_id, pathway_id, period_start, period_end,
     observed_evolution, detail_absences)
  values ('a1111111-1111-4111-8111-111111111111',
          'a6000000-0000-4000-8000-000000000001',
          'a7000000-0000-4000-8000-000000000001',
          date '2026-08-01', date '2026-08-31', 'Texte.', true)
  returning id into v_s;
  perform public.issue_follow_up_summary(v_s);
  select string_agg(k, ',' order by k) into v_cles_faits
    from jsonb_object_keys(
      (select snapshot -> 'faits' from public.follow_up_summaries where id = v_s)) k;
  perform tests.assert_equals(v_cles_faits,
    'absences,annulees_par_le_cabinet,objectifs,parcours_ouvert_le,seances_honorees',
    'Avec la case cochée, les deux comptes sont figés — et les DEUX, pas seulement les absences.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  15. Le refus est le MÊME, que le dossier existe ailleurs ou n'existe pas
-- ---------------------------------------------------------------------------
--  LE DÉFAUT, démontré par la relecture de sécurité : PostgreSQL exécute les
--  déclencheurs BEFORE ROW avant la clause `with check` de la RLS. Le
--  déclencheur de cohérence, `security definer`, contourne la RLS et répondait
--  donc le premier — avec un code et un message DIFFÉRENTS selon que la
--  ressource appartenait ou non au cabinet visé. Cela suffisait à confirmer
--  une appartenance sans être membre.
--
--  Aucun contenu ne fuyait, seulement l'appartenance. Le scénario réaliste
--  n'est pas l'inconnu — `anon` est refusé au niveau privilège — mais le
--  MEMBRE RÉVOQUÉ, à qui la perte du statut actif retire toute lecture en lui
--  laissant ce sondage.
begin;
do $$
declare
  v_patient_a uuid := 'a6000000-0000-4000-8000-000000000001';
  v_inexistant uuid := '00000000-0000-4000-8000-00000000dead';
  v_reel text;
  v_faux text;
  v_ok boolean;
begin
  -- Beta, propriétaire du cabinet B, écrit vers le cabinet A.
  perform tests.authenticate_as('b0000000-0000-4000-8000-000000000001'::uuid);

  begin
    insert into public.follow_up_summaries
      (practice_id, patient_id, period_start, period_end, observed_evolution)
    values ('a1111111-1111-4111-8111-111111111111', v_patient_a,
            date '2026-08-01', date '2026-08-31', 'Texte.');
    v_reel := 'AUCUN REFUS';
  exception when others then v_reel := sqlstate || ' ' || sqlerrm;
  end;

  begin
    insert into public.follow_up_summaries
      (practice_id, patient_id, period_start, period_end, observed_evolution)
    values ('a1111111-1111-4111-8111-111111111111', v_inexistant,
            date '2026-08-01', date '2026-08-31', 'Texte.');
    v_faux := 'AUCUN REFUS';
  exception when others then v_faux := sqlstate || ' ' || sqlerrm;
  end;

  perform tests.assert_equals(v_reel, v_faux,
    'Un dossier RÉEL d''un autre cabinet et un dossier INEXISTANT doivent être refusés de la même façon : sinon la différence dit lequel existe.');
  perform tests.assert(v_reel <> 'AUCUN REFUS',
    'Et les deux doivent bien être refusés : sans quoi l''égalité ci-dessus ne prouverait rien.');

  -- LE CONTRE-CONTRÔLE : la praticienne du cabinet A, elle, écrit.
  reset role;
  perform tests.authenticate_as('a0000000-0000-4000-8000-000000000001'::uuid);
  perform tests.assert_affects_rows(
    format('insert into public.follow_up_summaries
              (practice_id, patient_id, period_start, period_end, observed_evolution)
            values (%L, %L, date ''2026-08-01'', date ''2026-08-31'', ''Texte.'')',
           'a1111111-1111-4111-8111-111111111111', v_patient_a),
    1, 'Le membre habilité écrit toujours : le refus uniforme n''a rien fermé de légitime.');

  /* LA MÊME LACUNE EXISTAIT SUR LES DEUX ÉCRITS DÉJÀ LIVRÉS. Elle est corrigée
   * dans la même migration, parce que c'est UNE décision et non trois. */
  reset role;
  perform tests.authenticate_as('b0000000-0000-4000-8000-000000000001'::uuid);

  begin
    insert into public.liaison_letters
      (practice_id, patient_id, recipient_contact_id, subject, body)
    values ('a1111111-1111-4111-8111-111111111111', v_patient_a,
            (select id from public.contacts
              where practice_id = 'a1111111-1111-4111-8111-111111111111' limit 1),
            'Objet', 'Corps');
    v_reel := 'AUCUN REFUS';
  exception when others then v_reel := sqlstate || ' ' || sqlerrm;
  end;
  begin
    insert into public.liaison_letters
      (practice_id, patient_id, recipient_contact_id, subject, body)
    values ('a1111111-1111-4111-8111-111111111111', v_inexistant,
            v_inexistant, 'Objet', 'Corps');
    v_faux := 'AUCUN REFUS';
  exception when others then v_faux := sqlstate || ' ' || sqlerrm;
  end;
  perform tests.assert_equals(v_reel, v_faux,
    'Le courrier de liaison refuse de la même façon, lui aussi.');

  begin
    insert into public.attestations (practice_id, kind, patient_id)
    values ('a1111111-1111-4111-8111-111111111111', 'presence', v_patient_a);
    v_reel := 'AUCUN REFUS';
  exception when others then v_reel := sqlstate || ' ' || sqlerrm;
  end;
  begin
    insert into public.attestations (practice_id, kind, patient_id)
    values ('a1111111-1111-4111-8111-111111111111', 'presence', v_inexistant);
    v_faux := 'AUCUN REFUS';
  exception when others then v_faux := sqlstate || ' ' || sqlerrm;
  end;
  perform tests.assert_equals(v_reel, v_faux,
    'L''attestation aussi.');
  perform tests.assert(v_reel <> 'AUCUN REFUS',
    'Et toutes refusent bien : sans quoi les égalités ci-dessus ne prouveraient rien.');

  v_ok := true;
  perform tests.assert(v_ok, 'Bloc exécuté.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  14. Le motif d'une annulation ne se réécrit pas
-- ---------------------------------------------------------------------------
--  C'est la phrase que lit celui qui a reçu la synthèse. La laisser réécrire
--  indéfiniment revenait à lui raconter, plus tard, une autre histoire de la
--  même annulation.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare v_s uuid;
begin
  insert into public.follow_up_summaries
    (practice_id, patient_id, period_start, period_end, observed_evolution)
  values ('a1111111-1111-4111-8111-111111111111',
          'a6000000-0000-4000-8000-000000000001',
          date '2026-08-01', date '2026-08-31', 'Texte.')
  returning id into v_s;
  perform public.issue_follow_up_summary(v_s);
  perform public.cancel_follow_up_summary(v_s, 'Période erronée.');

  perform tests.assert_fails(
    format('update public.follow_up_summaries set cancellation_reason = ''Autre motif.'' where id = %L', v_s),
    'Le motif d''une annulation ne se réécrit pas : il a déjà été lu.');
end
$$;
rollback;
