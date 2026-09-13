-- ============================================================================
--  0025 — L'ÉCRIT POUR UN TIERS NON SOIGNANT
-- ============================================================================
--  RANG 5. Ce qui part chez une école, une équipe éducative, ou dans un
--  dossier déposé à une MDPH. C'est le document le plus délicat du lot, et il
--  est construit comme tel.
--
--  ── CE QUI LE SÉPARE DU COURRIER DE LIAISON ───────────────────────────────
--
--  Le courrier (`0022`) s'adresse à UN PROFESSIONNEL DE SANTÉ NOMMÉ. Ici, le
--  destinataire est un enseignant, une équipe, un organisme évaluateur : il
--  n'est pas tenu au même secret, il n'a pas le cadre pour lire une réserve ou
--  une hypothèse, et l'information circulera plus loin que lui — une salle des
--  maîtres, un dossier administratif, des années.
--
--  D'où un registre d'écriture différent : FONCTIONNEL ET SITUÉ, jamais
--  clinique. « Dans un texte de dix lignes copié au tableau, la tenue du
--  crayon se crispe au bout de trois lignes » se lit par tout le monde, ne
--  qualifie personne, et sert. « Trouble de la coordination motrice » ne fait
--  ni l'un ni l'autre.
--
--  ── UN OBJET, TROIS USAGES DÉCLARÉS ───────────────────────────────────────
--
--  Une note à l'enseignant et une pièce versée à une MDPH n'ont ni le même
--  lecteur ni le même horizon. Mais elles se RECOUVRENT — une équipe de suivi
--  de scolarisation est précisément le lieu où un écrit est lu par l'enseignant
--  référent ET rejoint le dossier de l'organisme. Deux tables y forceraient un
--  choix faux, ou feraient écrire deux fois la même chose. Même argument qu'en
--  `0024` pour les quatre natures de fin.
--
--  L'usage déclaré n'est pas cosmétique : il commande ce qui est EXCLU par
--  défaut, la mention de cadrage imprimée, et les avertissements d'écran.
--
--  ── CE QUI N'EST PAS CE DOCUMENT ──────────────────────────────────────────
--
--   · l'écrit à un professionnel de santé nommé → courrier de liaison, `0022` ;
--   · l'écrit à une structure de coordination de SOINS (une plateforme de
--     bilan et intervention précoce en est une) → synthèse ou courrier ;
--   · UNE INFORMATION PRÉOCCUPANTE OU UN SIGNALEMENT. Le circuit n'est pas
--     l'école, et un produit qui laisserait un écrit « école » en tenir lieu
--     créerait un défaut grave. Ce n'est pas outillé ici, et ce n'est pas un
--     oubli.
--
--  ── LE CONSENTEMENT, ET POURQUOI IL CHANGE DE RÉGIME ICI ──────────────────
--
--  Sur les rangs 2, 3 et 4, le produit DIT l'état de l'accord sans l'exiger
--  [D-i]. Ce choix reposait sur une raison précise : [SOURCE — à vérifier par
--  un juriste] l'article L1110-4 du code de la santé publique PRÉSUME autorisé
--  l'échange d'informations au sein d'une équipe de soins. Face à un médecin
--  adresseur, refuser d'émettre AJOUTERAIT une condition que le texte ne pose
--  pas.
--
--  Une école n'est pas une équipe de soins. Un organisme évaluateur non plus.
--  La présomption disparaît — et avec elle, l'argument qui fondait `D-i`. Le
--  produit n'ajoute alors aucune condition : il refuse de produire, sans trace
--  d'une décision, un document dont toute la raison d'être est que quelqu'un
--  d'extérieur au soin lise une information de santé sur la personne.
--
--  TROIS ÉTATS, PAS DEUX :
--   · accord enregistré, non retiré → on émet ;
--   · rien d'enregistré → on refuse, SAUF motif écrit, conservé en interne,
--     jamais imprimé, et journalisé sous une action distincte ;
--   · RETRAIT enregistré → refus ferme, sans dérogation. Un logiciel où
--     émettre contre un retrait coûte aussi peu qu'émettre avec un accord rend
--     le retrait sans effet — alors que c'est le cabinet lui-même qui l'a
--     enregistré.
--
--  [VALIDATION HUMAINE — juriste/DPO pour la qualification du destinataire
--  (D-n), psychomotricienne pour le refus ferme sur retrait (E-14). Cette
--  dernière garde est RÉVERSIBLE : la retirer ne détruit aucune donnée.]
--
--  ── DESTINATAIRE N'EST PAS DESTINATION ────────────────────────────────────
--
--  Le mode de remise dominant vers un organisme n'est pas l'envoi : c'est
--  « remis à la famille, qui transmet ». Il n'y a alors AUCUN destinataire
--  nommé, et la praticienne ne maîtrise pas la suite du trajet. Les rangs 2 à
--  4 ne connaissent pas ce cas. Le document le DIT — « le cabinet ne l'a
--  adressé directement à aucun organisme » — ce qui est vrai, protecteur, et
--  répond par avance à « qui a envoyé ça ? ».
-- ============================================================================

