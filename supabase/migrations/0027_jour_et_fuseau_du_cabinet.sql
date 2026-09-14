-- ============================================================================
--  0027 — LE JOUR ET LE FUSEAU DU CABINET, PARTOUT OÙ LA BASE DATE
-- ============================================================================
--
--  CE QUE `0026` AVAIT LAISSÉ. La signature d'une attestation se datait déjà au
--  jour du cabinet. Le reste de la base datait encore par `current_date`, qui
--  se calcule dans le fuseau de la SESSION — et la base de production tourne
--  en UTC (mesuré le 2026-09-14). Entre minuit et une heure du matin l'hiver,
--  deux heures l'été, c'était encore la veille pour elle :
--
--   · les quatre écrits cliniques (`0022` à `0025`) prenaient la veille quand
--     aucune date n'était fournie, et refusaient le jour du cabinet comme
--     « futur » ; une synthèse dont la période finit ce jour-là, un écrit de
--     fin sur un parcours clos ce jour-là, étaient refusés ;
--   · une note ou un règlement enregistrés sans date prenaient la veille ;
--   · une pièce comptable émise sans date prenait la veille — et la nuit du
--     1er janvier, sa série se calculait sur l'année close ;
--   · archiver un dossier clôturait ses parcours à la veille, ce que
--     `care_pathways_periode_ck` REFUSE pour un parcours ouvert le jour même :
--     l'archivage échouait ;
--   · un découpage de bandes activé sans date de validation prenait la veille.
--
--  ET UN FUSEAU FIGÉ. `realised_sessions`, `follow_up_facts` et
--  `issue_attestation` lisaient le jour d'une séance à l'heure de Paris, sans
--  consulter `practices.timezone`. Aucun cabinet n'en porte un autre
--  aujourd'hui ; mais pour un cabinet aux Antilles, six heures derrière Paris
--  l'été, une séance commencée après 18 heures aurait été comptée au lendemain.
--
--  UNE SEULE RÈGLE DE FUSEAU. `app.fuseau_utilisable` : absent, vide ou
--  illisible, le fuseau vaut `'Europe/Paris'`, le défaut de la colonne. C'est
--  la règle de `fuseauUtilisable` (`lib/dateCivile.ts`), à une réserve près :
--  chaque moteur juge un nom avec sa propre base de fuseaux, et PostgreSQL en
--  accepte que le navigateur refuse (`'UTC+3'`, `'+05:00'`). Aucun écran ne
--  permet de saisir ce fuseau. La règle est appliquée UNE FOIS, à l'écriture du
--  cabinet, dans `practices.effective_timezone` ; tout ce qui date le lit.
--
--  UNE FONCTION « IMMUABLE » NE LIT PAS L'HORLOGE. `app.effective_licence_status`
--  était déclarée `immutable` et lisait `current_date`. Le planificateur est en
--  droit de pré-calculer une fonction immuable : son résultat pouvait se figer.
--  Le jour devient un paramètre, et la fonction devient réellement immuable.
--
--  COMPATIBLE AVEC L'APPLICATION DÉPLOYÉE. Pour un cabinet à l'est d'UTC — tout
--  cabinet en France métropolitaine —, le jour du cabinet n'est jamais antérieur
--  à celui d'une session UTC : aucune garde ne devient plus stricte, rien de ce
--  qui était accepté ne devient refusé. Et le fuseau lu valant `'Europe/Paris'`
--  pour les cabinets existants, vues et relevés rendent les mêmes dates.
--
--  CE QUI N'EST PAS RÉÉCRIT. Les dates déjà enregistrées restent ce qu'elles
--  sont : une pièce émise est figée. Les reprises de la v1 (`0003`, `0011`,
--  `0012`) datent elles aussi dans le fuseau de la session ; exécutées une seule
--  fois, elles ne sont pas reprises ici — les réécrire ne changerait rien à ce
--  qu'elles ont produit.
--
--  LES DROITS NE SONT PAS RE-DÉCLARÉS pour les fonctions remplacées :
--  `create or replace` conserve ceux de la version précédente. Contrôlé en
--  comparant les droits de chaque fonction avant et après application.
--
--  CONTRÔLÉ PAR `supabase/tests/160_jour_et_fuseau_du_cabinet.sql`, qui fait
--  varier le fuseau de la session ET celui du cabinet ; falsifié par
--  `supabase/falsifications/0027_jour_et_fuseau_du_cabinet.json`.
-- ============================================================================

-- ============================================================================
--  1. UNE SEULE RÈGLE DE FUSEAU, APPLIQUÉE À L'ÉCRITURE
-- ============================================================================

/**
 * Un fuseau utilisable : absent, vide ou illisible, `'Europe/Paris'`.
 *
 * IMMUABLE, et c'est exact. Son résultat ne dépend que de la chaîne reçue et de
 * la base des fuseaux du serveur — que PostgreSQL tient lui-même pour immuable :
 * `timezone(text, timestamptz)` l'est. La validité se sonde sur un instant FIXE,
 * pas sur `now()`. C'est ce qui permet de la calculer dans une colonne générée.
 *
 * Ouverte aux membres authentifiés : la colonne générée se recalcule sous les
 * droits de celui qui modifie la fiche du cabinet.
 */
create or replace function app.fuseau_utilisable(p_fuseau text)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_fuseau text := nullif(btrim(p_fuseau), '');
begin
  if v_fuseau is null then
    return 'Europe/Paris';
  end if;
  perform timestamptz '2000-01-01 00:00:00+00' at time zone v_fuseau;
  return v_fuseau;
exception when invalid_parameter_value then
  return 'Europe/Paris';
end;
$$;

revoke all on function app.fuseau_utilisable(text) from public, anon;
grant execute on function app.fuseau_utilisable(text) to authenticated;

/**
 * LE FUSEAU EFFECTIF DU CABINET, calculé une fois à l'écriture.
 *
 * Évaluée à la lecture, la règle coûtait un appel PAR SÉANCE : 7 072 appels
 * pour lire les 2 264 séances d'un cabinet du jeu volumineux, et un filtre par
 * jour neuf fois plus lent. La placer du côté externe d'une jointure ne la
 * faisait évaluer qu'une fois par cabinet — sur la grande base seulement : sur
 * une petite, le planificateur relisait le cabinet pour chaque séance. Une
 * propriété qui dépend du plan choisi n'est pas une garantie. Calculée ici,
 * elle ne coûte plus rien à la lecture, quel que soit le plan.
 *
 * `timezone` garde la saisie telle quelle : une valeur illisible reste visible
 * pour qui voudrait la corriger, au lieu d'être réécrite en silence.
 */
alter table public.practices
  add column effective_timezone text
  generated always as (app.fuseau_utilisable(timezone)) stored;

/**
 * Le fuseau d'un cabinet, par son identifiant. Non exposée, comme
 * `jour_du_cabinet` : seules des fonctions du cabinet l'appellent, sous leurs
 * propres droits.
 */
create or replace function app.fuseau_du_cabinet(p_practice_id uuid)
returns text
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_fuseau text;
begin
  select pr.effective_timezone into v_fuseau from public.practices pr where pr.id = p_practice_id;
  return coalesce(v_fuseau, app.fuseau_utilisable(null));
end;
$$;

revoke all on function app.fuseau_du_cabinet(uuid) from public, anon, authenticated;

/** Le jour civil du cabinet (`0026`), sur la règle unique. */
create or replace function app.jour_du_cabinet(p_practice_id uuid)
returns date
language plpgsql
stable
set search_path = public, pg_temp
as $$
begin
  return (now() at time zone app.fuseau_du_cabinet(p_practice_id))::date;
end;
$$;

-- ============================================================================
--  2. LES QUATRE ÉCRITS CLINIQUES
-- ============================================================================
--  Leur interface ne transmet pas de date d'émission : c'est le DÉFAUT qui
--  datait chaque écrit remis dans la fenêtre. Les gardes, elles, refusaient une
--  période ou une clôture qui finissait le jour même.

