-- ============================================================================
--  0024 — L'ÉCRIT DE FIN DE PRISE EN SOIN
-- ============================================================================
--  RANG 4 DES ÉCRITS MANQUANTS. Ce qui se dit quand un suivi s'achève : ce qui
--  a été fait, où en sont les objectifs, ce qui met fin, ce qui reste ouvert,
--  et comment reprendre.
--
--  ── TROIS SCÈNES, UN SEUL DOCUMENT ────────────────────────────────────────
--
--  Le travail arrive à son terme ; la famille arrête ; la suite se passe
--  ailleurs. Trois scènes, mais un seul squelette : qui, quel épisode, ce qui
--  a été fait, où on en est, ce qui reste ouvert, comment reprendre. Elles
--  diffèrent par l'accent, pas par la structure.
--
--  Et elles NE S'EXCLUENT PAS : une prise en soin qui s'achève ET dont la
--  suite est confiée à une consœur est les deux à la fois. Trois tables
--  forceraient un choix faux. Une table, un discriminant — c'est la forme que
--  ce dépôt a déjà éprouvée sur les attestations et les pièces comptables.
--
--  ── LE DISCRIMINANT N'EST PAS LE STATUT DU PARCOURS, ET C'EST ESSENTIEL ───
--
--  Deux raisons, l'une et l'autre démontrables dans le code :
--
--   · `archive_patient()` force `status = 'termine'`, `ended_on = current_date`
--     et `end_reason = 'Dossier archivé'`. Un parcours « terminé » peut donc
--     être un artefact de rangement. Un document qui dériverait sa nature du
--     statut titrerait « fin de prise en soin » sur un geste d'archivage.
--
--   · `status = 'interrompu'` est commenté « arrêt à l'initiative de la
--     famille ou du patient ». Un arrêt SANS NOUVELLE n'a pas d'initiative
--     connue — y ranger le cas prête une intention à des gens qui ont
--     peut-être déménagé, été hospitalisés, ou simplement oublié.
--
--  `closure_kind` appartient donc au DOCUMENT. Quatre valeurs, choisies pour
--  énoncer un fait sans prêter d'intention. [VALIDATION HUMAINE — une
--  cinquième nature, « fin à l'initiative de la praticienne », n'a pas été
--  ajoutée « en prévision » : seule une praticienne sait si le cas se
--  présente et comment il doit se dire.]
--
--  ── LE PARCOURS SE CLÔT D'ABORD ; L'ÉCRIT EN DÉCOULE ──────────────────────
--
--  Jamais l'inverse. `unarchive_patient()` refuse déjà de rouvrir les parcours
--  au motif que « les rouvrir serait une décision clinique, pas une
--  conséquence mécanique ». Faire clôturer un parcours par une remise de
--  document serait la même faute dans l'autre sens : un acte documentaire
--  déciderait d'un état clinique.
--
--  Le BROUILLON, lui, s'écrit sur un parcours encore ouvert — on prépare
--  l'écrit avant la dernière séance. C'est la REMISE qui exige un parcours
--  clos.
-- ============================================================================

