-- ============================================================================
--  140 — ÉCRIT POUR UN TIERS NON SOIGNANT
--  Ce qui est vérifié ici : le consentement DÉCIDE, il ne se contente plus
--  d'informer ; un retrait enregistré ne se contourne pas ; rien ne s'imprime
--  qu'elle n'ait demandé ; et destinataire n'est pas destination.
-- ============================================================================
\set ON_ERROR_STOP on

\set alpha    '''a0000000-0000-4000-8000-000000000001'''
\set cab_a    '''a1111111-1111-4111-8111-111111111111'''
\set zephyr   '''a6000000-0000-4000-8000-000000000001'''
\set capucine '''a6000000-0000-4000-8000-000000000002'''
\set parcours '''a7000000-0000-4000-8000-000000000001'''

-- ---------------------------------------------------------------------------
--  1. Le consentement décide — trois états, pas deux
-- ---------------------------------------------------------------------------
--  Sur les rangs 2 à 4, le produit DIT l'accord sans l'exiger. Ce choix
--  reposait sur une présomption qui n'existe pas hors équipe de soins : une
--  école n'en est pas une. Le produit n'ajoute donc aucune condition — il
--  refuse de produire, sans trace d'une décision, un écrit dont toute la
--  raison d'être est qu'un tiers au soin lise une information de santé.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_e uuid;
  v_pat uuid := 'a6000000-0000-4000-8000-000000000002';  -- sans consentement
  v_c uuid;