create or replace function public.issue_liaison_letter(
  p_letter_id uuid,
  p_issued_on date default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  l record;
  v_membre uuid;
  v_emission date;
  v_aujourdhui date;
begin
  select * into l from public.liaison_letters where id = p_letter_id;
  if l.id is null or not app.is_member(l.practice_id) then
    raise exception 'Courrier introuvable.' using errcode = 'no_data_found';
  end if;
  if not app.can_write(l.practice_id) then
    raise exception 'Votre rôle ne permet pas d''émettre un courrier.'
      using errcode = 'insufficient_privilege';
  end if;
  if l.status <> 'brouillon' then
    raise exception 'Ce courrier est déjà remis.' using errcode = 'check_violation';
  end if;

  /* LE JOUR DU CABINET, PAS CELUI DE LA SESSION DE LA BASE (`0027`). */
  v_aujourdhui := app.jour_du_cabinet(l.practice_id);
  v_emission := coalesce(p_issued_on, v_aujourdhui);
  if v_emission > v_aujourdhui then
    raise exception 'Un courrier ne se date pas du futur.'
      using errcode = 'check_violation';
  end if;

  select m.id into v_membre from public.practice_members m
   where m.practice_id = l.practice_id
     and m.user_id = app.current_user_id()
     and m.status = 'active'
   limit 1;

  update public.liaison_letters
     set status = 'emis',
         issued_on = v_emission,
         issued_by = app.current_user_id(),
         snapshot = jsonb_build_object(
           'emis_le', v_emission,
           'cabinet', (select jsonb_build_object('nom', p.name)
                         from public.practices p where p.id = l.practice_id),
           'entite_juridique', (select jsonb_build_object(
               'denomination', le.legal_name, 'forme', le.legal_form,
               'adresse', le.address_line1, 'code_postal', le.postal_code,
               'ville', le.city)
             from public.legal_entities le
             where le.practice_id = l.practice_id limit 1),
           'praticien', (select jsonb_build_object(
               'nom', pr.display_name, 'titre', pr.diploma_title)
             from public.practitioner_profiles pr where pr.member_id = v_membre),
           'identifiants', (select jsonb_agg(
               jsonb_build_object('type', pi.kind, 'valeur', pi.value))
             from public.professional_identifiers pi
             left join public.practitioner_profiles pr
               on pr.id = pi.practitioner_profile_id
             where pi.practice_id = l.practice_id
               and pi.kind in ('rpps', 'adeli', 'siret')
               and (pr.member_id is null or pr.member_id = v_membre)
               and (pi.valid_from is null or pi.valid_from <= v_emission)
               and (pi.valid_to is null or pi.valid_to >= v_emission)),

           /* LE PATIENT : nom et date de naissance. Un confrère doit pouvoir
            * identifier la personne sans ambiguïté — deux homonymes existent.
            * Rien d'autre du dossier n'entre ici : ce que le courrier dit du
            * patient, c'est ce qu'ELLE a écrit dans le corps. */
           'patient', (select jsonb_build_object(
               'nom', btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')),
               'ne_le', p.birth_date)
             from public.patients p where p.id = l.patient_id),

           'destinataire', (select jsonb_build_object(
               'nom', coalesce(c.organisation_name,
                       btrim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, ''))),
               'profession', c.profession,
               'adresse', c.address_line1, 'code_postal', c.postal_code,
               'ville', c.city)
             from public.contacts c where c.id = l.recipient_contact_id))
   where id = p_letter_id;

  perform public.log_audit_event(
    l.practice_id, 'liaison_letter.issue', 'liaison_letter', p_letter_id,
    jsonb_build_object('emis_le', v_emission));

  return p_letter_id;
end;
$$;

create or replace function public.issue_follow_up_summary(
  p_summary_id uuid,
  p_issued_on date default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  s record;
  v_membre uuid;
  v_emission date;
  v_aujourdhui date;
begin
  select * into s from public.follow_up_summaries where id = p_summary_id;
  if s.id is null or not app.is_member(s.practice_id) then
    raise exception 'Synthèse introuvable.' using errcode = 'no_data_found';
  end if;
  if not app.can_write(s.practice_id) then
    raise exception 'Votre rôle ne permet pas de remettre une synthèse.'
      using errcode = 'insufficient_privilege';
  end if;
  if s.status <> 'brouillon' then
    raise exception 'Cette synthèse est déjà remise.' using errcode = 'check_violation';
  end if;

  /* UNE SYNTHÈSE SANS TEXTE N'EST PAS UNE SYNTHÈSE. Les faits, à eux seuls,
   * sont un relevé : ce qui en fait un écrit clinique, c'est ce qu'elle en
   * dit. Refuser ici évite qu'un document ne parte en ne portant que des
   * comptes, sous une signature. */
  if btrim(coalesce(s.observed_evolution, '')) = '' then
    raise exception
      'Cette synthèse ne dit rien de ce que vous observez : les comptes seuls ne font pas un compte rendu.'
      using errcode = 'check_violation';
  end if;

  /* LE JOUR DU CABINET, PAS CELUI DE LA SESSION DE LA BASE (`0027`). */
  v_aujourdhui := app.jour_du_cabinet(s.practice_id);
  v_emission := coalesce(p_issued_on, v_aujourdhui);
  if v_emission > v_aujourdhui then
    raise exception 'Une synthèse ne se date pas du futur.'
      using errcode = 'check_violation';
  end if;
  if s.period_end > v_aujourdhui then
    raise exception
      'La période couverte se termine dans le futur : on ne rend pas compte de ce qui n''a pas eu lieu.'
      using errcode = 'check_violation';
  end if;

  select m.id into v_membre from public.practice_members m
   where m.practice_id = s.practice_id
     and m.user_id = app.current_user_id()
     and m.status = 'active'
   limit 1;

  update public.follow_up_summaries
     set status = 'emis',
         issued_on = v_emission,
         issued_by = app.current_user_id(),
         -- Un brouillon a pu porter un motif d'annulation ; il n'a plus de
         -- sens sur une pièce qu'on remet.
         cancellation_reason = null,
         snapshot = jsonb_build_object(
           'emis_le', v_emission,
           'periode', jsonb_build_object('du', s.period_start, 'au', s.period_end),
           'cabinet', (select jsonb_build_object('nom', p.name)
                         from public.practices p where p.id = s.practice_id),
           'entite_juridique', (select jsonb_build_object(
               'denomination', le.legal_name, 'forme', le.legal_form,
               'adresse', le.address_line1, 'code_postal', le.postal_code,
               'ville', le.city)
             from public.legal_entities le
             where le.practice_id = s.practice_id limit 1),
           'praticien', (select jsonb_build_object(
               'nom', pr.display_name, 'titre', pr.diploma_title)
             from public.practitioner_profiles pr where pr.member_id = v_membre),
           'identifiants', (select jsonb_agg(
               jsonb_build_object('type', pi.kind, 'valeur', pi.value))
             from public.professional_identifiers pi
             left join public.practitioner_profiles pr
               on pr.id = pi.practitioner_profile_id
             where pi.practice_id = s.practice_id
               and pi.kind in ('rpps', 'adeli', 'siret')
               and (pr.member_id is null or pr.member_id = v_membre)
               and (pi.valid_from is null or pi.valid_from <= v_emission)
               and (pi.valid_to is null or pi.valid_to >= v_emission)),
           'patient', (select jsonb_build_object(
               'nom', btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')),
               'ne_le', p.birth_date)
             from public.patients p where p.id = s.patient_id),
           'destinataire', (select jsonb_build_object(
               'nom', coalesce(c.organisation_name,
                       btrim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, ''))),
               'profession', c.profession,
               'adresse', c.address_line1, 'code_postal', c.postal_code,
               'ville', c.city,
               /* CE QU'IL EST POUR CE DOSSIER, figé avec le reste. Sans cela,
                * trois ans plus tard, le document ne permet pas de dire s'il
                * est parti chez un médecin, une école ou un financeur — et
                * c'est la première chose qu'on demandera. `aucun` est une
                * réponse, pas un vide : la liste propose aussi les contacts du
                * cabinet non rattachés à ce dossier. */
               'role_au_dossier', coalesce((
                 select pc.role from public.patient_contacts pc
                  where pc.contact_id = c.id and pc.patient_id = s.patient_id
                  limit 1), 'aucun'))
             from public.contacts c where c.id = s.recipient_contact_id),

           /* CE QUE LE DOSSIER DISAIT DE L'ACCORD DE PARTAGE, CE JOUR-LÀ.
            *
            * Le produit DIT l'état du consentement sans jamais l'exiger [D-i].
            * Ce choix ne tient que si l'on peut établir, plus tard, ce que la
            * praticienne avait sous les yeux — `patient_consents` est une table
            * vivante, relue à chaque affichage. Sans cette clé, un an après,
            * rien ne dit si le dossier portait un accord, un retrait ou rien
            * quand le document est parti.
            *
            * Un retrait l'emporte sur un accord : c'est la dernière volonté
            * exprimée qui compte. Et un accord sans date d'accord n'est pas un
            * accord — c'est une ligne préparée.
            *
            * Trouvé par la relecture protection des données du rang 3. */
           'consentement_partage', (
             select case
               when bool_or(pc.withdrawn_on is not null) then 'retire'
               when bool_or(pc.granted_on is not null
                            and pc.withdrawn_on is null) then 'accorde'
               else 'absent' end
             from public.patient_consents pc
            where pc.practice_id = s.practice_id
              and pc.patient_id = s.patient_id
              and pc.kind in ('partage_professionnels',
                              'partage_etablissement',
                              'transmission_prescripteur')),

           /* À QUI ELLE A ÉTÉ REMISE, ÉCRIT EN TOUTES LETTRES. Sans cette clé,
            * un document remis en main propre ne portait aucun destinataire :
            * l'instantané était muet là où la garde de cohérence avait été
            * écrite précisément pour qu'on le sache dans un an. */
           /* ELLE SE LIT DU FAIT, PAS DE LA CASE. `recipient_is_patient` est
            * vrai par défaut, et la case et le destinataire nommé peuvent être
            * renseignés tous les deux : dans le parcours le plus probable —
            * choisir un destinataire sans décocher une case qu'on n'a pas vue
            * — le document imprimait le bloc du tiers pendant que l'instantané
            * disait « remise à la personne suivie ». Une traçabilité qui se
            * retourne : elle documentait une remise fausse.
            *
            * Trouvé par la relecture protection des données du rang 3. */
           'remise', case when s.recipient_contact_id is not null
                          then 'au_destinataire' else 'a_la_personne_suivie' end,

           /* LA MENTION QUI ENCADRE LES COMPTES, FIGÉE ELLE AUSSI.
            *
            * Une phrase qui encadre une lecture n'est pas de la typographie :
            * elle doit se relire dans trois ans telle qu'elle a été remise. La
            * laisser dans le code de la page la ferait changer sous les
            * documents déjà partis.
            *
            * Elle renvoie à l'attestation de présence plutôt que de se
            * contenter de nier : un lecteur qui cherche un détail vérifiable a
            * alors où aller. */
           'mentions', jsonb_build_object('comptes',
             'Ces nombres relèvent les séances inscrites à l''agenda du cabinet sur la période. ' ||
             'Ils ne constituent ni une évaluation de l''assiduité ni une appréciation de l''engagement ' ||
             'de la personne ou de sa famille. Une attestation de présence, portant le détail des dates, ' ||
             'peut être établie sur demande.'),

           /* LES FAITS, FIGÉS. Même fonction que celle de l'écran : ce qui est
            * imprimé est exactement ce qu'elle a vu avant de remettre.
            *
            * SAUF UN COMPTE, RETIRÉ ICI : les séances honorées de la période
            * qui ne portent aucun parcours. C'est un avertissement destiné à
            * ELLE, avant de remettre — « votre parcours n'en compte que
            * quatre, mais le dossier en porte neuf ». Ce n'est pas une
            * information pour le destinataire, et un document ne conserve pas
            * ce qu'il n'a pas dit. */
           'faits', public.follow_up_facts(
             s.patient_id, s.pathway_id, s.period_start, s.period_end)
             - 'honorees_sans_parcours'
             /* ET LES COMPTES QU'ELLE A CHOISI DE NE PAS DIRE.
              *
              * Les taire au seul rendu laissait le document figé porter une
              * donnée que son destinataire n'a jamais reçue : tout export,
              * toute lecture d'API, toute assistance qui ouvre l'instantané la
              * restituait. C'est la même règle que pour l'avertissement
              * ci-dessus, appliquée au non-dit de la praticienne. Les chiffres
              * restent calculables depuis l'agenda ; rien n'est perdu.
              *
              * Trouvé par la relecture de sécurité du rang 3. [Réversible :
              * si elle veut retrouver ce qu'elle n'a pas dit, c'est une
              * décision produit, pas un défaut à corriger.] */
             - (case when s.detail_absences then array[]::text[]
                     else array['absences', 'annulees_par_le_cabinet'] end)
             - (case when s.detail_objectifs then array[]::text[]
                     else array['objectifs'] end))
   where id = p_summary_id;

  /* LE JOURNAL DIT À QUI. L'événement ne portait que la date : la ligne du
   * destinataire disparaît avec le cabinet, alors que l'événement lui survit
   * (`audit_events.practice_id` passe à null). Aucun contenu clinique n'entre
   * ici — un identifiant technique et une nature de remise. */
  perform public.log_audit_event(
    s.practice_id, 'follow_up_summary.issue', 'follow_up_summary', p_summary_id,
    jsonb_build_object(
      'emis_le', v_emission,
      'remise', case when s.recipient_contact_id is not null
                     then 'au_destinataire' else 'a_la_personne_suivie' end,
      'destinataire_id', s.recipient_contact_id));

  return p_summary_id;