create table public.closure_reports (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete restrict,

  /* LE PARCOURS EST OBLIGATOIRE, contrairement à la synthèse de suivi. Toute
   * l'ossature factuelle de cet écrit vient de lui : sans lui, « fin de prise
   * en soin » n'a pas de référent. Un parcours resté en demande ou en liste
   * d'attente et abandonné ne produit pas cet écrit — il produit un courrier
   * de liaison au prescripteur, qui existe déjà. */
  pathway_id uuid not null references public.care_pathways(id) on delete restrict,

  /* CE QUI MET FIN, EN QUATRE MOTS QUI N'ACCUSENT PERSONNE.
   *
   *  · `fin_convenue`        la fin a été convenue. PAS « objectifs atteints » :
   *                          le logiciel ne qualifie pas l'atteinte.
   *  · `arret_a_la_demande`  la personne ou sa famille a demandé l'arrêt.
   *                          Sans « malgré », sans « prématuré ».
   *  · `sans_nouvelle`       la prise en soin s'est interrompue, sans nouvelle
   *                          depuis. C'est la valeur qui ÉVITE d'attribuer une
   *                          décision à quelqu'un qui n'en a peut-être pris
   *                          aucune.
   *  · `relais`              la suite est assurée par un autre professionnel.
   *
   * AUCUNE LISTE DE MOTIFS ne viendra s'ajouter à celle-ci. « Abandon »,
   * « non-adhésion », « défaut d'assiduité » : c'est là que le jugement
   * s'industrialise, parce qu'on finit par choisir la case la moins fausse et
   * que le mot part chez le médecin. Le motif, lui, s'écrit en prose. */
  closure_kind text not null check (closure_kind in (
    'fin_convenue', 'arret_a_la_demande', 'sans_nouvelle', 'relais')),

  /* À QUI, EN UN SEUL CHAMP EXPLICITE.
   *
   * La synthèse de suivi porte `recipient_contact_id` + `recipient_is_patient`,
   * et la relecture protection des données a montré que les deux pouvaient
   * être renseignés en même temps : le document imprimait le bloc du tiers
   * pendant que l'instantané disait « remise à la personne suivie ». Ici, un
   * seul champ décide, et une contrainte l'accorde au destinataire.
   *
   * `au_dossier` est la valeur que la synthèse n'avait pas, et dont le cas
   * « sans nouvelle » a besoin : un écrit daté, figé, signé, qui ne part chez
   * personne. Ce n'est pas un affaiblissement de la règle « le destinataire
   * est explicite » — c'est son extension : « versé au dossier, non remis »
   * RÉPOND à la question « à qui ce document a-t-il été donné ». */
  delivery_mode text not null default 'au_dossier' check (delivery_mode in (
    'destinataire', 'personne_suivie', 'au_dossier')),
  recipient_contact_id uuid references public.contacts(id) on delete restrict,

  /* CE QU'ELLE ÉCRIT, ET QUE PERSONNE N'ÉCRIT À SA PLACE. */
  context text,           -- contexte de la demande, dans ses termes
  means text,             -- cadre et moyens mis en œuvre
  observed text,          -- ce qu'elle observe au terme — exigé à la remise
  closure_reason text,    -- ce qui met fin, dans ses termes
  remains_open text,      -- ce qui reste ouvert ; il peut n'y avoir rien
  handover text,          -- relais et suite proposée
  resumption text,        -- modalités de reprise

  -- Ce qui s'imprime ou non. Mêmes défauts que la synthèse de suivi.
  detail_objectifs boolean not null default true,
  detail_absences boolean not null default false,
  /* Le cadre de financement. Faux par défaut : utile pour proposer le
   * destinataire, rarement utile sur le papier. */
  detail_financement boolean not null default false,

  status text not null default 'brouillon' check (status in (
    'brouillon', 'emis', 'annule')),
  issued_on date,

  note text,
  internal_note text,
  cancellation_reason text,
  snapshot jsonb,

  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default app.current_user_id(),
  updated_at timestamptz not null default now(),
  issued_by uuid references auth.users(id) on delete set null,

  constraint closure_emission_ck check (
    (status = 'brouillon') = (issued_on is null)),
  constraint closure_instantane_ck check (
    (status = 'brouillon') = (snapshot is null)),
  constraint closure_annulation_ck check (
    status <> 'annule' or length(btrim(coalesce(cancellation_reason, ''))) > 0),

  /* LE DESTINATAIRE ET LE MODE DE REMISE S'ACCORDENT, PAR CONSTRUCTION. Un
   * contact nommé sans le mode qui va avec, ou l'inverse, produirait
   * exactement l'ambiguïté qu'on ferme ici. */
  constraint closure_remise_ck check (
    (delivery_mode = 'destinataire') = (recipient_contact_id is not null))
);
create index idx_closure_practice
  on public.closure_reports (practice_id, status, issued_on desc);