begin
  perform tests.assert_rows(
    format('select 1 from public.patient_consents where patient_id = %L', v_pat), 0,
    'Le dossier de départ ne porte aucun accord.');

  insert into public.third_party_reports
    (practice_id, patient_id, intended_use, observed)
  values ('a1111111-1111-4111-8111-111111111111', v_pat, 'ecole',
          'En classe, la tenue du crayon se crispe au bout de quelques lignes.')
  returning id into v_e;

  -- RIEN D'ENREGISTRÉ : refus, sauf motif écrit.
  perform tests.assert_fails(
    format('select public.issue_third_party_report(%L)', v_e),
    'Sans accord enregistré ni motif, un écrit ne part pas chez un tiers non soignant.');

  perform tests.assert_fails(
    format('update public.third_party_reports set consent_override_reason = ''  '' where id = %L;
            select public.issue_third_party_report(%L)', v_e, v_e),
    'Des espaces ne sont pas un motif.');

  /* LA DÉROGATION EXISTE, et elle exige d'écrire pourquoi. Elle ne passe pas
   * par une case qu'on coche sans lire. */
  update public.third_party_reports
     set consent_override_reason = 'Demande écrite de la mère, accord oral confirmé en séance.'
   where id = v_e;
  perform public.issue_third_party_report(v_e);
  perform tests.assert_rows(
    format('select 1 from public.third_party_reports where id = %L and status = ''emis''', v_e),
    1, 'Avec un motif écrit, il part : sans quoi les refus ci-dessus ne prouveraient rien.');

  /* ET LE JOURNAL DISTINGUE LES DEUX CHEMINS. Une remise sans accord
   * enregistré n'est pas une remise ordinaire : elle doit se retrouver sans
   * relire chaque pièce. */
  perform tests.assert_rows(
    format('select 1 from public.audit_events
             where subject_id = %L and action = ''third_party_report.issue_without_consent''', v_e),
    1, 'Le journal nomme la remise sans accord pour ce qu''elle est.');

  -- AVEC UN ACCORD DATÉ : la remise est ordinaire.
  insert into public.patient_consents (practice_id, patient_id, kind, granted_on)
  values ('a1111111-1111-4111-8111-111111111111', v_pat,
          'partage_etablissement', current_date - 30)
  returning id into v_c;

  insert into public.third_party_reports
    (practice_id, patient_id, intended_use, observed)
  values ('a1111111-1111-4111-8111-111111111111', v_pat, 'ecole', 'Texte.')
  returning id into v_e;
  perform public.issue_third_party_report(v_e);
  perform tests.assert_rows(
    format('select 1 from public.audit_events
             where subject_id = %L and action = ''third_party_report.issue''', v_e),
    1, 'Avec un accord, c''est une remise ordinaire.');

  /* UN RETRAIT NE SE CONTOURNE PAS. C'est le point : un logiciel où émettre
   * contre un retrait coûte aussi peu qu'émettre avec un accord rend le
   * retrait sans effet — alors que c'est le cabinet qui l'a enregistré. */
  update public.patient_consents set withdrawn_on = current_date where id = v_c;
  insert into public.third_party_reports
    (practice_id, patient_id, intended_use, observed, consent_override_reason)
  values ('a1111111-1111-4111-8111-111111111111', v_pat, 'ecole', 'Texte.',
          'Un motif, qui ne doit rien changer ici.')
  returning id into v_e;
  perform tests.assert_fails(
    format('select public.issue_third_party_report(%L)', v_e),
    'Un retrait enregistré refuse la remise, ET le motif de dérogation n''y change rien.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  2. Rien ne s'imprime qu'elle n'ait demandé — et rien n'est conservé
-- ---------------------------------------------------------------------------
--  Un résultat chiffré lu par un enseignant, des objectifs de prise en soin
--  dans un dossier administratif, le nom du médecin qui a adressé : chacun est
--  une divulgation que le destinataire n'a pas demandée et que la personne n'a
--  pas choisie. Tout est faux par défaut.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare v_e uuid; v_cles text;
begin
  /* LE JEU FICTIF PORTE DÉJÀ UN ACCORD RETIRÉ pour ce dossier — et c'est une
   * bonne mise en scène, qu'on ne retire pas du jeu. On la lève ICI,
   * explicitement, parce que ce bloc-ci n'éprouve pas le refus sur retrait :
   * il l'éprouve ailleurs. Sans cette ligne, tout le reste passerait pour la
   * mauvaise raison. */
  delete from public.patient_consents
   where patient_id = 'a6000000-0000-4000-8000-000000000001'
     and withdrawn_on is not null;
  insert into public.patient_consents (practice_id, patient_id, kind, granted_on)
  values ('a1111111-1111-4111-8111-111111111111',
          'a6000000-0000-4000-8000-000000000001', 'partage_etablissement',
          current_date - 30);

  insert into public.third_party_reports
    (practice_id, patient_id, pathway_id, intended_use, observed)
  values ('a1111111-1111-4111-8111-111111111111',
          'a6000000-0000-4000-8000-000000000001',
          'a7000000-0000-4000-8000-000000000001', 'ecole', 'Texte.')
  returning id into v_e;
  perform public.issue_third_party_report(v_e);

  select string_agg(k, ',' order by k) into v_cles
    from jsonb_object_keys(
      (select snapshot -> 'faits' from public.third_party_reports where id = v_e)) k;
  perform tests.assert_equals(v_cles,
    'derniere_seance_le,premiere_seance_le',
    'Par défaut, l''écrit ne porte que les bornes de l''accompagnement — deux faits, et rien d''autre.');

  -- LE CONTRE-CONTRÔLE : demandés, ils sont là.
  insert into public.third_party_reports
    (practice_id, patient_id, pathway_id, intended_use, observed,
     detail_scores, detail_objectifs, detail_seances, detail_prescripteur)
  values ('a1111111-1111-4111-8111-111111111111',
          'a6000000-0000-4000-8000-000000000001',
          'a7000000-0000-4000-8000-000000000001', 'mdph', 'Texte.',
          true, true, true, true)
  returning id into v_e;
  perform public.issue_third_party_report(v_e);
  select string_agg(k, ',' order by k) into v_cles
    from jsonb_object_keys(
      (select snapshot -> 'faits' from public.third_party_reports where id = v_e)) k;
  perform tests.assert_equals(v_cles,
    'derniere_seance_le,objectifs,premiere_seance_le,prescripteur,seances_honorees',
    'Demandés, ils sont figés : sans quoi le contrôle ci-dessus ne prouverait rien.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  3. L'instantané a une liste close, et rien du dossier n'y entre
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare v_e uuid; v_texte text; v_cles text;
begin
  update public.care_pathways set referral_reason = 'MOTIFSENTINELLE'
   where id = 'a7000000-0000-4000-8000-000000000001';
  insert into public.patient_notes
    (practice_id, patient_id, pathway_id, written_on, body)
  values ('a1111111-1111-4111-8111-111111111111',
          'a6000000-0000-4000-8000-000000000001',
          'a7000000-0000-4000-8000-000000000001',
          current_date - 5, 'NOTECLINIQUESENTINELLE');
  /* LE JEU FICTIF PORTE DÉJÀ UN ACCORD RETIRÉ pour ce dossier — et c'est une
   * bonne mise en scène, qu'on ne retire pas du jeu. On la lève ICI,
   * explicitement, parce que ce bloc-ci n'éprouve pas le refus sur retrait :
   * il l'éprouve ailleurs. Sans cette ligne, tout le reste passerait pour la
   * mauvaise raison. */
  delete from public.patient_consents
   where patient_id = 'a6000000-0000-4000-8000-000000000001'
     and withdrawn_on is not null;
  insert into public.patient_consents (practice_id, patient_id, kind, granted_on)
  values ('a1111111-1111-4111-8111-111111111111',
          'a6000000-0000-4000-8000-000000000001', 'partage_etablissement',
          current_date - 30);

  insert into public.third_party_reports
    (practice_id, patient_id, pathway_id, intended_use, observed,
     internal_note, consent_override_reason)
  values ('a1111111-1111-4111-8111-111111111111',
          'a6000000-0000-4000-8000-000000000001',
          'a7000000-0000-4000-8000-000000000001', 'mdph', 'Texte.',
          'NOTEINTERNESENTINELLE', 'MOTIFDEROGATIONSENTINELLE')
  returning id into v_e;
  perform public.issue_third_party_report(v_e);

  select snapshot::text into v_texte from public.third_party_reports where id = v_e;
  perform tests.assert(v_texte not like '%MOTIFSENTINELLE%',
    'Le motif de la demande est proposé à la reprise, jamais imprimé tel quel.');
  perform tests.assert(v_texte not like '%NOTECLINIQUESENTINELLE%',
    'Aucune note de séance n''entre dans un écrit destiné à un tiers non soignant.');
  perform tests.assert(v_texte not like '%NOTEINTERNESENTINELLE%',
    'La note interne n''est jamais imprimée.');
  /* LE MOTIF DE DÉROGATION NON PLUS. C'est la seule trace de la raison pour
   * laquelle un document est parti sans accord ; elle reste au cabinet. */
  perform tests.assert(v_texte not like '%MOTIFDEROGATIONSENTINELLE%',
    'Le motif de dérogation au consentement reste interne.');

  /* L'ADRESSE DU PATIENT N'Y EST PAS. Elle n'a aucune utilité pour ce lecteur,
   * et c'est une donnée de plus qui circule dans un dossier administratif. */
  select string_agg(k, ',' order by k) into v_cles
    from jsonb_object_keys(
      (select snapshot -> 'patient' from public.third_party_reports where id = v_e)) k;
  perform tests.assert_equals(v_cles, 'ne_le,nom',
    'De la personne, l''écrit ne porte que le nom et la date de naissance.');

  select string_agg(k, ',' order by k) into v_cles
    from jsonb_object_keys((select snapshot from public.third_party_reports where id = v_e)) k;
  perform tests.assert_equals(v_cles,
    'cabinet,consentement_donne_par,consentement_partage,destinataire,emis_le,entite_juridique,faits,identifiants,mentions,patient,praticien,remise,usage',
    'L''instantané a une liste de clés CLOSE.');

  /* QUI A CONSENTI EST FIGÉ, mais le document ne le dit pas : ce n'est
   * l'affaire ni d'une école ni d'un organisme. */
  perform tests.assert(
    v_texte::jsonb -> 'consentement_donne_par' is not null,
    'Qui a donné l''accord est conservé, pour qu''on puisse le dire dans trois ans.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  4. Destinataire n'est pas destination
-- ---------------------------------------------------------------------------
--  Le mode dominant vers un organisme n'est pas l'envoi : c'est « remis à la
--  famille, qui transmet ». Il n'y a alors AUCUN destinataire nommé, et le
--  document doit le dire — c'est vrai, c'est protecteur, et cela répond par
--  avance à « qui a envoyé ça ? ».
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare v_e uuid; v_dest uuid;
begin
  /* LE JEU FICTIF PORTE DÉJÀ UN ACCORD RETIRÉ pour ce dossier — et c'est une
   * bonne mise en scène, qu'on ne retire pas du jeu. On la lève ICI,
   * explicitement, parce que ce bloc-ci n'éprouve pas le refus sur retrait :
   * il l'éprouve ailleurs. Sans cette ligne, tout le reste passerait pour la
   * mauvaise raison. */
  delete from public.patient_consents
   where patient_id = 'a6000000-0000-4000-8000-000000000001'
     and withdrawn_on is not null;
  insert into public.patient_consents (practice_id, patient_id, kind, granted_on)
  values ('a1111111-1111-4111-8111-111111111111',
          'a6000000-0000-4000-8000-000000000001', 'partage_etablissement',
          current_date - 30);
  select id into v_dest from public.contacts
   where practice_id = 'a1111111-1111-4111-8111-111111111111' limit 1;

  insert into public.third_party_reports
    (practice_id, patient_id, intended_use, observed, delivery_mode)
  values ('a1111111-1111-4111-8111-111111111111',
          'a6000000-0000-4000-8000-000000000001', 'mdph', 'Texte.',
          'remis_pour_transmission')
  returning id into v_e;
  perform public.issue_third_party_report(v_e);
  perform tests.assert(
    (select snapshot -> 'mentions' ->> 'remise' from public.third_party_reports where id = v_e)
      like '%adressé directement à aucun organisme%',
    'Un écrit remis pour transmission dit que le cabinet ne l''a envoyé nulle part.');

  -- LA CONTRAINTE D'ACCORD : seul « destinataire » en nomme un.
  perform tests.assert_fails(
    format('insert into public.third_party_reports
              (practice_id, patient_id, intended_use, observed, delivery_mode, recipient_contact_id)
            values (%L, %L, ''ecole'', ''Texte.'', ''remis_pour_transmission'', %L)',
           'a1111111-1111-4111-8111-111111111111',
           'a6000000-0000-4000-8000-000000000001', v_dest),
    'Une remise pour transmission ne nomme pas de destinataire : elle nomme une destination.');
  perform tests.assert_fails(
    format('insert into public.third_party_reports
              (practice_id, patient_id, intended_use, observed, delivery_mode)
            values (%L, %L, ''ecole'', ''Texte.'', ''destinataire'')',
           'a1111111-1111-4111-8111-111111111111',
           'a6000000-0000-4000-8000-000000000001'),
    'Le mode « destinataire » sans destinataire est refusé.');
  perform tests.assert_affects_rows(
    format('insert into public.third_party_reports
              (practice_id, patient_id, intended_use, observed, delivery_mode, recipient_contact_id)
            values (%L, %L, ''ecole'', ''Texte.'', ''destinataire'', %L)',
           'a1111111-1111-4111-8111-111111111111',
           'a6000000-0000-4000-8000-000000000001', v_dest),
    1, 'Les deux ensemble passent : sans quoi les refus ci-dessus ne prouveraient rien.');

  -- Les professionnels ne se nomment que si elle a demandé à les nommer.
  perform tests.assert_fails(
    format('insert into public.third_party_reports
              (practice_id, patient_id, intended_use, observed, professionnels)
            values (%L, %L, ''mdph'', ''Texte.'', ''Une consœur'')',
           'a1111111-1111-4111-8111-111111111111',
           'a6000000-0000-4000-8000-000000000001'),
    'On ne nomme pas les autres professionnels sans avoir demandé à les nommer.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  5. Un écrit remis ne bouge plus
-- ---------------------------------------------------------------------------
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare v_e uuid;
begin
  /* LE JEU FICTIF PORTE DÉJÀ UN ACCORD RETIRÉ pour ce dossier — et c'est une
   * bonne mise en scène, qu'on ne retire pas du jeu. On la lève ICI,
   * explicitement, parce que ce bloc-ci n'éprouve pas le refus sur retrait :
   * il l'éprouve ailleurs. Sans cette ligne, tout le reste passerait pour la
   * mauvaise raison. */
  delete from public.patient_consents
   where patient_id = 'a6000000-0000-4000-8000-000000000001'
     and withdrawn_on is not null;
  insert into public.patient_consents (practice_id, patient_id, kind, granted_on)
  values ('a1111111-1111-4111-8111-111111111111',
          'a6000000-0000-4000-8000-000000000001', 'partage_etablissement',
          current_date - 30);
  insert into public.third_party_reports
    (practice_id, patient_id, intended_use, observed, consent_override_reason)
  values ('a1111111-1111-4111-8111-111111111111',
          'a6000000-0000-4000-8000-000000000001', 'ecole', 'Texte.',
          'Un motif écrit avant que l''accord ne soit enregistré.')
  returning id into v_e;
  perform public.issue_third_party_report(v_e);

  perform tests.assert_fails(
    format('update public.third_party_reports set observed = ''Autre.'' where id = %L', v_e),
    'Un écrit remis ne se réécrit pas.');
  perform tests.assert_fails(
    format('update public.third_party_reports set intended_use = ''mdph'' where id = %L', v_e),
    'Un écrit remis ne change pas d''usage déclaré : c''est lui qui commande son cadrage.');
  perform tests.assert_fails(
    format('update public.third_party_reports set delivery_mode = ''au_dossier'' where id = %L', v_e),
    'Ni de mode de remise.');
  perform tests.assert_fails(
    format('update public.third_party_reports set detail_scores = true where id = %L', v_e),
    'On n''ajoute pas des chiffres après coup.');
  perform tests.assert_fails(
    format('update public.third_party_reports set detail_objectifs = true where id = %L', v_e),
    'Ni les objectifs.');
  perform tests.assert_fails(
    format('update public.third_party_reports set detail_seances = true where id = %L', v_e),
    'Ni les comptes de séances.');
  perform tests.assert_fails(
    format('update public.third_party_reports set detail_prescripteur = true where id = %L', v_e),
    'Ni le prescripteur.');
  perform tests.assert_fails(
    format('update public.third_party_reports set detail_professionnels = true where id = %L', v_e),
    'Ni les autres professionnels.');
  perform tests.assert_fails(
    format('update public.third_party_reports set observation_setting = ''Ailleurs.'' where id = %L', v_e),
    'Les conditions d''observation ne se réécrivent pas : c''est ce qui situe tout le reste.');
  perform tests.assert_fails(
    format('update public.third_party_reports set daily_impact = ''Autre.'' where id = %L', v_e),
    'Le retentissement non plus.');
  perform tests.assert_fails(
    format('update public.third_party_reports set what_helps = ''Autre.'' where id = %L', v_e),
    'Ce qui aide non plus.');
  perform tests.assert_fails(
    format('update public.third_party_reports set proposals = ''Autre.'' where id = %L', v_e),
    'Les propositions non plus.');
  perform tests.assert_fails(
    format('update public.third_party_reports set limits_note = ''Autre.'' where id = %L', v_e),
    'La limite ajoutée au cadrage non plus.');
  perform tests.assert_fails(
    format('update public.third_party_reports set context = ''Autre.'' where id = %L', v_e),
    'Le contexte de la demande non plus.');
  perform tests.assert_fails(
    format('update public.third_party_reports set note = ''Autre.'' where id = %L', v_e),
    'La mention imprimée non plus.');
  perform tests.assert_fails(
    format('update public.third_party_reports set professionnels = ''Quelqu''''un'' where id = %L', v_e),
    'Ni les professionnels nommés.');
  perform tests.assert_fails(
    format('update public.third_party_reports set patient_id = %L where id = %L',
           'a6000000-0000-4000-8000-000000000002', v_e),
    'Un écrit remis ne change pas de dossier.');
  perform tests.assert_fails(
    format('update public.third_party_reports set pathway_id = %L where id = %L',
           'a7000000-0000-4000-8000-000000000001', v_e),
    'Ni de parcours.');
  perform tests.assert_fails(
    format('update public.third_party_reports set issued_on = date ''2020-01-01'' where id = %L', v_e),
    'Ni de date.');
  perform tests.assert_fails(
    format('update public.third_party_reports set issued_by = null where id = %L', v_e),
    'On ne réécrit pas qui a signé.');
  perform tests.assert_fails(
    format('update public.third_party_reports set created_by = null where id = %L', v_e),
    'Ni qui a rédigé.');
  perform tests.assert_fails(
    format('update public.third_party_reports set created_at = now() + interval ''1 hour'' where id = %L', v_e),
    'Ni quand il a été créé.');
  /* LE MOTIF DE DÉROGATION EST FIGÉ LUI AUSSI : c'est la seule trace de la
   * raison pour laquelle un document est parti sans accord enregistré. */
  perform tests.assert_fails(
    format('update public.third_party_reports set consent_override_reason = ''Une autre raison.'' where id = %L', v_e),
    'On ne se donne pas après coup une autre raison d''avoir remis sans accord.');
  perform tests.assert_fails(
    format('update public.third_party_reports
              set snapshot = jsonb_set(snapshot, ''{usage}'', ''"mdph"'')
            where id = %L', v_e),
    'L''instantané ne se réécrit pas.');
  perform tests.assert_fails(
    format('delete from public.third_party_reports where id = %L', v_e),
    'Un écrit remis ne se supprime pas.');

  perform tests.assert_affects_rows(
    format('update public.third_party_reports set internal_note = ''Relancer.'' where id = %L', v_e),
    1, 'Une note interne s''ajoute après la remise : elle n''est pas partie.');

  perform tests.assert_fails(
    format('select public.cancel_third_party_report(%L, ''  '')', v_e),
    'Une annulation sans motif est refusée.');
  perform public.cancel_third_party_report(v_e, 'Erreur de destinataire.');
  perform tests.assert_fails(
    format('update public.third_party_reports set status = ''emis'' where id = %L', v_e),
    'Une annulation ne se défait pas.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  6. Ce qui ne peut pas être écrit, et ce que l'assistant ne lit pas
-- ---------------------------------------------------------------------------
begin;
do $$
declare
  v_patient_b uuid;
  v_dest_b uuid;
  v_reel text;
  v_faux text;
  v_inexistant uuid := '00000000-0000-4000-8000-00000000dead';
begin
  perform tests.authenticate_as('b0000000-0000-4000-8000-000000000001'::uuid);
  select id into v_patient_b from public.patients
   where practice_id = 'b1111111-1111-4111-8111-111111111111' limit 1;
  select id into v_dest_b from public.contacts
   where practice_id = 'b1111111-1111-4111-8111-111111111111' limit 1;

  -- LE REFUS EST LE MÊME, que la ressource existe ailleurs ou n'existe pas.
  begin
    insert into public.third_party_reports
      (practice_id, patient_id, intended_use, observed)
    values ('a1111111-1111-4111-8111-111111111111',
            'a6000000-0000-4000-8000-000000000001', 'ecole', 'Texte.');
    v_reel := 'AUCUN REFUS';
  exception when others then v_reel := sqlstate || ' ' || sqlerrm;
  end;
  begin
    insert into public.third_party_reports
      (practice_id, patient_id, intended_use, observed)
    values ('a1111111-1111-4111-8111-111111111111', v_inexistant, 'ecole', 'Texte.');
    v_faux := 'AUCUN REFUS';
  exception when others then v_faux := sqlstate || ' ' || sqlerrm;
  end;
  perform tests.assert_equals(v_reel, v_faux,
    'Un dossier RÉEL d''un autre cabinet et un dossier INEXISTANT sont refusés de la même façon.');
  perform tests.assert(v_reel <> 'AUCUN REFUS',
    'Et les deux sont bien refusés.');

  reset role;
  perform tests.authenticate_as('a0000000-0000-4000-8000-000000000001'::uuid);
  perform tests.assert_fails(
    format('insert into public.third_party_reports
              (practice_id, patient_id, intended_use, observed,
               delivery_mode, recipient_contact_id)
            values (%L, %L, ''ecole'', ''Texte.'', ''destinataire'', %L)',
           'a1111111-1111-4111-8111-111111111111',
           'a6000000-0000-4000-8000-000000000001', v_dest_b),
    'Un écrit ne se remet pas au contact d''un autre cabinet.');
  perform tests.assert_fails(
    format('insert into public.third_party_reports
              (practice_id, patient_id, pathway_id, intended_use, observed)
            values (%L, %L, %L, ''ecole'', ''Texte.'')',
           'a1111111-1111-4111-8111-111111111111',
           'a6000000-0000-4000-8000-000000000001',
           'a7000000-0000-4000-8000-000000000002'),
    'Un écrit ne se rattache pas au parcours d''un autre dossier.');
end
$$;
rollback;

begin;
do $$
begin
  insert into auth.users (id, email)
  values ('a0000000-0000-4000-8000-0000000000d9', 'assistant-tiers@exemple-fictif.test')
  on conflict (id) do nothing;
  insert into public.practice_members (practice_id, user_id, role, status)
  values ('a1111111-1111-4111-8111-111111111111',
          'a0000000-0000-4000-8000-0000000000d9', 'assistant', 'active');

  perform tests.authenticate_as('a0000000-0000-4000-8000-000000000001'::uuid);
  insert into public.third_party_reports
    (practice_id, patient_id, intended_use, observed)
  values ('a1111111-1111-4111-8111-111111111111',
          'a6000000-0000-4000-8000-000000000001', 'ecole', 'Texte clinique.');

  reset role;
  perform tests.authenticate_as('a0000000-0000-4000-8000-0000000000d9'::uuid);
  perform tests.assert_rows('select 1 from public.third_party_reports', 0,
    'Un assistant ne lit pas les écrits destinés à un tiers.');
  perform tests.assert_fails(
    'select public.third_party_report_facts(
       ''a6000000-0000-4000-8000-000000000001'', null)',
    'Ni les faits, qui portent les objectifs.');

  reset role;
  perform tests.authenticate_as('a0000000-0000-4000-8000-000000000001'::uuid);
  perform tests.assert_rows('select 1 from public.third_party_reports', 1,
    'La praticienne les lit : sans quoi les refus ci-dessus ne prouveraient rien.');

  reset role;
  perform tests.authenticate_as('b0000000-0000-4000-8000-000000000001'::uuid);
  perform tests.assert_rows('select 1 from public.third_party_reports', 0,
    'Le cabinet voisin ne voit aucun écrit.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  7. L'écran voit ce que la remise refusera, AVANT de le refuser
-- ---------------------------------------------------------------------------
--  Un refus au moment de remettre, sur un écrit déjà rédigé, est un refus qui
--  arrive trop tard. Les faits portent donc l'état de l'accord — et cette clé
--  est retirée de l'instantané, puisqu'elle ne regarde pas le destinataire.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare v_f jsonb; v_e uuid;
begin
  v_f := public.third_party_report_facts(
    'a6000000-0000-4000-8000-000000000001',
    'a7000000-0000-4000-8000-000000000001');
  perform tests.assert(v_f ? 'accord_partage',
    'L''écran voit l''état de l''accord avant de rédiger.');
  perform tests.assert(v_f ? 'honorees_hors_parcours',
    'Et le nombre de séances du dossier hors du parcours retenu : un écrit qui dirait « suivie depuis mars » quand le dossier en porte deux ans serait faux.');

  /* LE JEU FICTIF PORTE DÉJÀ UN ACCORD RETIRÉ pour ce dossier — et c'est une
   * bonne mise en scène, qu'on ne retire pas du jeu. On la lève ICI,
   * explicitement, parce que ce bloc-ci n'éprouve pas le refus sur retrait :
   * il l'éprouve ailleurs. Sans cette ligne, tout le reste passerait pour la
   * mauvaise raison. */
  delete from public.patient_consents
   where patient_id = 'a6000000-0000-4000-8000-000000000001'
     and withdrawn_on is not null;
  insert into public.patient_consents (practice_id, patient_id, kind, granted_on)
  values ('a1111111-1111-4111-8111-111111111111',
          'a6000000-0000-4000-8000-000000000001', 'partage_etablissement',
          current_date - 30);
  insert into public.third_party_reports
    (practice_id, patient_id, pathway_id, intended_use, observed)
  values ('a1111111-1111-4111-8111-111111111111',
          'a6000000-0000-4000-8000-000000000001',
          'a7000000-0000-4000-8000-000000000001', 'ecole', 'Texte.')
  returning id into v_e;
  perform public.issue_third_party_report(v_e);
  perform tests.assert_rows(
    format('select 1 from public.third_party_reports
             where id = %L and not (snapshot -> ''faits'' ? ''accord_partage'')', v_e),
    1, 'Mais l''avertissement d''écran ne part pas avec le document.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  8. Chaque refus, ISOLÉ de ceux qui le masquaient
-- ---------------------------------------------------------------------------
--  Écrits ensemble sur un même cas, ces refus se recouvrent : le premier
--  répond, et les suivants ne sont jamais atteints. Mesuré en désarmant —
--  six d'entre eux ne faisaient échouer aucun contrôle.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare
  v_e uuid;
  v_pat uuid := 'a6000000-0000-4000-8000-000000000002';
  v_patient_b uuid;
  v_c uuid;
begin
  /* LE DOSSIER D'UN AUTRE CABINET, vu depuis le NÔTRE. En s'authentifiant
   * comme le cabinet voisin, c'est la RLS qui refusait — et le contrôle
   * constatait un refus sans jamais atteindre la garde du dossier. */
  reset role;
  perform tests.authenticate_as('b0000000-0000-4000-8000-000000000001'::uuid);
  select id into v_patient_b from public.patients
   where practice_id = 'b1111111-1111-4111-8111-111111111111' limit 1;
  reset role;
  perform tests.authenticate_as('a0000000-0000-4000-8000-000000000001'::uuid);
  perform tests.assert_fails(
    format('insert into public.third_party_reports
              (practice_id, patient_id, intended_use, observed)
            values (%L, %L, ''ecole'', ''Texte.'')',
           'a1111111-1111-4111-8111-111111111111', v_patient_b),
    'Un écrit ne porte pas sur le dossier d''un autre cabinet.');

  /* SANS TEXTE, AVEC UN ACCORD. Sans l'accord, c'est le consentement qui
   * refusait en premier et le contrôle ne prouvait rien de l'observation. */
  insert into public.patient_consents (practice_id, patient_id, kind, granted_on)
  values ('a1111111-1111-4111-8111-111111111111', v_pat,
          'partage_etablissement', current_date - 30)
  returning id into v_c;
  insert into public.third_party_reports
    (practice_id, patient_id, intended_use)
  values ('a1111111-1111-4111-8111-111111111111', v_pat, 'ecole')
  returning id into v_e;
  perform tests.assert_fails(
    format('select public.issue_third_party_report(%L)', v_e),
    'Un écrit qui ne dit rien de ce qu''on observe n''a rien à transmettre.');

  -- LA DATE, sur un écrit par ailleurs complet.
  update public.third_party_reports set observed = 'Texte.' where id = v_e;
  perform tests.assert_fails(
    format('select public.issue_third_party_report(%L, current_date + 1)', v_e),
    'Un écrit ne se date pas du futur.');

  /* UN ACCORD SANS DATE D'ACCORD n'est pas un accord : c'est une ligne
   * préparée. On retire l'accord daté et on ne laisse que celle-là. */
  delete from public.patient_consents where id = v_c;
  insert into public.patient_consents (practice_id, patient_id, kind)
  values ('a1111111-1111-4111-8111-111111111111', v_pat, 'partage_etablissement');
  perform tests.assert_fails(
    format('select public.issue_third_party_report(%L)', v_e),
    'Un accord sans date d''accord ne dispense pas d''écrire pourquoi on remet.');

  -- LE CONTRE-CONTRÔLE : daté, il dispense.
  update public.patient_consents set granted_on = current_date - 10
   where patient_id = v_pat;
  perform public.issue_third_party_report(v_e);
  perform tests.assert_rows(
    format('select 1 from public.third_party_reports where id = %L and status = ''emis''', v_e),
    1, 'Un accord daté suffit : sans quoi les refus ci-dessus ne prouveraient rien.');

  -- LE MOTIF D'ANNULATION NE SE POSE PAS D'AVANCE.
  perform tests.assert_fails(
    format('update public.third_party_reports set cancellation_reason = ''Posé d''''avance.'' where id = %L', v_e),
    'Un motif d''annulation ne se pose que sur une annulation.');
  perform public.cancel_third_party_report(v_e, 'Motif réel.');
  perform tests.assert_rows(
    format('select 1 from public.third_party_reports
             where id = %L and cancellation_reason = ''Motif réel.''', v_e),
    1, 'Par la fonction d''annulation, il s''écrit.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  9. Le parcours des FAITS doit être celui du dossier
-- ---------------------------------------------------------------------------
--  Le cloisonnement entre cabinets n'y suffit pas : deux dossiers du même
--  cabinet sont du même côté de la frontière. Sans cette vérification, un
--  écrit destiné à une école porterait les objectifs d'un autre enfant.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
begin
  perform tests.assert_fails(
    'select public.third_party_report_facts(
       ''a6000000-0000-4000-8000-000000000001'',
       ''a7000000-0000-4000-8000-000000000002'')',
    'Le parcours d''un autre dossier du même cabinet ne nourrit pas cet écrit.');

  perform tests.assert(
    public.third_party_report_facts(
      'a6000000-0000-4000-8000-000000000002',
      'a7000000-0000-4000-8000-000000000002') is not null,
    'Le bon couple, lui, est accepté : sans quoi le refus ci-dessus ne prouverait rien.');
end
$$;
rollback;

-- ---------------------------------------------------------------------------
--  10. Deux champs figés que les contraintes de table masquaient
-- ---------------------------------------------------------------------------
--  Changer le destinataire seul viole l'accord destinataire/mode ; nommer un
--  professionnel sans avoir demandé à les nommer viole l'autre contrainte. Il
--  faut, pour chacun, une modification que rien d'autre ne peut refuser.
begin;
select tests.authenticate_as(:alpha::uuid);
do $$
declare v_e uuid; v_dest uuid; v_autre uuid;
begin
  delete from public.patient_consents
   where patient_id = 'a6000000-0000-4000-8000-000000000001'
     and withdrawn_on is not null;
  insert into public.patient_consents (practice_id, patient_id, kind, granted_on)
  values ('a1111111-1111-4111-8111-111111111111',
          'a6000000-0000-4000-8000-000000000001', 'partage_etablissement',
          current_date - 30);

  select id into v_dest from public.contacts
   where practice_id = 'a1111111-1111-4111-8111-111111111111' limit 1;
  select id into v_autre from public.contacts
   where practice_id = 'a1111111-1111-4111-8111-111111111111'
     and id <> v_dest limit 1;

  -- Un écrit adressé à un tiers NOMMÉ, et qui nomme des professionnels.
  insert into public.third_party_reports
    (practice_id, patient_id, intended_use, observed,
     delivery_mode, recipient_contact_id,
     detail_professionnels, professionnels)
  values ('a1111111-1111-4111-8111-111111111111',
          'a6000000-0000-4000-8000-000000000001', 'mdph', 'Texte.',
          'destinataire', v_dest, true, 'Une consœur orthophoniste')
  returning id into v_e;
  perform public.issue_third_party_report(v_e);

  /* UN AUTRE contact, pas le même : réaffecter la même valeur ne modifie rien,
   * et le contrôle constaterait un succès sans rien prouver. */
  perform tests.assert_fails(
    format('update public.third_party_reports set recipient_contact_id = %L where id = %L',
           v_autre, v_e),
    'Un écrit remis ne change pas de destinataire.');
  perform tests.assert_fails(
    format('update public.third_party_reports set professionnels = ''Quelqu''''un d''''autre'' where id = %L', v_e),
    'Ni les professionnels qu''il nomme.');
end
$$;
rollback;