end;
$$;

create or replace function public.issue_closure_report(
  p_report_id uuid,
  p_issued_on date default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
  cp record;
  v_membre uuid;
  v_emission date;
  v_aujourdhui date;
begin
  select * into r from public.closure_reports where id = p_report_id;
  if r.id is null or not app.is_member(r.practice_id) then
    raise exception 'Écrit de fin introuvable.' using errcode = 'no_data_found';
  end if;
  if not app.can_write(r.practice_id) then
    raise exception 'Votre rôle ne permet pas de remettre un écrit de fin.'
      using errcode = 'insufficient_privilege';
  end if;
  if r.status <> 'brouillon' then
    raise exception 'Cet écrit est déjà remis.' using errcode = 'check_violation';
  end if;

  if btrim(coalesce(r.observed, '')) = '' then
    raise exception
      'Cet écrit ne dit rien de ce que vous observez au terme de la prise en soin : les comptes seuls ne font pas un compte rendu.'
      using errcode = 'check_violation';
  end if;

  select * into cp from public.care_pathways where id = r.pathway_id;

  /* LE PARCOURS SE CLÔT D'ABORD. Sans cela, le document affirmerait
   * « terminée le X » pendant que la base dirait « actif » — une contradiction
   * qui ressortira dans un an. Le BROUILLON, lui, reste permis sur un parcours
   * ouvert : on prépare l'écrit avant la dernière séance. */
  if cp.status not in ('termine', 'interrompu', 'reoriente') then
    raise exception
      'Ce parcours n''est pas clos. Clôturez-le depuis le dossier — c''est une décision clinique, pas une conséquence de la remise d''un document.'
      using errcode = 'check_violation';
  end if;
  /* PAS DE VÉRIFICATION « ended_on is null » ICI, ET C'EST DIT PLUTÔT QUE
   * SOUS-ENTENDU. `care_pathways_fin_ck` impose déjà l'équivalence entre un
   * statut clos et une date de fin renseignée : les deux conditions sont la
   * même, et un contrôle qui prétendrait éprouver la seconde ne ferait que
   * rejouer la première. Mesuré en désarmant : la suite restait verte. */
  /* LE JOUR DU CABINET, PAS CELUI DE LA SESSION DE LA BASE (`0027`). */
  v_aujourdhui := app.jour_du_cabinet(r.practice_id);
  if cp.ended_on > v_aujourdhui then
    raise exception
      'Ce parcours se termine dans le futur : on ne rend pas compte de ce qui n''a pas eu lieu.'
      using errcode = 'check_violation';
  end if;
  /* ⚠ Les parcours repris de la v1 n'ont pas de date de début. Le message doit
   * dire quoi remplir, plutôt que de laisser deviner. */
  if cp.started_on is null then
    raise exception
      'Ce parcours n''a pas de date de début : renseignez-la dans le dossier avant de remettre cet écrit.'
      using errcode = 'check_violation';
  end if;

  v_emission := coalesce(p_issued_on, v_aujourdhui);
  if v_emission > v_aujourdhui then
    raise exception 'Un écrit de fin ne se date pas du futur.'
      using errcode = 'check_violation';
  end if;

  select m.id into v_membre from public.practice_members m
   where m.practice_id = r.practice_id
     and m.user_id = app.current_user_id()
     and m.status = 'active'
   limit 1;

  update public.closure_reports
     set status = 'emis',
         issued_on = v_emission,
         issued_by = app.current_user_id(),
         cancellation_reason = null,
         snapshot = jsonb_build_object(
           'emis_le', v_emission,
           'nature', r.closure_kind,
           'remise', r.delivery_mode,
           'cabinet', (select jsonb_build_object('nom', p.name)
                         from public.practices p where p.id = r.practice_id),
           'entite_juridique', (select jsonb_build_object(
               'denomination', le.legal_name, 'forme', le.legal_form,
               'adresse', le.address_line1, 'code_postal', le.postal_code,
               'ville', le.city)
             from public.legal_entities le
             where le.practice_id = r.practice_id limit 1),
           'praticien', (select jsonb_build_object(
               'nom', pr.display_name, 'titre', pr.diploma_title)
             from public.practitioner_profiles pr where pr.member_id = v_membre),
           'identifiants', (select jsonb_agg(
               jsonb_build_object('type', pi.kind, 'valeur', pi.value))
             from public.professional_identifiers pi
             left join public.practitioner_profiles pr
               on pr.id = pi.practitioner_profile_id
             where pi.practice_id = r.practice_id
               and pi.kind in ('rpps', 'adeli', 'siret')
               and (pr.member_id is null or pr.member_id = v_membre)
               and (pi.valid_from is null or pi.valid_from <= v_emission)
               and (pi.valid_to is null or pi.valid_to >= v_emission)),
           'patient', (select jsonb_build_object(
               'nom', btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')),
               'ne_le', p.birth_date)
             from public.patients p where p.id = r.patient_id),
           'destinataire', (select jsonb_build_object(
               'nom', coalesce(c.organisation_name,
                       btrim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, ''))),
               'profession', c.profession,
               'adresse', c.address_line1, 'code_postal', c.postal_code,
               'ville', c.city,
               'role_au_dossier', coalesce((
                 select pc.role from public.patient_contacts pc
                  where pc.contact_id = c.id and pc.patient_id = r.patient_id
                  limit 1), 'aucun'))
             from public.contacts c where c.id = r.recipient_contact_id),

           -- Ce que le dossier disait de l'accord de partage, ce jour-là.
           'consentement_partage', (
             select case
               when bool_or(pc.withdrawn_on is not null) then 'retire'
               when bool_or(pc.granted_on is not null
                            and pc.withdrawn_on is null) then 'accorde'
               else 'absent' end
             from public.patient_consents pc
            where pc.practice_id = r.practice_id
              and pc.patient_id = r.patient_id
              and pc.kind in ('partage_professionnels',
                              'partage_etablissement',
                              'transmission_prescripteur')),

           /* LES MENTIONS, FIGÉES. Celle qui encadre les comptes est reprise
            * mot pour mot de la synthèse de suivi : le même chiffre lu par le
            * même financeur appelle le même encadrement.
            *
            * Celle qui énonce la NATURE de la fin est la seule phrase que le
            * logiciel écrit sur ce document. Elle constate, elle n'explique
            * pas : « sans nouvelle » ne dit ni abandon, ni négligence, ni
            * défaut d'assiduité. Ce qui s'est passé, c'est elle qui l'écrit,
            * juste en dessous. [VALIDATION HUMAINE — la formulation des quatre
            * natures revient à la psychomotricienne.] */
           'mentions', jsonb_build_object(
             'comptes',
               'Ces nombres relèvent les séances inscrites à l''agenda du cabinet sur la période. ' ||
               'Ils ne constituent ni une évaluation de l''assiduité ni une appréciation de l''engagement ' ||
               'de la personne ou de sa famille. Une attestation de présence, portant le détail des dates, ' ||
               'peut être établie sur demande.',
             'nature', case r.closure_kind
               when 'fin_convenue' then
                 'La fin de la prise en soin a été convenue.'
               when 'arret_a_la_demande' then
                 'L''arrêt a été demandé par la personne ou par sa famille.'
               when 'sans_nouvelle' then
                 'La prise en soin s''est interrompue ; le cabinet est resté sans nouvelle depuis. ' ||
                 'Le dossier est clos à la date indiquée et peut être repris à tout moment.'
               when 'relais' then
                 'La suite de la prise en soin est assurée par un autre professionnel.'
               end,
             'remise', case r.delivery_mode
               when 'au_dossier' then 'Écrit versé au dossier, non remis.'
               when 'personne_suivie' then 'Remis à la personne suivie ou à son entourage.'
               else null end),

           /* LES FAITS, FIGÉS. Les deux avertissements d'écran en sont retirés,
            * ainsi que les deux champs proposés à la reprise : ce qui
            * s'imprime, ce sont SES mots, pas la parole qu'elle a relue. Et
            * les comptes qu'elle a choisi de ne pas dire ne sont pas conservés
            * — un document ne conserve pas ce qu'il n'a pas dit. */
           'faits', public.closure_facts(r.pathway_id)
             - 'honorees_sans_parcours' - 'rendez_vous_a_venir'
             - 'objectifs_en_cours'
             - 'motif_demande_a_reprendre' - 'fin_du_parcours_a_reprendre'
             - (case when r.detail_absences then array[]::text[]
                     else array['absences', 'annulees_par_le_cabinet'] end)
             - (case when r.detail_objectifs then array[]::text[]
                     else array['objectifs'] end)
             - (case when r.detail_financement then array[]::text[]
                     else array['financement'] end))
   where id = p_report_id;

  perform public.log_audit_event(
    r.practice_id, 'closure_report.issue', 'closure_report', p_report_id,
    jsonb_build_object(
      'emis_le', v_emission,
      'nature', r.closure_kind,
      'remise', r.delivery_mode,
      'destinataire_id', r.recipient_contact_id));

  return p_report_id;