create index idx_closure_patient on public.closure_reports (patient_id);
create index idx_closure_pathway on public.closure_reports (pathway_id);

create trigger closure_updated_at before update on public.closure_reports
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
--  Cohérence
-- ---------------------------------------------------------------------------
create or replace function app.guard_closure_coherence()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- On refuse d'abord, on renseigne ensuite : le déclencheur BEFORE ROW
  -- s'exécute avant la clause `with check` de la RLS et répondrait sinon en
  -- premier, avec un message qui trahit l'appartenance. Voir `0023`.
  if app.current_user_id() is not null
     and not app.can_write(new.practice_id) then
    raise exception 'Accès refusé.' using errcode = 'insufficient_privilege';
  end if;

  /* CETTE VÉRIFICATION NE PEUT PAS REFUSER SEULE, ET C'EST DIT PLUTÔT QUE
   * SOUS-ENTENDU. Celle du parcours, juste en dessous, exige le cabinet ET le
   * dossier ; et `care_pathways` porte sa propre garde de cohérence, si bien
   * qu'un parcours d'un cabinet ne peut jamais désigner le dossier d'un autre.
   * Désarmer ces quatre lignes ne fait donc échouer aucun contrôle.
   *
   * Elles restent parce qu'elles viennent EN PREMIER : dans le cas réel — on
   * s'est trompé de dossier — elles rendent « le dossier n'appartient pas à ce
   * cabinet », là où la garde du parcours parlerait d'un parcours alors que le
   * problème est ailleurs. Un message juste vaut quatre lignes. */
  if not exists (
    select 1 from public.patients p
     where p.id = new.patient_id and p.practice_id = new.practice_id
  ) then
    raise exception 'Le dossier n''appartient pas à ce cabinet.'
      using errcode = 'foreign_key_violation';
  end if;

  if not exists (
    select 1 from public.care_pathways cp
     where cp.id = new.pathway_id
       and cp.practice_id = new.practice_id
       and cp.patient_id = new.patient_id
  ) then
    raise exception 'Ce parcours n''est pas celui de ce dossier.'
      using errcode = 'check_violation';
  end if;

  if new.recipient_contact_id is not null and not exists (
    select 1 from public.contacts c
     where c.id = new.recipient_contact_id and c.practice_id = new.practice_id
  ) then
    raise exception 'Le destinataire n''appartient pas à ce cabinet.'
      using errcode = 'foreign_key_violation';
  end if;

  return new;
end;
$$;
create trigger closure_coherence
  before insert or update on public.closure_reports
  for each row execute function app.guard_closure_coherence();

-- ---------------------------------------------------------------------------
--  Immuabilité
-- ---------------------------------------------------------------------------
create or replace function app.guard_issued_closure()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.status = 'brouillon' then
    return new;
  end if;

  if new.status is distinct from old.status then
    if not (old.status = 'emis' and new.status = 'annule') then
      raise exception
        'Un écrit de fin remis s''annule, avec un motif — et une annulation ne se défait pas. Établissez-en un autre.'
        using errcode = 'check_violation';
    end if;
  end if;

  -- Le motif d'annulation ne se pose pas d'avance et ne se réécrit pas : c'est
  -- la phrase que lit celui qui a reçu l'écrit.
  if new.cancellation_reason is distinct from old.cancellation_reason
     and new.status <> 'annule' then
    raise exception 'Un motif d''annulation ne se pose que sur une annulation.'
      using errcode = 'check_violation';
  end if;
  if old.status = 'annule'
     and new.cancellation_reason is distinct from old.cancellation_reason then
    raise exception
      'Le motif d''une annulation ne se réécrit pas : il a déjà été lu.'
      using errcode = 'check_violation';
  end if;

  if new.closure_kind is distinct from old.closure_kind
     or new.context is distinct from old.context
     or new.means is distinct from old.means
     or new.observed is distinct from old.observed
     or new.closure_reason is distinct from old.closure_reason
     or new.remains_open is distinct from old.remains_open
     or new.handover is distinct from old.handover
     or new.resumption is distinct from old.resumption
     or new.note is distinct from old.note
     or new.detail_objectifs is distinct from old.detail_objectifs
     or new.detail_absences is distinct from old.detail_absences
     or new.detail_financement is distinct from old.detail_financement
     or new.issued_on is distinct from old.issued_on
     or new.snapshot is distinct from old.snapshot
     or new.patient_id <> old.patient_id
     or new.pathway_id <> old.pathway_id
     or new.delivery_mode is distinct from old.delivery_mode
     or new.recipient_contact_id is distinct from old.recipient_contact_id
     -- Ce qui rattache la pièce : à quel cabinet, qui a signé, qui a rédigé,
     -- quand. Le document imprimé ne bouge pas — il lit l'instantané — mais
     -- son imputation, elle, se déplacerait.
     or new.practice_id is distinct from old.practice_id
     or new.issued_by is distinct from old.issued_by
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception
      'Un écrit de fin remis ne se modifie pas : il est déjà entre les mains de son destinataire. Annulez-le, avec un motif, et établissez-en un autre.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger closure_immuable
  before update on public.closure_reports
  for each row execute function app.guard_issued_closure();