create table public.third_party_reports (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete restrict,

  /* Le parcours est FACULTATIF, comme pour la synthèse et contrairement à
   * l'écrit de fin : une demande de l'école peut précéder l'ouverture d'un
   * parcours. */
  pathway_id uuid references public.care_pathways(id) on delete set null,

  intended_use text not null check (intended_use in (
    'ecole', 'mdph', 'autre_tiers')),

  /* QUATRE MODES, dont un que les autres écrits ne connaissent pas. */
  delivery_mode text not null default 'personne_suivie' check (delivery_mode in (
    'destinataire',            -- adressé à un tiers nommé
    'remis_pour_transmission', -- remis à la personne, qui le porte ailleurs
    'personne_suivie',         -- remis, sans destination déclarée
    'au_dossier')),            -- versé au dossier, non remis
  recipient_contact_id uuid references public.contacts(id) on delete restrict,

  /* CE QU'ELLE ÉCRIT. Aucune de ces rubriques n'est pré-remplie. */
  context text,              -- qui a demandé cet écrit, et pourquoi
  observation_setting text,  -- où, quand, dans quelles conditions
  observed text,             -- ce qui est observé — EXIGÉ à la remise
  daily_impact text,         -- le retentissement dans le contexte concerné
  what_helps text,           -- ce qui aide, tel qu'observé
  proposals text,            -- des propositions, imprimées comme telles
  limits_note text,          -- une limite qu'elle veut ajouter au cadrage

  /* TOUT EST FAUX PAR DÉFAUT, et c'est la règle de ce document.
   *
   * Un résultat chiffré lu par un enseignant, des objectifs de prise en soin
   * dans un dossier administratif, le nom du médecin qui a adressé, la liste
   * des autres professionnels qui interviennent : chacun est une divulgation
   * que le destinataire n'a pas demandée et que la personne n'a pas choisie.
   *
   * Les absences ne sont PAS proposées du tout : l'assiduité n'est pas
   * l'affaire d'une école. [E-09] */
  detail_scores boolean not null default false,
  detail_objectifs boolean not null default false,
  detail_seances boolean not null default false,
  detail_prescripteur boolean not null default false,
  detail_professionnels boolean not null default false,
  /* Saisis à la main quand elle les veut : jamais dérivés de
   * `patient_contacts.role`, qui décrirait le circuit de soins entier. */
  professionnels text,

  /* LE MOTIF DE DÉROGATION AU CONSENTEMENT. Interne, jamais imprimé. */
  consent_override_reason text,

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

  constraint tiers_emission_ck check (
    (status = 'brouillon') = (issued_on is null)),
  constraint tiers_instantane_ck check (
    (status = 'brouillon') = (snapshot is null)),
  constraint tiers_annulation_ck check (
    status <> 'annule' or length(btrim(coalesce(cancellation_reason, ''))) > 0),

  /* LE DESTINATAIRE ET LE MODE S'ACCORDENT. Seul `destinataire` en nomme un ;
   * `remis_pour_transmission` désigne une DESTINATION sans destinataire, et
   * c'est précisément ce qui le distingue. */
  constraint tiers_remise_ck check (
    (delivery_mode = 'destinataire') = (recipient_contact_id is not null)),

  /* Les professionnels ne se nomment que si elle a demandé à les nommer. */
  constraint tiers_professionnels_ck check (
    detail_professionnels or professionnels is null)
);
create index idx_tiers_practice
  on public.third_party_reports (practice_id, status, issued_on desc);