end;
$$;

create or replace function public.issue_third_party_report(
  p_report_id uuid,
  p_issued_on date default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
  v_membre uuid;
  v_emission date;
  v_aujourdhui date;
  v_accord text;
begin
  select * into r from public.third_party_reports where id = p_report_id;
  if r.id is null or not app.is_member(r.practice_id) then
    raise exception 'Écrit introuvable.' using errcode = 'no_data_found';
  end if;
  if not app.can_write(r.practice_id) then
    raise exception 'Votre rôle ne permet pas de remettre cet écrit.'
      using errcode = 'insufficient_privilege';
  end if;
  if r.status <> 'brouillon' then
    raise exception 'Cet écrit est déjà remis.' using errcode = 'check_violation';
  end if;

  if btrim(coalesce(r.observed, '')) = '' then
    raise exception
      'Cet écrit ne dit rien de ce que vous observez : il n''a alors rien à transmettre.'
      using errcode = 'check_violation';
  end if;

  /* LE CONSENTEMENT DÉCIDE ICI, ET PAS AILLEURS. Voir l'en-tête : la
   * présomption qui fondait « dire sans exiger » n'existe pas hors équipe de
   * soins. */
  v_accord := app.etat_accord_partage(r.practice_id, r.patient_id);

  if v_accord = 'retire' then
    raise exception
      'L''accord de partage a été RETIRÉ pour ce dossier. Cet écrit ne peut pas être remis à un tiers non soignant, et ce refus ne se contourne pas : c''est le cabinet lui-même qui a enregistré ce retrait.'
      using errcode = 'check_violation';
  end if;

  if v_accord <> 'accorde'
     and btrim(coalesce(r.consent_override_reason, '')) = '' then
    raise exception
      'Aucun accord de partage n''est enregistré pour ce dossier. Enregistrez-le, ou écrivez pourquoi vous remettez cet écrit sans lui — ce motif restera interne et ne sera jamais imprimé.'
      using errcode = 'check_violation';
  end if;

  /* LE JOUR DU CABINET, PAS CELUI DE LA SESSION DE LA BASE (`0027`). */
  v_aujourdhui := app.jour_du_cabinet(r.practice_id);
  v_emission := coalesce(p_issued_on, v_aujourdhui);
  if v_emission > v_aujourdhui then
    raise exception 'Un écrit ne se date pas du futur.'
      using errcode = 'check_violation';
  end if;

  select m.id into v_membre from public.practice_members m
   where m.practice_id = r.practice_id
     and m.user_id = app.current_user_id()
     and m.status = 'active'
   limit 1;

  update public.third_party_reports
     set status = 'emis',
         issued_on = v_emission,
         issued_by = app.current_user_id(),
         cancellation_reason = null,
         snapshot = jsonb_build_object(
           'emis_le', v_emission,
           'usage', r.intended_use,
           'remise', r.delivery_mode,
           'cabinet', (select jsonb_build_object('nom', p.name)
                         from public.practices p where p.id = r.practice_id),
           'entite_juridique', (select jsonb_build_object(
               'denomination', le.legal_name, 'forme', le.legal_form,
               'adresse', le.address_line1, 'code_postal', le.postal_code,
               'ville', le.city)
             from public.legal_entities le
             where le.practice_id = r.practice_id limit 1),
           'praticien', (select jsonb_build_object(
               'nom', pr.display_name, 'titre', pr.diploma_title)
             from public.practitioner_profiles pr where pr.member_id = v_membre),
           'identifiants', (select jsonb_agg(
               jsonb_build_object('type', pi.kind, 'valeur', pi.value))
             from public.professional_identifiers pi
             left join public.practitioner_profiles pr
               on pr.id = pi.practitioner_profile_id
             where pi.practice_id = r.practice_id
               and pi.kind in ('rpps', 'adeli', 'siret')
               and (pr.member_id is null or pr.member_id = v_membre)
               and (pi.valid_from is null or pi.valid_from <= v_emission)
               and (pi.valid_to is null or pi.valid_to >= v_emission)),

           /* LE PATIENT : nom et date de naissance. RIEN D'AUTRE — pas
            * d'adresse : elle n'a aucune utilité pour ce lecteur, et c'est une
            * donnée de plus qui circule dans un dossier administratif. */
           'patient', (select jsonb_build_object(
               'nom', btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')),
               'ne_le', p.birth_date)
             from public.patients p where p.id = r.patient_id),

           'destinataire', (select jsonb_build_object(
               'nom', coalesce(c.organisation_name,
                       btrim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, ''))),
               'profession', c.profession,
               'adresse', c.address_line1, 'code_postal', c.postal_code,
               'ville', c.city,
               'role_au_dossier', coalesce((
                 select pc.role from public.patient_contacts pc
                  where pc.contact_id = c.id and pc.patient_id = r.patient_id
                  limit 1), 'aucun'))
             from public.contacts c where c.id = r.recipient_contact_id),

           /* CE QUE LE DOSSIER DISAIT DE L'ACCORD, CE JOUR-LÀ — et QUI l'avait
            * donné. Sans le second, dans trois ans, on ne peut pas dire qui a
            * autorisé quoi. Le document imprimé, lui, ne dit JAMAIS qui a
            * consenti : ce n'est l'affaire ni d'une école ni d'un organisme. */
           'consentement_partage', v_accord,
           'consentement_donne_par', (
             select jsonb_agg(distinct jsonb_build_object(
                 'par_la_personne', pc.granted_by_patient,
                 'role_au_dossier', coalesce((
                   select l.role from public.patient_contacts l
                    where l.contact_id = pc.granted_by_contact_id
                      and l.patient_id = r.patient_id limit 1), 'aucun')))
             from public.patient_consents pc
            where pc.practice_id = r.practice_id
              and pc.patient_id = r.patient_id
              and pc.granted_on is not null and pc.withdrawn_on is null
              and pc.kind in ('partage_professionnels',
                              'partage_etablissement',
                              'transmission_prescripteur')),

           /* LES MENTIONS DE CADRAGE, FIGÉES. Celle de la nature s'imprime
            * TOUJOURS : c'est elle qui empêche ce document d'être lu comme une
            * pièce officielle. [VALIDATION HUMAINE — E-02, la formulation
            * revient à la psychomotricienne.] */
           'mentions', jsonb_build_object(
             'cadre',
               'Cet écrit est établi à la demande de la personne suivie ou de ses ' ||
               'représentants légaux. Il rend compte d''observations faites au cabinet, ' ||
               'dans les conditions décrites ci-dessus. Il ne constitue pas une pièce ' ||
               'officielle, ne comporte aucun diagnostic et ne préjuge d''aucune ' ||
               'décision. Il ne se substitue à aucun document médical.',
             'remise', case r.delivery_mode
               when 'remis_pour_transmission' then
                 'Ce document a été remis en main propre. Le cabinet ne l''a adressé ' ||
                 'directement à aucun organisme.'
               when 'au_dossier' then 'Écrit versé au dossier, non remis.'
               when 'personne_suivie' then 'Remis à la personne suivie ou à ses représentants.'
               else null end,
             'comptes', case when r.detail_seances then
               'Ces nombres relèvent les séances inscrites à l''agenda du cabinet. ' ||
               'Ils ne constituent ni une évaluation de l''assiduité ni une appréciation ' ||
               'de l''engagement de la personne ou de sa famille.' end,
             'chiffres', case when r.detail_scores then
               'Les résultats mentionnés ont été obtenus dans des conditions ' ||
               'd''observation particulières, à une date donnée. Ils décrivent une ' ||
               'performance à ce moment-là, non une caractéristique de la personne.' end),

           /* LES FAITS. Tout ce qui n'a pas été demandé est RETIRÉ, pas
            * seulement caché : un document ne conserve pas ce qu'il n'a pas
            * dit. L'avertissement d'écran et la parole proposée à la reprise
            * partent aussi. */
           'faits', public.third_party_report_facts(r.patient_id, r.pathway_id)
             - 'honorees_hors_parcours' - 'motif_demande_a_reprendre'
             - 'accord_partage'
             - (case when r.detail_seances then array[]::text[]
                     else array['seances_honorees'] end)
             - (case when r.detail_objectifs then array[]::text[]
                     else array['objectifs'] end)
             - (case when r.detail_prescripteur then array[]::text[]
                     else array['prescripteur'] end))
   where id = p_report_id;

  /* LE JOURNAL DISTINGUE LES DEUX CHEMINS. Une remise sans accord enregistré
   * n'est pas une remise ordinaire : elle porte une action à elle, pour qu'on
   * puisse la retrouver sans relire chaque pièce. Aucun contenu clinique — ni
   * le motif de dérogation, qui est du texte libre. */
  perform public.log_audit_event(
    r.practice_id,
    case when v_accord = 'accorde' then 'third_party_report.issue'
         else 'third_party_report.issue_without_consent' end,
    'third_party_report', p_report_id,
    jsonb_build_object(
      'emis_le', v_emission,
      'usage', r.intended_use,
      'remise', r.delivery_mode,
      'accord', v_accord,
      'destinataire_id', r.recipient_contact_id));

  return p_report_id;