create or replace function app.guard_delete_closure()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Suppression en cascade du cabinet : plus rien à protéger.
  if not exists (select 1 from public.practices p where p.id = old.practice_id) then
    return old;
  end if;
  if old.status <> 'brouillon' then
    raise exception
      'Un écrit de fin remis ne se supprime pas : il se conserve et s''annule, avec un motif.'
      using errcode = 'check_violation';
  end if;
  return old;
end;
$$;
create trigger closure_suppression
  before delete on public.closure_reports
  for each row execute function app.guard_delete_closure();

-- ---------------------------------------------------------------------------
--  RLS — contenu clinique
-- ---------------------------------------------------------------------------
alter table public.closure_reports enable row level security;
alter table public.closure_reports force row level security;

create policy closure_select on public.closure_reports
  for select to authenticated
  using (practice_id in (select app.mes_cabinets_cliniques()));
create policy closure_insert on public.closure_reports
  for insert to authenticated with check (app.can_write(practice_id));
create policy closure_update on public.closure_reports
  for update to authenticated
  using (app.can_write(practice_id)) with check (app.can_write(practice_id));
create policy closure_delete on public.closure_reports
  for delete to authenticated using (app.can_write(practice_id));

revoke all on public.closure_reports from anon, authenticated;
grant select, insert, update, delete on public.closure_reports to authenticated;

-- ---------------------------------------------------------------------------
--  Les faits de l'épisode
-- ---------------------------------------------------------------------------
/**
 * Ce que l'épisode contient, en faits vérifiables.
 *
 * L'UNITÉ N'EST PAS UNE PÉRIODE, C'EST UN PARCOURS — et c'est ce qui distingue
 * cet écrit d'une synthèse de suivi portant sur la dernière période. Les
 * bornes ne sont pas choisies par elle : ce sont `started_on` et `ended_on`,
 * des faits du parcours. La fonction ne prend donc qu'un identifiant.
 *
 * ELLE NE CONCLUT RIEN. Des comptes, des dates, des libellés.
 */