create index idx_tiers_patient on public.third_party_reports (patient_id);

create trigger tiers_updated_at before update on public.third_party_reports
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
--  Cohérence
-- ---------------------------------------------------------------------------
create or replace function app.guard_third_party_coherence()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- On refuse d'abord, uniformément : le déclencheur BEFORE ROW répond avant
  -- la clause `with check` de la RLS. Voir l'en-tête de `0023`.
  if app.current_user_id() is not null
     and not app.can_write(new.practice_id) then
    raise exception 'Accès refusé.' using errcode = 'insufficient_privilege';
  end if;

  if not exists (
    select 1 from public.patients p
     where p.id = new.patient_id and p.practice_id = new.practice_id
  ) then
    raise exception 'Le dossier n''appartient pas à ce cabinet.'
      using errcode = 'foreign_key_violation';
  end if;

  if new.pathway_id is not null and not exists (
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
create trigger tiers_coherence
  before insert or update on public.third_party_reports
  for each row execute function app.guard_third_party_coherence();

-- ---------------------------------------------------------------------------
--  Immuabilité
-- ---------------------------------------------------------------------------
create or replace function app.guard_issued_third_party()
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
        'Un écrit remis s''annule, avec un motif — et une annulation ne se défait pas. Établissez-en un autre.'
        using errcode = 'check_violation';
    end if;
  end if;

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

  if new.intended_use is distinct from old.intended_use
     or new.context is distinct from old.context
     or new.observation_setting is distinct from old.observation_setting
     or new.observed is distinct from old.observed
     or new.daily_impact is distinct from old.daily_impact
     or new.what_helps is distinct from old.what_helps
     or new.proposals is distinct from old.proposals
     or new.limits_note is distinct from old.limits_note
     or new.note is distinct from old.note
     or new.detail_scores is distinct from old.detail_scores
     or new.detail_objectifs is distinct from old.detail_objectifs
     or new.detail_seances is distinct from old.detail_seances
     or new.detail_prescripteur is distinct from old.detail_prescripteur
     or new.detail_professionnels is distinct from old.detail_professionnels
     or new.professionnels is distinct from old.professionnels
     or new.issued_on is distinct from old.issued_on
     or new.snapshot is distinct from old.snapshot
     or new.patient_id <> old.patient_id
     or new.pathway_id is distinct from old.pathway_id
     or new.delivery_mode is distinct from old.delivery_mode
     or new.recipient_contact_id is distinct from old.recipient_contact_id
     /* LE MOTIF DE DÉROGATION EST FIGÉ LUI AUSSI. Il ne s'imprime pas, mais
      * c'est la seule trace de la raison pour laquelle un document est parti
      * sans accord enregistré. La réécrire après coup reviendrait à se donner
      * une autre raison. */
     or new.consent_override_reason is distinct from old.consent_override_reason
     or new.practice_id is distinct from old.practice_id
     or new.issued_by is distinct from old.issued_by
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception
      'Un écrit remis ne se modifie pas : il est déjà entre les mains de son destinataire. Annulez-le, avec un motif, et établissez-en un autre.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger tiers_immuable
  before update on public.third_party_reports
  for each row execute function app.guard_issued_third_party();

create or replace function app.guard_delete_third_party()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from public.practices p where p.id = old.practice_id) then
    return old;
  end if;
  if old.status <> 'brouillon' then
    raise exception
      'Un écrit remis ne se supprime pas : il se conserve et s''annule, avec un motif.'
      using errcode = 'check_violation';
  end if;
  return old;