end;
$$;

-- ============================================================================
--  3. LES DATES QUE LA BASE POSE D'ELLE-MÊME
-- ============================================================================

create or replace function public.issue_billing_document(
  p_document_id uuid,
  p_series text default null,
  p_number_format text default '{AAAA}-{NNN}',
  p_issued_on date default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  d record;
  v_emission date;
  v_series text;
  v_format text;
  v_pad integer;
  v_seq integer;
  v_number text;
  v_essais integer := 0;
  v_lignes integer;
  v_snapshot jsonb;
  v_cible_total bigint;
  v_avoirs bigint;
begin
  select * into d from public.billing_documents where id = p_document_id;
  if d.id is null or not app.can_write(d.practice_id) then
    raise exception 'Accès refusé.' using errcode = 'insufficient_privilege';
  end if;
  if d.status <> 'brouillon' then
    raise exception 'Cette pièce est déjà émise.' using errcode = 'check_violation';
  end if;

  select count(*) into v_lignes from public.billing_lines where document_id = d.id;
  if v_lignes = 0 then
    raise exception 'Une pièce sans ligne ne peut pas être émise.'
      using errcode = 'check_violation';
  end if;
  if d.payer_contact_id is null and not d.payer_is_patient then
    raise exception 'Indiquez à qui cette pièce est adressée.'
      using errcode = 'check_violation';
  end if;

  -- La date d'émission est un PARAMÈTRE, pas l'horloge. À défaut, le jour du
  -- CABINET (`0027`) : la série se calcule sur son année.
  v_emission := coalesce(p_issued_on, app.jour_du_cabinet(d.practice_id));

  -- [VALIDATION HUMAINE] Le BOFiP admet les séries distinctes « lorsque les
  -- conditions d'exercice le justifient » (§ 80).
  v_series := coalesce(
    p_series,
    case d.kind
      when 'devis' then 'DEVIS'
      when 'avoir' then 'AVOIR'
      else 'FACTURE'
    end || '-' || to_char(v_emission, 'YYYY'));

  -- Devis et avoirs portent un préfixe, pour ne jamais se confondre avec une
  -- facture sur deux documents remis côte à côte.
  v_format := case d.kind
    when 'devis' then 'D' || p_number_format
    when 'avoir' then 'A' || p_number_format
    else p_number_format
  end;

  v_pad := coalesce(length((regexp_match(v_format, '\{(N+)\}'))[1]), 0);

  -- Un numéro déjà porté par une pièce du cabinet ne se réattribue pas, quelle
  -- que soit sa série.
  loop
    v_seq := app.next_billing_seq(d.practice_id, v_series);

    v_number := replace(
      replace(
        replace(v_format, '{AAAA}', to_char(v_emission, 'YYYY')),
        '{AA}', to_char(v_emission, 'YY')),
      '{MM}', to_char(v_emission, 'MM'));
    if v_pad > 0 then
      v_number := regexp_replace(v_number, '\{N+\}', lpad(v_seq::text, v_pad, '0'));
    end if;

    exit when not exists (
      select 1 from public.billing_documents
       where practice_id = d.practice_id and number = v_number);

    if v_pad = 0 then
      raise exception
        'Le modèle de numéro « % » ne contient pas de compteur : il ne peut produire qu''un seul numéro, déjà attribué.',
        p_number_format using errcode = 'check_violation';
    end if;

    v_essais := v_essais + 1;
    if v_essais > 1000 then
      raise exception 'Aucun numéro libre trouvé dans la série %.', v_series
        using errcode = 'check_violation';
    end if;
  end loop;

  select jsonb_build_object(
    'emis_le', v_emission,
    'cabinet', (select jsonb_build_object('nom', p.name) from public.practices p
                 where p.id = d.practice_id),
    'entite_juridique', (select jsonb_build_object(
        'denomination', le.legal_name, 'forme', le.legal_form,
        'adresse', le.address_line1, 'code_postal', le.postal_code, 'ville', le.city)
      from public.legal_entities le where le.practice_id = d.practice_id limit 1),
    'identifiants', (select jsonb_agg(jsonb_build_object('type', pi.kind, 'valeur', pi.value))
      from public.professional_identifiers pi
      where pi.practice_id = d.practice_id
        and (pi.valid_from is null or pi.valid_from <= v_emission)
        and (pi.valid_to is null or pi.valid_to >= v_emission)),
    'configuration_fiscale', (select jsonb_build_object(
        'regime_fiscal', fc.tax_regime, 'regime_tva', fc.vat_regime,
        'methode_comptable', fc.accounting_method)
      from public.fiscal_configurations fc
      where fc.practice_id = d.practice_id
        and fc.valid_from <= v_emission
        and (fc.valid_to is null or fc.valid_to > v_emission)
      limit 1),
    'payeur', (select jsonb_build_object(
        'nom', coalesce(c.organisation_name,
                        btrim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, ''))),
        'adresse', c.address_line1, 'code_postal', c.postal_code, 'ville', c.city)
      from public.contacts c where c.id = d.payer_contact_id),
    'patient', (select jsonb_build_object(
        'nom', btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')),
        'adresse', p.address_line1, 'code_postal', p.postal_code, 'ville', p.city)
      from public.patients p where p.id = d.patient_id)
  ) into v_snapshot;

  update public.billing_documents
     set status = 'emis',
         series = v_series,
         number = v_number,
         issued_on = v_emission,
         snapshot = v_snapshot,
         issued_by = app.current_user_id()
   where id = d.id;

  /* Une pièce rectificative marque sa cible — MAIS SEULEMENT SI ELLE LA COUVRE.
   *
   * Un avoir partiel ne doit pas faire disparaître la facture : elle reste
   * émise, et l'avoir vient en déduction. C'est le défaut qui faisait perdre
   * 180 € de chiffre d'affaires pour une correction de 20 €.
   *
   * Une facture de remplacement, elle, se substitue toujours entièrement à la
   * précédente : la comparaison de montants n'y a pas de sens. */
  if d.kind = 'avoir' then
    select bd.total_cents into v_cible_total
      from public.billing_documents bd where bd.id = d.rectifies_id;

    select coalesce(sum(av.total_cents), 0) into v_avoirs
      from public.billing_documents av
     where av.rectifies_id = d.rectifies_id
       and av.kind = 'avoir'
       and av.status <> 'brouillon';

    if v_cible_total is not null and v_avoirs >= v_cible_total then
      update public.billing_documents set status = 'annule_par_avoir'
       where id = d.rectifies_id and status = 'emis';
    end if;
  elsif d.kind = 'facture_de_remplacement' then
    update public.billing_documents set status = 'remplace'
     where id = d.rectifies_id and status = 'emis';
  end if;

  insert into public.audit_events
    (practice_id, actor_user_id, action, subject_type, subject_id, metadata)
  values (d.practice_id, app.current_user_id(), 'billing.issue',
          'billing_document', d.id,
          jsonb_build_object('nature', d.kind, 'numero', v_number, 'serie', v_series));

  return v_number;