create or replace function public.closure_facts(p_pathway_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  cp record;
begin
  select * into cp from public.care_pathways where id = p_pathway_id;
  if cp.id is null or not app.is_member(cp.practice_id) then
    raise exception 'Parcours introuvable.' using errcode = 'no_data_found';
  end if;
  if not app.can_read_clinical(cp.practice_id) then
    raise exception 'Votre rôle ne permet pas de lire le suivi d''un dossier.'
      using errcode = 'insufficient_privilege';
  end if;

  return jsonb_build_object(
    'parcours', jsonb_build_object(
      'ouvert_le', cp.started_on,
      'clos_le', cp.ended_on,
      'statut', cp.status),

    'seances_honorees', (
      select count(*) from public.realised_sessions r
       where r.pathway_id = p_pathway_id and r.practice_id = cp.practice_id),

    /* UNE DATE, PAS UNE LISTE. La règle « le détail des séances n'y figure
     * pas » tient toujours — une liste de dates dessine un rythme de vie. Mais
     * la date de la DERNIÈRE séance honorée est une date unique, elle ne
     * dessine rien, et c'est le repère que la famille reconnaît. C'est aussi
     * ce qui situe un arrêt sans nouvelle sans avoir à l'expliquer. */
    'derniere_seance_le', (
      select max(r.session_date) from public.realised_sessions r
       where r.pathway_id = p_pathway_id and r.practice_id = cp.practice_id),

    'absences', (
      select count(*) from public.appointments a
       where a.pathway_id = p_pathway_id and a.practice_id = cp.practice_id
         and a.kind in ('seance', 'bilan', 'entretien', 'restitution')
         and a.attendance in ('absent_excuse', 'absent_non_excuse')),
    'annulees_par_le_cabinet', (
      select count(*) from public.appointments a
       where a.pathway_id = p_pathway_id and a.practice_id = cp.practice_id
         and a.kind in ('seance', 'bilan', 'entretien', 'restitution')
         and a.attendance = 'annule_praticien'),

    /* DEUX AVERTISSEMENTS D'ÉCRAN, qui ne partent PAS avec le document.
     *
     * Les séances du dossier sans parcours : le risque est plus fort ici que
     * sur une synthèse, parce que le compte porte sur tout l'épisode. Un écrit
     * affichant « 4 séances » quand le dossier en porte soixante est le défaut
     * le plus coûteux possible sur ce document.
     *
     * Les rendez-vous encore à venir : le créneau reste bloqué à l'agenda, et
     * c'est justement le cas « sans nouvelle ». */
    'honorees_sans_parcours', (
      select count(*) from public.realised_sessions r
       where r.patient_id = cp.patient_id
         and r.practice_id = cp.practice_id
         and r.pathway_id is null),
    'rendez_vous_a_venir', (
      select count(*) from public.appointments a
       where a.pathway_id = p_pathway_id and a.practice_id = cp.practice_id
         and a.attendance = 'a_venir'),

    /* LE MOTIF DE LA DEMANDE, POUR ÊTRE REPRIS — jamais lu à travers.
     *
     * C'est la parole du demandeur, parfois celle d'un tiers, parfois vieille
     * de trois ans. L'écran le propose dans un panneau en lecture seule avec
     * un bouton « reprendre » ; ce qui s'imprime est le champ `context`,
     * qu'elle a relu. Cette clé est retirée de l'instantané à la remise. */
    'motif_demande_a_reprendre', cp.referral_reason,
    'fin_du_parcours_a_reprendre', cp.end_reason,

    'financement', cp.funding_scheme,
    'prescripteur', (select jsonb_build_object(
        'nom', coalesce(c.organisation_name,
                btrim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, ''))),
        'profession', c.profession,
        'prescrit_le', cp.prescription_date)
      from public.contacts c where c.id = cp.prescriber_contact_id),

    'objectifs', coalesce((
      select jsonb_agg(jsonb_build_object(
          'intitule', o.label,
          'statut', o.status,
          'pose_le', o.set_on,
          'revu_le', o.reviewed_on,
          'note_de_reevaluation', o.review_note) order by o.position, o.created_at)
        from public.care_objectives o
       where o.pathway_id = p_pathway_id
         and o.practice_id = cp.practice_id), '[]'::jsonb),

    /* LES OBJECTIFS ENCORE EN COURS SUR UN PARCOURS QUI SE CLÔT.
     *
     * Un objectif resté « en cours » s'imprimerait « en cours » sur un
     * document qui annonce que la prise en soin est terminée : une
     * contradiction lisible par la famille. On AVERTIT, on ne refuse pas — et
     * elle statue un par un. Aucun bouton « tout clore » : requalifier en
     * masse serait un jugement du logiciel sur chaque objectif. */
    'objectifs_en_cours', (
      select count(*) from public.care_objectives o
       where o.pathway_id = p_pathway_id
         and o.practice_id = cp.practice_id
         and o.status = 'en_cours'));