end;
$$;
create trigger tiers_suppression
  before delete on public.third_party_reports
  for each row execute function app.guard_delete_third_party();

-- ---------------------------------------------------------------------------
--  RLS — contenu clinique
-- ---------------------------------------------------------------------------
alter table public.third_party_reports enable row level security;
alter table public.third_party_reports force row level security;

create policy tiers_select on public.third_party_reports
  for select to authenticated
  using (practice_id in (select app.mes_cabinets_cliniques()));
create policy tiers_insert on public.third_party_reports
  for insert to authenticated with check (app.can_write(practice_id));
create policy tiers_update on public.third_party_reports
  for update to authenticated
  using (app.can_write(practice_id)) with check (app.can_write(practice_id));
create policy tiers_delete on public.third_party_reports
  for delete to authenticated using (app.can_write(practice_id));

revoke all on public.third_party_reports from anon, authenticated;
grant select, insert, update, delete on public.third_party_reports to authenticated;

-- ---------------------------------------------------------------------------
--  L'état de l'accord de partage, en un seul endroit
-- ---------------------------------------------------------------------------
/**
 * Ce que le dossier dit de l'accord de partage, aujourd'hui.
 *
 * La règle était recopiée dans `issue_follow_up_summary`, dans
 * `issue_closure_report` et dans le module de lecture applicatif. Ici elle
 * DÉCIDE — elle ne se contente plus d'informer — et une règle qui décide ne se
 * recopie pas.
 *
 * Un RETRAIT l'emporte sur un accord : c'est la dernière volonté exprimée qui
 * compte. Un accord SANS DATE d'accord n'est pas un accord : c'est une ligne
 * préparée.
 */
create or replace function app.etat_accord_partage(
  p_practice_id uuid,
  p_patient_id uuid
) returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when bool_or(pc.withdrawn_on is not null) then 'retire'
    when bool_or(pc.granted_on is not null and pc.withdrawn_on is null) then 'accorde'
    else 'absent' end
  from public.patient_consents pc
 where pc.practice_id = p_practice_id
   and pc.patient_id = p_patient_id
   and pc.kind in ('partage_professionnels',
                   'partage_etablissement',
                   'transmission_prescripteur');
$$;

-- ---------------------------------------------------------------------------
--  Les faits — trois, et trois seulement
-- ---------------------------------------------------------------------------
/**
 * Ce que la base peut poser sans rien interpréter.
 *
 * TROIS FAITS, et l'abstention sur tout le reste. Les bornes de
 * l'accompagnement sont ce qu'un dossier demande explicitement et ce qu'une
 * famille n'énonce jamais avec précision. Le RYTHME, lui, n'y est pas : le
 * déduire de dates serait une interprétation.
 *
 * Le reste — motif de la demande, objectifs, comptes — est PROPOSÉ à l'écran
 * et retiré de l'instantané : ce qui s'imprime, ce sont ses mots.
 */