end;
$$;

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
         ended_on = coalesce(ended_on, app.jour_du_cabinet(v_practice)),
         end_reason = coalesce(end_reason, 'Dossier archivé')
   where patient_id = p_patient_id
     and status in ('demande', 'liste_attente', 'actif', 'en_pause');

  insert into public.audit_events
    (practice_id, actor_user_id, action, subject_type, subject_id)
  values
    (v_practice, app.current_user_id(), 'patient.archive', 'patient', p_patient_id);
end;
$$;

create or replace function public.activate_band_set(
  p_band_set_id uuid,
  p_validated_by text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_practice uuid;
  v_scale uuid;
  v_problemes text;
begin
  select practice_id, scale_id into v_practice, v_scale
    from public.scale_band_sets where id = p_band_set_id;

  if v_practice is null or not app.can_write(v_practice) then
    raise exception 'Accès refusé.' using errcode = 'insufficient_privilege';
  end if;

  select string_agg(probleme, E'\n') into v_problemes
    from public.validate_band_set(p_band_set_id);

  if v_problemes is not null then
    raise exception E'Ce découpage ne peut pas être appliqué :\n%', v_problemes
      using errcode = 'check_violation';
  end if;

  update public.scale_band_sets set active = false
   where scale_id = v_scale and active and id <> p_band_set_id;

  update public.scale_band_sets
     set active = true,
         validated_by = coalesce(p_validated_by, validated_by),
         validated_on = coalesce(validated_on, app.jour_du_cabinet(v_practice))
   where id = p_band_set_id;

  insert into public.audit_events
    (practice_id, actor_user_id, action, subject_type, subject_id)
  values (v_practice, app.current_user_id(), 'band_set.activate',
          'scale_band_set', p_band_set_id);
end;
$$;

/**
 * Une note ou un règlement enregistrés SANS DATE prennent le jour du cabinet.
 *
 * Un défaut de colonne ne voit pas le cabinet de la ligne : il n'évalue que des
 * constantes. Le défaut `current_date` est donc retiré, et ce déclencheur prend
 * sa place — qui omet la date obtient toujours « aujourd'hui », mais celui du
 * cabinet. Une date passée VIDE est traitée comme omise : un déclencheur ne
 * distingue pas les deux, là où la colonne la refusait. `not null` reste la
 * garde des mises à jour.
 *
 * NOMMÉS POUR PASSER EN PREMIER. Les déclencheurs `before` d'une table
 * s'exécutent dans l'ordre alphabétique de leur nom : une garde qui lirait la
 * date doit la trouver posée.
 *
 * `security definer` : le jour du cabinet ne s'interroge pas sous les droits de
 * celui qui écrit (voir `jour_du_cabinet`).
 */
create or replace function app.dater_au_jour_du_cabinet()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  case tg_table_name
    when 'patient_notes' then
      new.written_on := app.jour_du_cabinet(new.practice_id);
    when 'payments' then
      new.received_on := app.jour_du_cabinet(new.practice_id);
    else
      raise exception 'dater_au_jour_du_cabinet ne connaît pas la table %.', tg_table_name;
  end case;
  return new;
end;
$$;

revoke all on function app.dater_au_jour_du_cabinet() from public, anon, authenticated;

alter table public.patient_notes alter column written_on drop default;
alter table public.payments alter column received_on drop default;

create trigger patient_notes_a_dater
  before insert on public.patient_notes
  for each row when (new.written_on is null)
  execute function app.dater_au_jour_du_cabinet();

create trigger payments_a_dater
  before insert on public.payments
  for each row when (new.received_on is null)
  execute function app.dater_au_jour_du_cabinet();

-- ============================================================================
--  4. LA LICENCE D'UN INSTRUMENT
-- ============================================================================

/**
 * Statut de licence EFFECTIF (`0007`) — le jour est un PARAMÈTRE.
 *
 * Même règle qu'avant : le jour d'échéance est encore couvert, l'autorisation
 * cesse de produire ses effets le lendemain. Seule la provenance du jour change.
 *
 * Son seul appelant, la garde des échelles, ne réagit qu'à « référence seule »,
 * statut qu'aucune échéance ne produit : le jour qu'elle transmet est sans
 * effet sur sa décision. Il est transmis juste, mais aucun contrôle ne peut
 * montrer qu'il l'est.
 */
drop function app.effective_licence_status(text, date);

create function app.effective_licence_status(
  p_status text,
  p_expires_on date,
  p_aujourdhui date
)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when p_status = 'integration_editeur_autorisee'
     and p_expires_on is not null and p_expires_on < p_aujourdhui
    then 'scores_saisis_par_le_praticien'
    else p_status
  end;
$$;

create or replace function app.guard_scale_licence()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_statut text;
  v_expire date;
  v_practice uuid;
begin
  select licence_status, licence_expires_on, practice_id
    into v_statut, v_expire, v_practice
    from public.instruments where id = new.instrument_id;

  if app.effective_licence_status(v_statut, v_expire, app.jour_du_cabinet(v_practice))
     = 'reference_seule' then
    raise exception
      'Cet instrument est en « référence seule » : ses résultats se saisissent en texte libre, sans échelle ni bande.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- ============================================================================
--  5. LE JOUR D'UNE SÉANCE, DANS LE FUSEAU DU CABINET
-- ============================================================================

/**
 * `realised_sessions` (`0005`) : seul `session_date` change. Il lit le fuseau
 * effectif du cabinet — une colonne, aucun appel par séance.
 *
 * La jointure est externe : elle ne peut retirer aucune séance. Un cabinet
 * illisible — ce que la RLS n'impose jamais à un membre — laisserait un fuseau
 * nul, que la règle unique ramène au défaut. Cette branche n'est pas atteignable
 * par un contrôle, et n'est pas présentée comme démontrée.
 */
create or replace view public.realised_sessions
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
  (a.starts_at at time zone coalesce(pr.effective_timezone, app.fuseau_utilisable(null)))::date as session_date,
  a.billable
from public.appointments a
left join public.practices pr on pr.id = a.practice_id
where a.attendance = 'honore'
  and a.patient_id is not null
  and a.kind in ('seance', 'bilan', 'entretien', 'restitution');

create or replace function public.follow_up_facts(
  p_patient_id uuid,
  p_pathway_id uuid,
  p_from date,
  p_to date
) returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_practice uuid;
  v_fuseau text;
begin
  select practice_id into v_practice from public.patients where id = p_patient_id;
  if v_practice is null or not app.is_member(v_practice) then
    raise exception 'Dossier introuvable.' using errcode = 'no_data_found';
  end if;
  /* Le contenu clinique ne se lit pas par tout membre : un assistant n'a pas à
   * connaître les objectifs d'un patient. */
  if not app.can_read_clinical(v_practice) then
    raise exception 'Votre rôle ne permet pas de lire le suivi d''un dossier.'
      using errcode = 'insufficient_privilege';
  end if;

  /* LE PARCOURS DOIT ÊTRE CELUI DE CE DOSSIER. Sans cette vérification, un
   * identifiant de parcours pris ailleurs dans le même cabinet ferait compter
   * les séances d'un patient et recopier les objectifs d'un autre — sous le
   * nom du premier. Le cloisonnement entre cabinets n'y suffit pas : les deux
   * dossiers sont du même côté de la frontière. */
  if p_pathway_id is not null and not exists (
    select 1 from public.care_pathways cp
     where cp.id = p_pathway_id
       and cp.patient_id = p_patient_id
       and cp.practice_id = v_practice
  ) then
    raise exception 'Ce parcours n''est pas celui de ce dossier.'
      using errcode = 'check_violation';
  end if;

  /* LE JOUR D'UNE SÉANCE, DANS LE FUSEAU DE CE CABINET (`0027`) — et non plus
   * à l'heure de Paris : c'est la règle de `realised_sessions`, que les deux
   * autres comptes lisent. */
  v_fuseau := app.fuseau_du_cabinet(v_practice);

  return jsonb_build_object(
    'seances_honorees', (
      select count(*) from public.realised_sessions r
       where r.patient_id = p_patient_id
         and r.practice_id = v_practice
         and (p_pathway_id is null or r.pathway_id = p_pathway_id)
         and r.session_date between p_from and p_to),

    /* LES RENDEZ-VOUS NON HONORÉS, SUR LA MÊME BASE QUE LES SÉANCES.
     *
     * `realised_sessions` ne retient que quatre natures de rendez-vous. Les
     * compter ici sans le même filtre donnait deux numérateurs sur deux bases :
     * une réunion manquée entrait dans un compteur sans pouvoir jamais entrer
     * dans l'autre. Trouvé par la relecture métier du rang 3.
     *
     * ET LES DEUX CÔTÉS, PAS UN SEUL. Un parcours où le cabinet a annulé cinq
     * séances et la famille deux s'imprimait « 2 absences » — le chiffre à sens
     * unique, et c'est exactement celui que lit un financeur. Si on compte les
     * unes, on compte les autres. */
    'absences', (
      select count(*) from public.appointments a
       where a.patient_id = p_patient_id
         and a.practice_id = v_practice
         and (p_pathway_id is null or a.pathway_id = p_pathway_id)
         and a.kind in ('seance', 'bilan', 'entretien', 'restitution')
         and a.attendance in ('absent_excuse', 'absent_non_excuse')
         and (a.starts_at at time zone v_fuseau)::date between p_from and p_to),

    'annulees_par_le_cabinet', (
      select count(*) from public.appointments a
       where a.patient_id = p_patient_id
         and a.practice_id = v_practice
         and (p_pathway_id is null or a.pathway_id = p_pathway_id)
         and a.kind in ('seance', 'bilan', 'entretien', 'restitution')
         and a.attendance = 'annule_praticien'
         and (a.starts_at at time zone v_fuseau)::date between p_from and p_to),

    /* LES SÉANCES DE LA PÉRIODE QUI NE PORTENT AUCUN PARCOURS.
     *
     * `appointments.pathway_id` est facultatif, et l'agenda le lit d'un champ
     * de formulaire. Une synthèse rattachée à un parcours dont les rendez-vous
     * n'ont jamais porté ce parcours affiche donc zéro, sans rien dire. Ce
     * compte sert D'AVERTISSEMENT À L'ÉCRAN — il ne s'imprime pas : ce n'est
     * pas une information pour le destinataire, c'est une information pour
     * elle, avant de remettre. */
    'honorees_sans_parcours', (
      select count(*) from public.realised_sessions r
       where r.patient_id = p_patient_id
         and r.practice_id = v_practice
         and r.pathway_id is null
         and r.session_date between p_from and p_to),

    'parcours_ouvert_le', (
      select cp.started_on from public.care_pathways cp where cp.id = p_pathway_id),

    /* LES OBJECTIFS TELS QU'ELLE LES A POSÉS. Libellé, statut, date de mise en
     * place, date de réévaluation et SES MOTS DE RÉÉVALUATION — rien de
     * calculé, rien de requalifié.
     *
     * `review_note` est là parce que le statut est un mot du LOGICIEL, choisi
     * dans une énumération, tandis que la note de réévaluation est la sienne.
     * Imprimer le premier sans la seconde inversait la doctrine annoncée.
     *
     * UN OBJECTIF POSÉ APRÈS LA FIN DE LA PÉRIODE N'Y FIGURE PAS. Sans ce
     * filtre, une synthèse « du 1er janvier au 30 juin » remise en septembre
     * reprenait des objectifs posés en août. Le STATUT, lui, reste celui du
     * jour de la remise — on ne sait pas reconstituer un statut passé, et le
     * document le dit au lieu de le laisser croire. */
    'objectifs', coalesce((
      select jsonb_agg(jsonb_build_object(
          'intitule', o.label,
          'statut', o.status,
          'pose_le', o.set_on,
          'revu_le', o.reviewed_on,
          'note_de_reevaluation', o.review_note) order by o.position, o.created_at)
        from public.care_objectives o
       where o.practice_id = v_practice
         and o.pathway_id = p_pathway_id
         and (o.set_on is null or o.set_on <= p_to)), '[]'::jsonb));
end;
$$;

create or replace function public.issue_attestation(
  p_attestation_id uuid,
  p_issued_on date default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  a record;
  v_emission date;
  v_series text;
  v_seq integer;
  v_number text;
  v_essais integer := 0;
  v_faits integer;
  v_snapshot jsonb;
  v_membre uuid;
  v_dernier date;
  v_aujourdhui date;
  v_fuseau text;
begin
  select * into a from public.attestations where id = p_attestation_id;
  if a.id is null then
    raise exception 'Attestation introuvable.' using errcode = 'no_data_found';
  end if;

  /* ATTESTER EST UN ACTE PROFESSIONNEL : c'est le nom et le numéro du praticien
   * qui figureront sur le document. Voir l'en-tête du fichier — aujourd'hui ce
   * contrôle ne retire de droit à personne, `can_write` excluant déjà les
   * assistants ; il existe pour que les deux questions puissent diverger. */
  if not app.can_attest(a.practice_id) then
    raise exception
      'Seul un praticien du cabinet peut signer une attestation.'
      using errcode = 'insufficient_privilege';
  end if;

  if a.status <> 'brouillon' then
    raise exception 'Cette attestation est déjà émise.' using errcode = 'check_violation';
  end if;

  -- Une attestation sans fait rattaché n'atteste de rien.
  if a.kind = 'presence' then
    select count(*) into v_faits from public.attestation_sessions
     where attestation_id = a.id;
    if v_faits = 0 then
      raise exception
        'Aucune séance n''est rattachée : cette attestation n''affirmerait rien de vérifiable.'
        using errcode = 'check_violation';
    end if;
  else
    select count(*) into v_faits from public.attestation_payments
     where attestation_id = a.id;
    if v_faits = 0 then
      raise exception
        'Aucun règlement n''est rattaché : cette attestation n''affirmerait rien de vérifiable.'
        using errcode = 'check_violation';
    end if;
  end if;

  if a.recipient_contact_id is null and not a.recipient_is_patient then
    raise exception 'Indiquez à qui cette attestation est remise.'
      using errcode = 'check_violation';
  end if;

  /* LE JOUR DU CABINET, PAS CELUI DE LA SESSION DE LA BASE (`0026`).
   * La date « du jour » de la base se calcule dans le fuseau de la session :
   * sous une base réglée en UTC, entre minuit et deux heures du matin à
   * Paris, c'était encore la veille — et une signature datée du jour était
   * refusée comme « future ». */
  v_aujourdhui := app.jour_du_cabinet(a.practice_id);
  -- Et le jour d'une séance, dans le fuseau de ce cabinet (`0027`).
  v_fuseau := app.fuseau_du_cabinet(a.practice_id);
  v_emission := coalesce(p_issued_on, v_aujourdhui);

  /* ON NE SIGNE PAS DANS LE FUTUR, ni avant le dernier fait attesté.
   *
   * Rien ne bornait cette date, et la série se calcule sur son année : on
   * pouvait signer au 1er janvier une attestation listant des séances de juin,
   * ou dater de l'an prochain. Une attestation antidatée ne vaut rien pour qui
   * la reçoit, et une attestation postdatée n'est pas encore un document. */
  if v_emission > v_aujourdhui then
    raise exception 'Une attestation ne se signe pas à une date future.'
      using errcode = 'check_violation';
  end if;

  select max(x.jour) into v_dernier from (
    select (ap.starts_at at time zone v_fuseau)::date as jour
      from public.attestation_sessions s
      join public.appointments ap on ap.id = s.appointment_id
     where s.attestation_id = a.id
    union all
    select pay.received_on
      from public.attestation_payments atp
      join public.payments pay on pay.id = atp.payment_id
     where atp.attestation_id = a.id
  ) x;
  if v_dernier is not null and v_emission < v_dernier then
    raise exception
      'La signature (%) précède le dernier fait attesté (%). Une attestation ne peut pas être établie avant ce qu''elle atteste.',
      v_emission, v_dernier using errcode = 'check_violation';
  end if;

  /* LES FAITS RATTACHÉS DOIVENT TENIR DANS LA PÉRIODE ANNONCÉE.
   *
   * L'écran de composition filtre les séances proposées par la période, mais
   * pas celles DÉJÀ rattachées : en resserrant la période après avoir coché,
   * on obtenait un brouillon dont les dates disparaissaient de l'écran et
   * s'imprimaient quand même — en contradiction avec la période annoncée juste
   * au-dessus. On signait un document qu'on n'avait pas relu. */
  if a.period_start is not null or a.period_end is not null then
    if exists (
      select 1 from public.attestation_sessions s
      join public.appointments ap on ap.id = s.appointment_id
      where s.attestation_id = a.id
        and ((a.period_start is not null
              and (ap.starts_at at time zone v_fuseau)::date < a.period_start)
          or (a.period_end is not null
              and (ap.starts_at at time zone v_fuseau)::date > a.period_end))
    ) then
      raise exception
        'Des séances rattachées sortent de la période annoncée. Élargissez la période, ou retirez ces séances.'
        using errcode = 'check_violation';
    end if;
    if exists (
      select 1 from public.attestation_payments atp
      join public.payments pay on pay.id = atp.payment_id
      where atp.attestation_id = a.id
        and ((a.period_start is not null and pay.received_on < a.period_start)
          or (a.period_end is not null and pay.received_on > a.period_end))
    ) then
      raise exception
        'Des règlements rattachés sortent de la période annoncée. Élargissez la période, ou retirez ces règlements.'
        using errcode = 'check_violation';
    end if;
  end if;

  v_series := 'ATTESTATION-' || to_char(v_emission, 'YYYY');

  -- Le praticien signataire : celui qui émet, pas celui qui a saisi.
  select m.id into v_membre
    from public.practice_members m
   where m.practice_id = a.practice_id
     and m.user_id = app.current_user_id()
     and m.status = 'active'
   limit 1;

  -- Numéro. Série propre aux attestations : elle ne partage rien avec celle
  -- des factures, dont la continuité répond à une exigence que rien n'impose
  -- ici. Le préfixe évite qu'on prenne l'un pour l'autre.
  loop
    v_seq := app.next_billing_seq(a.practice_id, v_series);
    v_number := 'AT' || to_char(v_emission, 'YYYY') || '-' || lpad(v_seq::text, 3, '0');
    exit when not exists (
      select 1 from public.attestations
       where practice_id = a.practice_id and number = v_number);
    v_essais := v_essais + 1;
    if v_essais > 1000 then
      raise exception 'Aucun numéro libre dans la série %.', v_series
        using errcode = 'check_violation';
    end if;
  end loop;

  select jsonb_build_object(
    'emis_le', v_emission,
    'cabinet', (select jsonb_build_object('nom', p.name) from public.practices p
                 where p.id = a.practice_id),
    'entite_juridique', (select jsonb_build_object(
        'denomination', le.legal_name, 'forme', le.legal_form,
        'adresse', le.address_line1, 'code_postal', le.postal_code, 'ville', le.city)
      from public.legal_entities le where le.practice_id = a.practice_id limit 1),

    /* L'IDENTITÉ DU SIGNATAIRE. Une attestation sans nom ni titre ni numéro
     * professionnel ne vaut rien pour qui la reçoit. */
    'praticien', (select jsonb_build_object(
        'nom', pr.display_name, 'titre', pr.diploma_title)
      from public.practitioner_profiles pr where pr.member_id = v_membre),
    'identifiants', (select jsonb_agg(jsonb_build_object('type', pi.kind, 'valeur', pi.value))
      from public.professional_identifiers pi
      left join public.practitioner_profiles pr on pr.id = pi.practitioner_profile_id
      where pi.practice_id = a.practice_id
        and pi.kind in ('rpps', 'adeli', 'siret')
        and (pr.member_id is null or pr.member_id = v_membre)
        and (pi.valid_from is null or pi.valid_from <= v_emission)
        and (pi.valid_to is null or pi.valid_to >= v_emission)),

    /* Le patient. Sa date de naissance est là parce qu'un destinataire doit
     * pouvoir identifier la personne sans ambiguïté — deux homonymes existent.
     * Aucune autre donnée du dossier n'entre ici. */
    'patient', (select jsonb_build_object(
        'nom', btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')),
        'ne_le', p.birth_date,
        'adresse', p.address_line1, 'code_postal', p.postal_code, 'ville', p.city)
      from public.patients p where p.id = a.patient_id),

    'destinataire', (select jsonb_build_object(
        'nom', coalesce(c.organisation_name,
                        btrim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, ''))),
        'adresse', c.address_line1, 'code_postal', c.postal_code, 'ville', c.city)
      from public.contacts c where c.id = a.recipient_contact_id),

    -- LES FAITS ATTESTÉS, figés. Le document ne dépend plus de leur relecture.
    'seances', (select jsonb_agg(jsonb_build_object(
        'date', (ap.starts_at at time zone v_fuseau)::date,
        'nature', ap.kind) order by ap.starts_at)
      from public.attestation_sessions s
      join public.appointments ap on ap.id = s.appointment_id
      where s.attestation_id = a.id),

    'reglements', (select jsonb_agg(jsonb_build_object(
        'date', pay.received_on, 'moyen', pay.method,
        'montant_centimes', atp.amount_cents) order by pay.received_on)
      from public.attestation_payments atp
      join public.payments pay on pay.id = atp.payment_id
      where atp.attestation_id = a.id),

    -- Les pièces sur lesquelles ces règlements ont été imputés, pour ce
    -- patient : c'est le lien entre l'argent et la prestation.
    'factures', (select jsonb_agg(distinct jsonb_build_object(
        'numero', d.number, 'emise_le', d.issued_on))
      from public.attestation_payments atp
      join public.payment_allocations al on al.payment_id = atp.payment_id
      join public.billing_documents d on d.id = al.document_id
      where atp.attestation_id = a.id and d.patient_id = a.patient_id),

    /* QUI A PAYÉ. Sans cette clé, le document affirmait qu'un enfant de dix
     * ans « a réglé la somme de… » — le seul endroit du module où il énonçait
     * un fait faux. Une mutuelle qui rembourse un parent assuré a besoin du
     * nom de cet assuré ; si c'est une plateforme de coordination qui a payé,
     * écrire que la famille l'a fait est une erreur de fond.
     *
     * Le payeur se lit sur les factures d'imputation, où il est déjà porté.
     * PLUSIEURS payeurs sont possibles : on les rend tous, et le document le
     * dira plutôt que d'en choisir un. */
    'payeurs', (select jsonb_agg(distinct nom) from (
        select coalesce(
          case when d.payer_is_patient
               then (select btrim(coalesce(pt.first_name, '') || ' ' || coalesce(pt.last_name, ''))
                       from public.patients pt where pt.id = d.patient_id)
               else coalesce(c.organisation_name,
                    btrim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')))
          end, '') as nom
        from public.attestation_payments atp
        join public.payment_allocations al on al.payment_id = atp.payment_id
        join public.billing_documents d on d.id = al.document_id
        left join public.contacts c on c.id = d.payer_contact_id
        where atp.attestation_id = a.id and d.patient_id = a.patient_id
      ) payeurs where nom <> '')
  ) into v_snapshot;

  update public.attestations
     set status = 'emis',
         series = v_series,
         number = v_number,
         issued_on = v_emission,
         snapshot = v_snapshot,
         issued_by = app.current_user_id()
   where id = a.id;

  insert into public.audit_events
    (practice_id, actor_user_id, action, subject_type, subject_id, metadata)
  values (a.practice_id, app.current_user_id(), 'attestation.issue',
          'attestation', a.id,
          jsonb_build_object('nature', a.kind, 'numero', v_number));

  return v_number;
end;
$$;
