-- ============================================================================
--  130 — ÉCRIT DE FIN DE PRISE EN SOIN
--  Ce qui est vérifié ici : le parcours se clôt d'abord et l'écrit en découle,
--  jamais l'inverse ; les quatre natures de fin n'accusent personne ; et un
--  écrit remis ne peut plus être contredit par la base.
-- ============================================================================
\set ON_ERROR_STOP on

\set alpha    '''a0000000-0000-4000-8000-000000000001'''
\set cab_a    '''a1111111-1111-4111-8111-111111111111'''
\set zephyr   '''a6000000-0000-4000-8000-000000000001'''
\set parcours '''a7000000-0000-4000-8000-000000000001'''

-- ---------------------------------------------------------------------------
--  1. Le parcours se clôt d'abord, l'écrit en découle
-- ---------------------------------------------------------------------------
--  Faire clôturer un parcours par la remise d'un document ferait décider d'un
--  état clinique par un acte documentaire. Le dépôt tient déjà cette position
--  dans l'autre sens : `unarchive_patient` refuse de rouvrir les parcours.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare v_e uuid;
begin
  -- LE BROUILLON S'ÉCRIT SUR UN PARCOURS ENCORE OUVERT : on prépare l'écrit
  -- avant la dernière séance. L'interdire créerait un blocage sans bénéfice.
  insert into public.closure_reports
    (practice_id, patient_id, pathway_id, closure_kind, observed)
  values ('a1111111-1111-4111-8111-111111111111',
          'a6000000-0000-4000-8000-000000000001',
          'a7000000-0000-4000-8000-000000000001',
          'fin_convenue', 'Zéphyr a investi le travail graphique jusqu''au bout.')
  returning id into v_e;

  perform tests.assert_fails(
    format('select public.issue_closure_report(%L)', v_e),
    'Un écrit de fin ne se remet pas sur un parcours encore ouvert.');

  -- On clôt le parcours, comme elle le ferait depuis le dossier.
  update public.care_pathways
     set status = 'termine', ended_on = current_date - 3,
         end_reason = 'Objectifs revus en juin, fin convenue en septembre.'
   where id = 'a7000000-0000-4000-8000-000000000001';

  perform public.issue_closure_report(v_e);
  perform tests.assert_rows(
    format('select 1 from public.closure_reports where id = %L and status = ''emis''', v_e),
    1, 'Sur un parcours clos, il se remet : sans quoi le refus ci-dessus ne prouverait rien.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  2. Ce qui empêche de remettre
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare v_e uuid;
begin
  update public.care_pathways
     set status = 'termine', ended_on = current_date - 3
   where id = 'a7000000-0000-4000-8000-000000000001';

  insert into public.closure_reports
    (practice_id, patient_id, pathway_id, closure_kind)
  values ('a1111111-1111-4111-8111-111111111111',
          'a6000000-0000-4000-8000-000000000001',
          'a7000000-0000-4000-8000-000000000001', 'fin_convenue')
  returning id into v_e;

  perform tests.assert_fails(
    format('select public.issue_closure_report(%L)', v_e),
    'Un écrit qui ne dit rien de ce qu''on observe ne se remet pas.');

  update public.closure_reports set observed = 'Texte.' where id = v_e;
  perform tests.assert_fails(
    format('select public.issue_closure_report(%L, current_date + 1)', v_e),
    'Un écrit de fin ne se date pas du futur.');

  -- Une date de fin dans le futur : on ne rend pas compte de ce qui n'a pas eu lieu.
  update public.care_pathways set ended_on = current_date + 10
   where id = 'a7000000-0000-4000-8000-000000000001';
  perform tests.assert_fails(
    format('select public.issue_closure_report(%L)', v_e),
    'Un parcours qui se termine dans le futur ne se rend pas compte.');

  /* PAS DE DATE DE DÉBUT — le cas des parcours repris de la v1, qui portent un
   * statut mais aucune borne. Le message doit dire quoi remplir. */
  update public.care_pathways
     set ended_on = current_date - 3, started_on = null
   where id = 'a7000000-0000-4000-8000-000000000001';
  perform tests.assert_fails(
    format('select public.issue_closure_report(%L)', v_e),
    'Un parcours sans date de début ne produit pas d''écrit de fin.');

  -- LE CONTRE-CONTRÔLE : avec les deux bornes, il part.
  update public.care_pathways
     set started_on = date '2026-01-22'
   where id = 'a7000000-0000-4000-8000-000000000001';
  perform public.issue_closure_report(v_e);
  perform tests.assert_rows(
    format('select 1 from public.closure_reports where id = %L and status = ''emis''', v_e),
    1, 'Avec ses deux bornes, il se remet : sans quoi les refus ci-dessus ne prouveraient rien.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  3. Les faits de l'ÉPISODE, pas d'une période choisie
-- ---------------------------------------------------------------------------
--  C'est ce qui distingue cet écrit d'une synthèse de suivi portant sur la
--  dernière période : les bornes ne sont pas choisies, ce sont celles du
--  parcours.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare v_f jsonb;
begin
  v_f := public.closure_facts('a7000000-0000-4000-8000-000000000001');

  perform tests.assert_equals((v_f ->> 'seances_honorees')::int, 7,
    'Le compte porte sur tout l''épisode.');
  /* UNE BOMBE À RETARDEMENT, DÉSAMORCÉE. Ce contrôle attendait la date en dur
   * « 2026-09-03 » : la séance honorée la plus récente LE JOUR OÙ IL A ÉTÉ
   * ÉCRIT. Or le jeu d'essai date ses rendez-vous par rapport à `now()` — il le
   * dit en tête de `0003_agenda_fictif.sql` — et la séance honorée la plus
   * récente tombe dix jours avant son chargement. Le contrôle ne pouvait
   * réussir que le 13 septembre 2026 : le 14, `main` ne passait plus
   * `npm run verify`.
   *
   * La référence est donc lue dans la table des rendez-vous elle-même — sans
   * la vue `realised_sessions` ni `closure_facts`, qui sont ce qu'on éprouve —
   * et sans `now()` dans l'égalité : le jeu est chargé quelques secondes avant
   * ce contrôle, et `date_trunc('hour', now())` pouvait changer d'heure entre
   * les deux, pile au passage de minuit à Paris.
   *
   * Cette égalité seule ne distingue pas « la dernière séance » du « dernier
   * rendez-vous » : sur CE parcours, le jeu d'essai n'a aucun rendez-vous non
   * honoré plus récent — vérifié en l'exigeant, et l'exigence a échoué. La
   * date en dur d'origine ne le distinguait donc pas davantage. Le contrôle
   * qui le fait est à la fin de ce bloc. */
  perform tests.assert_equals(
    v_f ->> 'derniere_seance_le',
    (select max((a.starts_at at time zone 'Europe/Paris')::date)::text
       from public.appointments a
      where a.pathway_id = 'a7000000-0000-4000-8000-000000000001'
        and a.attendance = 'honore'),
    'UNE date, pas une liste : le repère que la famille reconnaît — la dernière séance HONORÉE, pas le dernier rendez-vous.');
  perform tests.assert_equals((v_f ->> 'rendez_vous_a_venir')::int, 4,
    'Les créneaux encore à venir sont signalés : ils restent bloqués à l''agenda.');
  perform tests.assert_equals((v_f ->> 'objectifs_en_cours')::int, 2,
    'Les objectifs encore en cours sur un parcours qui se clôt sont comptés, pour être signalés.');
  perform tests.assert_equals(jsonb_array_length(v_f -> 'objectifs'), 3,
    'Les objectifs de CE parcours, et aucun autre.');
  perform tests.assert(v_f -> 'parcours' ->> 'ouvert_le' = '2026-01-22',
    'Les bornes viennent du parcours.');

  /* LE MOTIF DE LA DEMANDE EST PROPOSÉ, PAS IMPRIMÉ. Il est rendu pour que
   * l'écran l'affiche en lecture seule avec un bouton « reprendre » : c'est la
   * parole du demandeur, parfois celle d'un tiers, parfois vieille de trois
   * ans. Ce qui s'imprime est le champ qu'elle a relu. */
  perform tests.assert(v_f ? 'motif_demande_a_reprendre',
    'Le motif de la demande est proposé à la reprise.');
  perform tests.assert(v_f ? 'fin_du_parcours_a_reprendre',
    'Le motif de fin noté au parcours aussi — il est parfois écrit par le logiciel lui-même.');

  /* « LA DERNIÈRE SÉANCE », PAS « LE DERNIER RENDEZ-VOUS ». Un rendez-vous
   * annulé DEUX JOURS après la dernière séance honorée, sur ce parcours : il
   * est plus récent, et ne doit rien déplacer. Deux jours et non un : l'autre
   * dossier fictif porte une annulation au même créneau, chez la même
   * praticienne. Posé après toutes les assertions ci-dessus, qui lisent `v_f`
   * tel qu'avant ; la transaction est annulée. */
  insert into public.appointments
    (practice_id, patient_id, pathway_id, practitioner_member_id,
     kind, starts_at, ends_at, attendance, attendance_note, billable, created_by)
  select 'a1111111-1111-4111-8111-111111111111',
         'a6000000-0000-4000-8000-000000000001',
         'a7000000-0000-4000-8000-000000000001',
         'a2222222-2222-4222-8222-222222222221',
         'seance',
         max(h.starts_at) + interval '2 days',
         max(h.starts_at) + interval '2 days 45 minutes',
         'annule_praticien', 'Annulation fictive, plus récente que la dernière séance.', false,
         'a0000000-0000-4000-8000-000000000001'
    from public.appointments h
   where h.pathway_id = 'a7000000-0000-4000-8000-000000000001'
     and h.attendance = 'honore';
  perform tests.assert_equals(
    public.closure_facts('a7000000-0000-4000-8000-000000000001') ->> 'derniere_seance_le',
    v_f ->> 'derniere_seance_le',
    'Un rendez-vous plus récent mais NON honoré ne déplace pas la dernière séance.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  4. Ce qui ne part pas avec le document
-- ---------------------------------------------------------------------------
--  Deux avertissements d'écran, deux champs proposés à la reprise, et les
--  comptes qu'elle a choisi de ne pas dire. Un document ne conserve pas ce
--  qu'il n'a pas dit.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_e uuid;
  v_cles text;
  v_cles_faits text;
  v_texte text;
begin
  update public.care_pathways
     set status = 'termine', ended_on = current_date - 3,
         referral_reason = 'MOTIFSENTINELLE',
         end_reason = 'FINSENTINELLE'
   where id = 'a7000000-0000-4000-8000-000000000001';

  insert into public.closure_reports
    (practice_id, patient_id, pathway_id, closure_kind, observed, internal_note)
  values ('a1111111-1111-4111-8111-111111111111',
          'a6000000-0000-4000-8000-000000000001',
          'a7000000-0000-4000-8000-000000000001',
          'fin_convenue', 'Texte.', 'NOTEINTERNESENTINELLE')
  returning id into v_e;
  perform public.issue_closure_report(v_e);

  select snapshot::text into v_texte from public.closure_reports where id = v_e;
  perform tests.assert(v_texte not like '%MOTIFSENTINELLE%',
    'Le motif de la demande n''est pas lu à travers : ce qui s''imprime, ce sont SES mots.');
  perform tests.assert(v_texte not like '%FINSENTINELLE%',
    'Le motif de fin noté au parcours non plus — le logiciel l''écrit parfois lui-même.');
  perform tests.assert(v_texte not like '%NOTEINTERNESENTINELLE%',
    'La note interne n''est jamais imprimée.');

  select string_agg(k, ',' order by k) into v_cles
    from jsonb_object_keys((select snapshot from public.closure_reports where id = v_e)) k;
  perform tests.assert_equals(v_cles,
    'cabinet,consentement_partage,destinataire,emis_le,entite_juridique,faits,identifiants,mentions,nature,patient,praticien,remise',
    'L''instantané d''un écrit de fin a une liste de clés CLOSE.');

  select string_agg(k, ',' order by k) into v_cles_faits
    from jsonb_object_keys(
      (select snapshot -> 'faits' from public.closure_reports where id = v_e)) k;
  perform tests.assert_equals(v_cles_faits,
    'derniere_seance_le,objectifs,parcours,prescripteur,seances_honorees',
    'Les FAITS aussi : ni avertissement d''écran, ni parole proposée à la reprise, ni compte non dit.');

  perform tests.assert(
    (v_texte::jsonb -> 'mentions' ->> 'nature') like '%convenue%',
    'La nature de la fin est énoncée, et figée avec le document.');
  perform tests.assert(
    (v_texte::jsonb -> 'mentions' ->> 'remise') like '%versé au dossier%',
    'Un écrit qui ne part chez personne le DIT : c''est une réponse, pas un vide.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  5. Ce qu'elle choisit de dire est ce qui est conservé
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare v_e uuid; v_cles text;
begin
  update public.care_pathways
     set status = 'termine', ended_on = current_date - 3
   where id = 'a7000000-0000-4000-8000-000000000001';

  insert into public.closure_reports
    (practice_id, patient_id, pathway_id, closure_kind, observed,
     detail_absences, detail_financement)
  values ('a1111111-1111-4111-8111-111111111111',
          'a6000000-0000-4000-8000-000000000001',
          'a7000000-0000-4000-8000-000000000001',
          'fin_convenue', 'Texte.', true, true)
  returning id into v_e;
  perform public.issue_closure_report(v_e);

  select string_agg(k, ',' order by k) into v_cles
    from jsonb_object_keys(
      (select snapshot -> 'faits' from public.closure_reports where id = v_e)) k;
  perform tests.assert_equals(v_cles,
    'absences,annulees_par_le_cabinet,derniere_seance_le,financement,objectifs,parcours,prescripteur,seances_honorees',
    'Ce qu''elle demande à dire est figé — et les absences vont par PAIRE, jamais seules.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  6. Un écrit remis ne bouge plus, et ne peut plus être contredit
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare v_e uuid; v_autre uuid;
begin
  update public.care_pathways
     set status = 'termine', ended_on = current_date - 3
   where id = 'a7000000-0000-4000-8000-000000000001';
  select id into v_autre from public.contacts
   where practice_id = 'a1111111-1111-4111-8111-111111111111' limit 1;

  insert into public.closure_reports
    (practice_id, patient_id, pathway_id, closure_kind, observed,
     delivery_mode, recipient_contact_id)
  values ('a1111111-1111-4111-8111-111111111111',
          'a6000000-0000-4000-8000-000000000001',
          'a7000000-0000-4000-8000-000000000001',
          'relais', 'Texte.', 'destinataire', v_autre)
  returning id into v_e;
  perform public.issue_closure_report(v_e);

  perform tests.assert_fails(
    format('update public.closure_reports set observed = ''Autre.'' where id = %L', v_e),
    'Un écrit remis ne se réécrit pas.');
  perform tests.assert_fails(
    format('update public.closure_reports set closure_kind = ''sans_nouvelle'' where id = %L', v_e),
    'Un écrit remis ne change pas de nature : c''est la seule phrase que le logiciel y écrit.');
  perform tests.assert_fails(
    format('update public.closure_reports set delivery_mode = ''au_dossier'', recipient_contact_id = null where id = %L', v_e),
    'Un écrit remis ne change pas de mode de remise.');
  perform tests.assert_fails(
    format('update public.closure_reports set handover = ''Autre relais.'' where id = %L', v_e),
    'Le relais proposé ne se réécrit pas.');
  perform tests.assert_fails(
    format('update public.closure_reports set resumption = ''Autres modalités.'' where id = %L', v_e),
    'Les modalités de reprise non plus.');
  perform tests.assert_fails(
    format('update public.closure_reports set remains_open = ''Autre chose.'' where id = %L', v_e),
    'Ce qui reste ouvert non plus.');
  perform tests.assert_fails(
    format('update public.closure_reports set context = ''Autre contexte.'' where id = %L', v_e),
    'Le contexte de la demande non plus.');
  perform tests.assert_fails(
    format('update public.closure_reports set closure_reason = ''Autre motif.'' where id = %L', v_e),
    'Ce qui met fin non plus.');
  perform tests.assert_fails(
    format('update public.closure_reports set means = ''Autre cadre.'' where id = %L', v_e),
    'Le cadre et les moyens non plus.');
  perform tests.assert_fails(
    format('update public.closure_reports set note = ''Autre mention.'' where id = %L', v_e),
    'La mention imprimée non plus.');
  perform tests.assert_fails(
    format('update public.closure_reports set detail_objectifs = false where id = %L', v_e),
    'Les objectifs ne se retirent pas après coup.');
  perform tests.assert_fails(
    format('update public.closure_reports set detail_absences = true where id = %L', v_e),
    'Les absences ne s''ajoutent pas après coup.');
  perform tests.assert_fails(
    format('update public.closure_reports set detail_financement = true where id = %L', v_e),
    'Le cadre de financement non plus.');
  perform tests.assert_fails(
    format('update public.closure_reports set issued_on = date ''2020-01-01'' where id = %L', v_e),
    'Un écrit remis ne se redate pas.');
  perform tests.assert_fails(
    format('update public.closure_reports set pathway_id = %L where id = %L',
           'a7000000-0000-4000-8000-000000000002', v_e),
    'Un écrit remis ne change pas d''épisode.');
  perform tests.assert_fails(
    format('update public.closure_reports set issued_by = null where id = %L', v_e),
    'On ne réécrit pas qui a signé.');
  perform tests.assert_fails(
    format('update public.closure_reports set created_by = null where id = %L', v_e),
    'Ni qui a rédigé.');
  perform tests.assert_fails(
    format('update public.closure_reports set created_at = now() + interval ''1 hour'' where id = %L', v_e),
    'Ni quand il a été créé.');
  perform tests.assert_fails(
    format('update public.closure_reports
              set snapshot = jsonb_set(snapshot, ''{faits,seances_honorees}'', ''40'')
            where id = %L', v_e),
    'L''instantané ne se réécrit pas.');
  perform tests.assert_fails(
    format('delete from public.closure_reports where id = %L', v_e),
    'Un écrit remis ne se supprime pas.');

  -- La note interne, elle, reste modifiable : elle n'est jamais partie.
  perform tests.assert_affects_rows(
    format('update public.closure_reports set internal_note = ''Relancer.'' where id = %L', v_e),
    1, 'Une note interne s''ajoute après la remise.');

  /* ET LE PARCOURS NE SE ROUVRE PLUS. Un document remis affirme « prise en
   * soin terminée le X » ; rouvrir le parcours derrière lui ferait dire à la
   * base le contraire de ce que son destinataire tient entre les mains. Une
   * reprise se fait dans un NOUVEAU parcours. */
  perform tests.assert_fails(
    'update public.care_pathways set status = ''actif'', ended_on = null
      where id = ''a7000000-0000-4000-8000-000000000001''',
    'Un parcours qui porte un écrit de fin remis ne se rouvre pas.');

  -- Il s'annule, avec un motif, et l'annulation ne se défait pas.
  perform tests.assert_fails(
    format('select public.cancel_closure_report(%L, ''  '')', v_e),
    'Une annulation sans motif n''apprend rien à qui a reçu l''écrit.');
  perform public.cancel_closure_report(v_e, 'Erreur de destinataire.');
  perform tests.assert_fails(
    format('update public.closure_reports set status = ''emis'' where id = %L', v_e),
    'Une annulation ne se défait pas.');

  -- Et une fois annulé, le parcours se rouvre : plus rien n'est opposable.
  perform tests.assert_affects_rows(
    'update public.care_pathways set status = ''actif'', ended_on = null
      where id = ''a7000000-0000-4000-8000-000000000001''',
    1, 'Un écrit ANNULÉ ne verrouille plus le parcours : sans quoi le refus ci-dessus ne prouverait rien.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  7. Le destinataire et le mode de remise s'accordent, par construction
-- ---------------------------------------------------------------------------
--  C'est le défaut de la synthèse de suivi, fermé ici par une contrainte : sur
--  elle, la case « remis à la personne » et un destinataire nommé pouvaient
--  être renseignés en même temps.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare v_dest uuid;
begin
  select id into v_dest from public.contacts
   where practice_id = 'a1111111-1111-4111-8111-111111111111' limit 1;

  perform tests.assert_fails(
    format('insert into public.closure_reports
              (practice_id, patient_id, pathway_id, closure_kind, delivery_mode, recipient_contact_id)
            values (%L, %L, %L, ''relais'', ''au_dossier'', %L)',
           'a1111111-1111-4111-8111-111111111111',
           'a6000000-0000-4000-8000-000000000001',
           'a7000000-0000-4000-8000-000000000001', v_dest),
    'Un destinataire nommé sans le mode qui va avec est refusé.');

  perform tests.assert_fails(
    format('insert into public.closure_reports
              (practice_id, patient_id, pathway_id, closure_kind, delivery_mode)
            values (%L, %L, %L, ''relais'', ''destinataire'')',
           'a1111111-1111-4111-8111-111111111111',
           'a6000000-0000-4000-8000-000000000001',
           'a7000000-0000-4000-8000-000000000001'),
    'Le mode « destinataire » sans destinataire est refusé.');

  perform tests.assert_affects_rows(
    format('insert into public.closure_reports
              (practice_id, patient_id, pathway_id, closure_kind, delivery_mode, recipient_contact_id)
            values (%L, %L, %L, ''relais'', ''destinataire'', %L)',
           'a1111111-1111-4111-8111-111111111111',
           'a6000000-0000-4000-8000-000000000001',
           'a7000000-0000-4000-8000-000000000001', v_dest),
    1, 'Les deux ensemble passent : sans quoi les refus ci-dessus ne prouveraient rien.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  8. Le refus est le MÊME, que la ressource existe ailleurs ou n'existe pas
-- ---------------------------------------------------------------------------
begin;
do $$
declare
  v_reel text;
  v_faux text;
  v_inexistant uuid := '00000000-0000-4000-8000-00000000dead';
begin
  perform tests.authenticate_as('b0000000-0000-4000-8000-000000000001'::uuid);
  begin
    insert into public.closure_reports
      (practice_id, patient_id, pathway_id, closure_kind)
    values ('a1111111-1111-4111-8111-111111111111',
            'a6000000-0000-4000-8000-000000000001',
            'a7000000-0000-4000-8000-000000000001', 'fin_convenue');
    v_reel := 'AUCUN REFUS';
  exception when others then v_reel := sqlstate || ' ' || sqlerrm;
  end;
  begin
    insert into public.closure_reports
      (practice_id, patient_id, pathway_id, closure_kind)
    values ('a1111111-1111-4111-8111-111111111111',
            v_inexistant, v_inexistant, 'fin_convenue');
    v_faux := 'AUCUN REFUS';
  exception when others then v_faux := sqlstate || ' ' || sqlerrm;
  end;
  perform tests.assert_equals(v_reel, v_faux,
    'Un dossier RÉEL d''un autre cabinet et un dossier INEXISTANT sont refusés de la même façon.');
  perform tests.assert(v_reel <> 'AUCUN REFUS',
    'Et les deux sont bien refusés : sans quoi l''égalité ci-dessus ne prouverait rien.');

  perform tests.assert_fails(
    'select public.closure_facts(''a7000000-0000-4000-8000-000000000001'')',
    'Le cabinet voisin ne calcule pas les faits d''un parcours qui n''est pas le sien.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  9. C'est un contenu clinique : l'assistant ne le lit pas
-- ---------------------------------------------------------------------------
begin;
do $$
begin
  insert into auth.users (id, email)
  values ('a0000000-0000-4000-8000-0000000000c9', 'assistant-fin@exemple-fictif.test')
  on conflict (id) do nothing;
  insert into public.practice_members (practice_id, user_id, role, status)
  values ('a1111111-1111-4111-8111-111111111111',
          'a0000000-0000-4000-8000-0000000000c9', 'assistant', 'active');

  perform tests.authenticate_as('a0000000-0000-4000-8000-000000000001'::uuid);
  insert into public.closure_reports
    (practice_id, patient_id, pathway_id, closure_kind, observed)
  values ('a1111111-1111-4111-8111-111111111111',
          'a6000000-0000-4000-8000-000000000001',
          'a7000000-0000-4000-8000-000000000001', 'fin_convenue', 'Texte clinique.');

  reset role;
  perform tests.authenticate_as('a0000000-0000-4000-8000-0000000000c9'::uuid);
  perform tests.assert_rows('select 1 from public.closure_reports', 0,
    'Un assistant ne lit pas les écrits de fin de son cabinet.');
  perform tests.assert_fails(
    'select public.closure_facts(''a7000000-0000-4000-8000-000000000001'')',
    'Ni les faits de l''épisode, qui portent les objectifs.');

  reset role;
  perform tests.authenticate_as('a0000000-0000-4000-8000-000000000001'::uuid);
  perform tests.assert_rows('select 1 from public.closure_reports', 1,
    'La praticienne les lit : sans quoi les refus ci-dessus ne prouveraient rien.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  10. Le cabinet d'à côté n'en voit rien
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
begin
  insert into public.closure_reports
    (practice_id, patient_id, pathway_id, closure_kind, observed)
  values ('a1111111-1111-4111-8111-111111111111',
          'a6000000-0000-4000-8000-000000000001',
          'a7000000-0000-4000-8000-000000000001',
          'sans_nouvelle', 'Texte confidentiel.');

  reset role;
  perform tests.authenticate_as('b0000000-0000-4000-8000-000000000001'::uuid);
  perform tests.assert_rows('select 1 from public.closure_reports', 0,
    'Le cabinet voisin ne voit aucun écrit de fin.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  11. Ce qui ne peut pas être écrit
-- ---------------------------------------------------------------------------
--  Les trois vérifications de cohérence, chacune ISOLÉE. Écrites ensemble sur
--  un même cas, elles se masquaient l'une l'autre : la première refusait, et
--  les deux autres n'étaient jamais atteintes.
begin;
do $$
declare
  v_patient_b uuid;
  v_parcours_b uuid;
  v_dest_b uuid;
begin
  perform tests.authenticate_as('b0000000-0000-4000-8000-000000000001'::uuid);
  select cp.patient_id, cp.id into v_patient_b, v_parcours_b
    from public.care_pathways cp
   where cp.practice_id = 'b1111111-1111-4111-8111-111111111111' limit 1;
  select id into v_dest_b from public.contacts
   where practice_id = 'b1111111-1111-4111-8111-111111111111' limit 1;
  reset role;

  perform tests.authenticate_as('a0000000-0000-4000-8000-000000000001'::uuid);

  -- LE DOSSIER. Un dossier d'un autre cabinet, avec son parcours : c'est la
  -- vérification du dossier qui doit répondre, et elle vient en premier.
  perform tests.assert_fails(
    format('insert into public.closure_reports
              (practice_id, patient_id, pathway_id, closure_kind)
            values (%L, %L, %L, ''fin_convenue'')',
           'a1111111-1111-4111-8111-111111111111', v_patient_b, v_parcours_b),
    'Un écrit de fin ne porte pas sur le dossier d''un autre cabinet.');

  /* LE PARCOURS. Celui d'un AUTRE DOSSIER DU MÊME CABINET : le cloisonnement
   * entre cabinets n'y suffit pas, les deux dossiers sont du même côté de la
   * frontière. Sans cette vérification, l'écrit de fin d'un enfant porterait
   * les séances et les objectifs d'un autre. */
  perform tests.assert_fails(
    format('insert into public.closure_reports
              (practice_id, patient_id, pathway_id, closure_kind)
            values (%L, %L, %L, ''fin_convenue'')',
           'a1111111-1111-4111-8111-111111111111',
           'a6000000-0000-4000-8000-000000000001',
           'a7000000-0000-4000-8000-000000000002'),
    'Un écrit de fin ne se rattache pas au parcours d''un autre dossier.');

  -- LE DESTINATAIRE, d'un autre cabinet.
  perform tests.assert_fails(
    format('insert into public.closure_reports
              (practice_id, patient_id, pathway_id, closure_kind,
               delivery_mode, recipient_contact_id)
            values (%L, %L, %L, ''relais'', ''destinataire'', %L)',
           'a1111111-1111-4111-8111-111111111111',
           'a6000000-0000-4000-8000-000000000001',
           'a7000000-0000-4000-8000-000000000001', v_dest_b),
    'Un écrit de fin ne se remet pas au contact d''un autre cabinet.');

  -- LE CONTRE-CONTRÔLE : le bon triplet passe.
  perform tests.assert_affects_rows(
    format('insert into public.closure_reports
              (practice_id, patient_id, pathway_id, closure_kind)
            values (%L, %L, %L, ''fin_convenue'')',
           'a1111111-1111-4111-8111-111111111111',
           'a6000000-0000-4000-8000-000000000001',
           'a7000000-0000-4000-8000-000000000001'),
    1, 'Le bon triplet passe : sans quoi les refus ci-dessus ne prouveraient rien.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  12. Trois champs figés que les autres masquaient
-- ---------------------------------------------------------------------------
--  Le mode de remise, le destinataire et l'épisode ne se vérifiaient pas :
--  toute tentative butait d'abord sur une contrainte de table ou sur la garde
--  de cohérence. Il faut, pour chacun, une modification que rien d'autre ne
--  peut refuser.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_e uuid;
  v_dest uuid;
  v_autre_dest uuid;
  v_second_parcours uuid;
begin
  update public.care_pathways
     set status = 'termine', ended_on = current_date - 3
   where id = 'a7000000-0000-4000-8000-000000000001';

  -- LE MODE DE REMISE, entre deux valeurs qui n'emportent aucun destinataire :
  -- la contrainte d'accord ne peut donc pas répondre à sa place.
  insert into public.closure_reports
    (practice_id, patient_id, pathway_id, closure_kind, observed, delivery_mode)
  values ('a1111111-1111-4111-8111-111111111111',
          'a6000000-0000-4000-8000-000000000001',
          'a7000000-0000-4000-8000-000000000001',
          'fin_convenue', 'Texte.', 'personne_suivie')
  returning id into v_e;
  perform public.issue_closure_report(v_e);
  perform tests.assert_fails(
    format('update public.closure_reports set delivery_mode = ''au_dossier'' where id = %L', v_e),
    'Un écrit remis ne change pas de mode de remise.');

  -- LE DESTINATAIRE, remplacé par un AUTRE contact du même cabinet : la
  -- cohérence l'accepterait, seule l'immuabilité peut refuser.
  select id into v_dest from public.contacts
   where practice_id = 'a1111111-1111-4111-8111-111111111111' limit 1;
  select id into v_autre_dest from public.contacts
   where practice_id = 'a1111111-1111-4111-8111-111111111111'
     and id <> v_dest limit 1;
  insert into public.closure_reports
    (practice_id, patient_id, pathway_id, closure_kind, observed,
     delivery_mode, recipient_contact_id)
  values ('a1111111-1111-4111-8111-111111111111',
          'a6000000-0000-4000-8000-000000000001',
          'a7000000-0000-4000-8000-000000000001',
          'relais', 'Texte.', 'destinataire', v_dest)
  returning id into v_e;
  perform public.issue_closure_report(v_e);
  perform tests.assert_fails(
    format('update public.closure_reports set recipient_contact_id = %L where id = %L',
           v_autre_dest, v_e),
    'Un écrit remis ne change pas de destinataire.');

  /* L'ÉPISODE, remplacé par un second parcours DU MÊME DOSSIER : la garde de
   * cohérence l'accepterait — c'est bien le parcours de ce patient — et seule
   * l'immuabilité peut refuser. C'est aussi le cas réel : une reprise ouvre un
   * nouveau parcours, et rien ne doit permettre d'y rattacher après coup un
   * écrit qui clôt le précédent. */
  insert into public.care_pathways
    (practice_id, patient_id, label, status, started_on)
  values ('a1111111-1111-4111-8111-111111111111',
          'a6000000-0000-4000-8000-000000000001',
          'Reprise fictive', 'actif', current_date - 1)
  returning id into v_second_parcours;
  perform tests.assert_fails(
    format('update public.closure_reports set pathway_id = %L where id = %L',
           v_second_parcours, v_e),
    'Un écrit remis ne change pas d''épisode.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  13. Retirer les objectifs les retire aussi de ce qui est conservé
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare v_e uuid;
begin
  update public.care_pathways
     set status = 'termine', ended_on = current_date - 3
   where id = 'a7000000-0000-4000-8000-000000000001';

  insert into public.closure_reports
    (practice_id, patient_id, pathway_id, closure_kind, observed, detail_objectifs)
  values ('a1111111-1111-4111-8111-111111111111',
          'a6000000-0000-4000-8000-000000000001',
          'a7000000-0000-4000-8000-000000000001',
          'fin_convenue', 'Texte.', false)
  returning id into v_e;
  perform public.issue_closure_report(v_e);
  perform tests.assert_rows(
    format('select 1 from public.closure_reports
             where id = %L and not (snapshot -> ''faits'' ? ''objectifs'')', v_e),
    1, 'Retirés du document, les objectifs ne sont pas même conservés.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  14. Un motif d'annulation ne se pose pas d'avance
-- ---------------------------------------------------------------------------
--  Rien ne l'imprimerait tant que le statut est « remis », mais il resterait
--  là, prêt à être lu comme le motif d'une annulation qui n'a pas eu lieu.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare v_e uuid;
begin
  update public.care_pathways
     set status = 'termine', ended_on = current_date - 3
   where id = 'a7000000-0000-4000-8000-000000000001';
  insert into public.closure_reports
    (practice_id, patient_id, pathway_id, closure_kind, observed)
  values ('a1111111-1111-4111-8111-111111111111',
          'a6000000-0000-4000-8000-000000000001',
          'a7000000-0000-4000-8000-000000000001', 'fin_convenue', 'Texte.')
  returning id into v_e;
  perform public.issue_closure_report(v_e);

  perform tests.assert_fails(
    format('update public.closure_reports set cancellation_reason = ''Posé d''''avance.'' where id = %L', v_e),
    'Un motif d''annulation ne se pose que sur une annulation.');

  -- LE CONTRE-CONTRÔLE : par le bon chemin, il s'écrit.
  perform public.cancel_closure_report(v_e, 'Motif réel.');
  perform tests.assert_rows(
    format('select 1 from public.closure_reports
             where id = %L and cancellation_reason = ''Motif réel.''', v_e),
    1, 'Par la fonction d''annulation, il s''écrit : sans quoi le refus ci-dessus ne prouverait rien.');
end
$$;
rollback;