create or replace function public.third_party_report_facts(
  p_patient_id uuid,
  p_pathway_id uuid
) returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_practice uuid;
begin
  select practice_id into v_practice from public.patients where id = p_patient_id;
  if v_practice is null or not app.is_member(v_practice) then
    raise exception 'Dossier introuvable.' using errcode = 'no_data_found';
  end if;
  if not app.can_read_clinical(v_practice) then
    raise exception 'Votre rôle ne permet pas de lire le suivi d''un dossier.'
      using errcode = 'insufficient_privilege';
  end if;
  if p_pathway_id is not null and not exists (
    select 1 from public.care_pathways cp
     where cp.id = p_pathway_id
       and cp.patient_id = p_patient_id
       and cp.practice_id = v_practice
  ) then
    raise exception 'Ce parcours n''est pas celui de ce dossier.'
      using errcode = 'check_violation';
  end if;

  return jsonb_build_object(
    'premiere_seance_le', (
      select min(r.session_date) from public.realised_sessions r
       where r.patient_id = p_patient_id and r.practice_id = v_practice
         and (p_pathway_id is null or r.pathway_id = p_pathway_id)),
    'derniere_seance_le', (
      select max(r.session_date) from public.realised_sessions r
       where r.patient_id = p_patient_id and r.practice_id = v_practice
         and (p_pathway_id is null or r.pathway_id = p_pathway_id)),
    'seances_honorees', (
      select count(*) from public.realised_sessions r
       where r.patient_id = p_patient_id and r.practice_id = v_practice
         and (p_pathway_id is null or r.pathway_id = p_pathway_id)),

    'prescripteur', (select jsonb_build_object(
        'nom', coalesce(c.organisation_name,
                btrim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, ''))),
        'profession', c.profession,
        'prescrit_le', cp.prescription_date)
      from public.care_pathways cp
      join public.contacts c on c.id = cp.prescriber_contact_id
     where cp.id = p_pathway_id),

    'objectifs', coalesce((
      select jsonb_agg(jsonb_build_object(
          'intitule', o.label, 'statut', o.status) order by o.position, o.created_at)
        from public.care_objectives o
       where o.pathway_id = p_pathway_id and o.practice_id = v_practice), '[]'::jsonb),

    /* PROPOSÉ À LA REPRISE, jamais imprimé tel quel : la parole du demandeur,
     * parfois celle d'un tiers, parfois vieille de trois ans. Retiré de
     * l'instantané à la remise. */
    'motif_demande_a_reprendre', (
      select cp.referral_reason from public.care_pathways cp where cp.id = p_pathway_id),

    /* AVERTISSEMENT D'ÉCRAN. Un écrit affirmant « suivie depuis mars » alors
     * que le dossier porte deux ans de séances est le défaut le plus coûteux
     * sur ce document. */
    'honorees_hors_parcours', (
      select count(*) from public.realised_sessions r
       where r.patient_id = p_patient_id and r.practice_id = v_practice
         and (p_pathway_id is null or r.pathway_id is distinct from p_pathway_id)),

    -- L'état de l'accord, pour que l'écran le montre AVANT le refus.
    'accord_partage', app.etat_accord_partage(v_practice, p_patient_id));
end;
$$;
revoke all on function public.third_party_report_facts(uuid, uuid) from public, anon;
grant execute on function public.third_party_report_facts(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
--  L'émission
-- ---------------------------------------------------------------------------
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

  v_emission := coalesce(p_issued_on, current_date);
  if v_emission > current_date then
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
revoke all on function public.issue_third_party_report(uuid, date) from public, anon;
grant execute on function public.issue_third_party_report(uuid, date) to authenticated;

create or replace function public.cancel_third_party_report(
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
  select * into r from public.third_party_reports where id = p_report_id;
  if r.id is null or not app.is_member(r.practice_id) then
    raise exception 'Écrit introuvable.' using errcode = 'no_data_found';
  end if;
  if not app.can_write(r.practice_id) then
    raise exception 'Votre rôle ne permet pas d''annuler cet écrit.'
      using errcode = 'insufficient_privilege';
  end if;
  if r.status <> 'emis' then
    raise exception 'Seul un écrit remis s''annule.' using errcode = 'check_violation';
  end if;
  -- La contrainte de table exige déjà un motif ; ce refus-ci DIT pourquoi.
  if btrim(coalesce(p_reason, '')) = '' then
    raise exception
      'Une annulation sans motif n''apprend rien à qui a reçu l''écrit. Indiquez pourquoi.'
      using errcode = 'check_violation';
  end if;

  update public.third_party_reports
     set status = 'annule', cancellation_reason = btrim(p_reason)
   where id = p_report_id;

  perform public.log_audit_event(
    r.practice_id, 'third_party_report.cancel', 'third_party_report', p_report_id, null);
  return p_report_id;
end;
$$;
revoke all on function public.cancel_third_party_report(uuid, text) from public, anon;
grant execute on function public.cancel_third_party_report(uuid, text) to authenticated;