end;
$$;
revoke all on function public.closure_facts(uuid) from public, anon;
grant execute on function public.closure_facts(uuid) to authenticated;

-- ---------------------------------------------------------------------------
--  L'émission
-- ---------------------------------------------------------------------------
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
  if cp.ended_on > current_date then
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

  v_emission := coalesce(p_issued_on, current_date);
  if v_emission > current_date then
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
revoke all on function public.issue_closure_report(uuid, date) from public, anon;
grant execute on function public.issue_closure_report(uuid, date) to authenticated;

create or replace function public.cancel_closure_report(
  p_report_id uuid,
  p_reason text
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
begin
  select * into r from public.closure_reports where id = p_report_id;
  if r.id is null or not app.is_member(r.practice_id) then
    raise exception 'Écrit de fin introuvable.' using errcode = 'no_data_found';
  end if;
  if not app.can_write(r.practice_id) then
    raise exception 'Votre rôle ne permet pas d''annuler un écrit de fin.'
      using errcode = 'insufficient_privilege';
  end if;
  if r.status <> 'emis' then
    raise exception 'Seul un écrit remis s''annule.' using errcode = 'check_violation';
  end if;
  /* CE REFUS NE PEUT PAS ÊTRE LE SEUL À AGIR : `closure_annulation_ck` exige
   * déjà un motif dès que le statut passe à « annulé ». Désarmer cette
   * condition ne fait échouer aucun contrôle. Elle reste parce qu'elle DIT
   * pourquoi, là où la contrainte de table ne rend qu'un nom technique. */
  if btrim(coalesce(p_reason, '')) = '' then
    raise exception
      'Une annulation sans motif n''apprend rien à qui a reçu l''écrit. Indiquez pourquoi.'
      using errcode = 'check_violation';
  end if;

  update public.closure_reports
     set status = 'annule', cancellation_reason = btrim(p_reason)
   where id = p_report_id;

  perform public.log_audit_event(
    r.practice_id, 'closure_report.cancel', 'closure_report', p_report_id, null);
  return p_report_id;
end;
$$;
revoke all on function public.cancel_closure_report(uuid, text) from public, anon;
grant execute on function public.cancel_closure_report(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
--  Un parcours qui porte un écrit de fin REMIS ne se rouvre pas
-- ---------------------------------------------------------------------------
--  Un document remis affirme « prise en soin terminée le X ». Rouvrir le
--  parcours derrière lui ferait dire à la base le contraire de ce que son
--  destinataire tient entre les mains.
--
--  CE N'EST PAS UN REFUS DE REPRENDRE LE TRAVAIL : une reprise se fait dans un
--  NOUVEAU parcours, ce que le modèle prévoit déjà — « un bilan à 5 ans, une
--  reprise à 9 ans ». C'est un refus de réécrire le passé.
--
--  [VALIDATION HUMAINE — F-08] Reprise après un écrit de fin remis : nouveau
--  parcours, ou réouverture ? Cette garde tranche pour le nouveau parcours.
--  Elle est réversible : la retirer ne détruit aucune donnée.
create or replace function app.guard_pathway_reopen()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.status in ('termine', 'interrompu', 'reoriente')
     and new.status not in ('termine', 'interrompu', 'reoriente')
     and exists (select 1 from public.closure_reports cr
                  where cr.pathway_id = old.id and cr.status = 'emis')
  then
    raise exception
      'Un écrit de fin a été remis pour ce parcours : le rouvrir ferait dire à la base le contraire de ce que son destinataire a lu. Ouvrez un nouveau parcours.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger care_pathways_reouverture
  before update on public.care_pathways
  for each row execute function app.guard_pathway_reopen();
