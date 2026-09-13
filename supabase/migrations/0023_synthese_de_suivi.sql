-- ============================================================================
--  0023 — LA SYNTHÈSE DE SUIVI
-- ============================================================================
--  RANG 3 DES ÉCRITS MANQUANTS. Une à deux fois par an et par patient suivi :
--  ce qui a été fait sur une période, où en sont les objectifs, ce qu'on
--  observe, ce qu'on ajuste. Destinée au prescripteur, à la famille, ou à la
--  structure désignée dans un parcours financé.
--
--  [SOURCE — à vérifier par la praticienne sur SON contrat] l'arrêté du
--  19 décembre 2025 prévoit la transmission de comptes rendus à la structure,
--  à la famille et aux professionnels accompagnants dans le cadre d'un parcours
--  de bilan et intervention précoce. La PÉRIODICITÉ exacte dépend du contrat
--  signé : elle se lit dans le contrat, pas ici, et le produit n'en impose
--  aucune. [VALIDATION HUMAINE]
--
--  ── CE QUI LA DISTINGUE DES AUTRES DOCUMENTS ──────────────────────────────
--
--  C'est le premier document du produit dont une partie est PRÉ-REMPLIE depuis
--  la base. La ligne est donc à tenir avec soin :
--
--   · UN FAIT est recopié : le nombre de séances honorées sur la période, la
--     date d'ouverture du parcours, les objectifs et leur statut TELS QU'ELLE
--     LES A POSÉS. Ces valeurs existent déjà, elle les a saisies, et les
--     retaper serait du travail repris à l'identique.
--
--   · UNE INTERPRÉTATION n'est jamais produite. Aucune phrase d'évolution,
--     aucun « progrès », aucun écart calculé, aucun objectif marqué atteint
--     parce qu'un chiffre a bougé. Ce que la période signifie, c'est elle qui
--     l'écrit — et les deux champs de texte de ce document sont vides tant
--     qu'elle ne les a pas remplis.
--
--  ── LE DÉTAIL DES SÉANCES N'Y FIGURE PAS ──────────────────────────────────
--
--  Un NOMBRE, pas une liste de dates. Une liste de dates dessine un rythme de
--  vie, et c'est la sur-information la plus facile à laisser passer dans un
--  document qui part chez un tiers. Le défaut est donc le moins disant, comme
--  pour l'attestation de présence.
--
--  `detail_absences` ajoute le compte des rendez-vous non honorés — utile à une
--  structure qui suit un parcours contractualisé, inutile et pesant ailleurs.
--  Faux par défaut : on ne parle d'absences que si on a décidé d'en parler. Et
--  quand on en parle, on compte AUSSI les séances que le cabinet a annulées :
--  un chiffre à sens unique est exactement celui qu'un financeur retiendra.
-- ============================================================================

create table public.follow_up_summaries (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete restrict,

  /* UNE SYNTHÈSE PORTE SUR UN PARCOURS. C'est lui qui donne son sens à la
   * période : « depuis le début de la prise en soin » n'a pas la même portée
   * selon le parcours dont on parle. Il reste facultatif — un suivi peut
   * n'avoir jamais été formalisé en parcours. */
  pathway_id uuid references public.care_pathways(id) on delete set null,

  -- À qui elle est remise. Le patient lui-même, ou un tiers.
  recipient_contact_id uuid references public.contacts(id) on delete restrict,
  recipient_is_patient boolean not null default true,

  -- La période couverte. Bornes incluses, et obligatoires : une synthèse sans
  -- période ne dit pas de quoi elle parle.
  period_start date not null,
  period_end date not null,

  /* CE QU'ELLE ÉCRIT, ET QUE PERSONNE N'ÉCRIT À SA PLACE.
   *
   * `means` existe parce que, sans lui, ce qui a été FAIT est représenté par
   * un nombre et ce qui est OBSERVÉ par de la prose. Ce déséquilibre est la
   * cause du glissement vers la lecture comptable, pas sa conséquence : le
   * rythme, la durée, la modalité, ce qui a été travaillé. Écrit par elle —
   * un rythme déduit des dates serait une interprétation. */
  means text,               -- cadre et moyens mis en œuvre
  observed_evolution text,  -- ce qu'elle observe
  adjustments text,         -- ce qu'elle ajuste
  next_step text,           -- la suite proposée

  /* LES OBJECTIFS S'IMPRIMENT, SAUF SI ELLE LE RETIRE.
   *
   * Vrai par défaut : c'est le comportement d'origine, et le retirer d'office
   * priverait le prescripteur de ce qu'il attend. Mais le libellé d'un
   * objectif de prise en soin est ce que ce document divulgue de plus intime,
   * et un organisme payeur n'en a pas le même besoin qu'un médecin. Elle
   * décide, document par document.
   *
   * [D-n] Faut-il que ce défaut DÉPENDE du destinataire ? Le produit ne
   * distingue aujourd'hui aucune catégorie de destinataire ; en créer une est
   * une décision métier et juridique, pas un réglage. Consignée. */
  detail_objectifs boolean not null default true,

  /* Ajoute le compte des rendez-vous non honorés. Faux par défaut.
   *
   * LE NOM DIT « ABSENCES », PAS « ASSIDUITÉ ». Le mot « assiduité » est
   * précisément la lecture que ce document cherche à éviter ; l'inscrire dans
   * le schéma la rendrait durable. */
  detail_absences boolean not null default false,

  status text not null default 'brouillon' check (status in (
    'brouillon', 'emis', 'annule')),
  issued_on date,

  note text,            -- mention visible sur le document
  internal_note text,   -- jamais imprimée
  cancellation_reason text,
  snapshot jsonb,

  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  issued_by uuid references auth.users(id) on delete set null,

  constraint follow_up_periode_ck check (period_end >= period_start),
  constraint follow_up_emission_ck check (
    (status = 'brouillon') = (issued_on is null)),
  constraint follow_up_instantane_ck check (
    (status = 'brouillon') = (snapshot is null)),
  constraint follow_up_annulation_ck check (
    status <> 'annule' or length(btrim(coalesce(cancellation_reason, ''))) > 0)
);
create index idx_follow_up_practice
  on public.follow_up_summaries (practice_id, status, period_end desc);
create index idx_follow_up_patient on public.follow_up_summaries (patient_id);

create trigger follow_up_updated_at before update on public.follow_up_summaries
  for each row execute function app.set_updated_at();

/* QUI A RÉDIGÉ, ET PAS SEULEMENT QUI A SIGNÉ.
 *
 * `created_by` était déclaré et jamais écrit : ni valeur par défaut, ni
 * écriture applicative. Dans un cabinet à plusieurs membres, rien ne disait
 * qui avait rédigé la pièce — `issued_by`, lui, est renseigné par l'émission.
 *
 * `0018` avait posé exactement ce défaut sur `shared_links`, pour exactement
 * cette raison. Les trois autres écrits l'ont manqué ; ils sont rattrapés ici,
 * sur la même ligne. Trouvé par la relecture de sécurité du rang 3. */
alter table public.follow_up_summaries
  alter column created_by set default app.current_user_id();
alter table public.liaison_letters
  alter column created_by set default app.current_user_id();
alter table public.attestations
  alter column created_by set default app.current_user_id();

-- ---------------------------------------------------------------------------
--  Cohérence
-- ---------------------------------------------------------------------------
create or replace function app.guard_follow_up_coherence()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  /* ON REFUSE D'ABORD, ON RENSEIGNE ENSUITE — ET DANS CET ORDRE-LÀ.
   *
   * LE DÉFAUT, démontré par la relecture de sécurité du rang 3 : PostgreSQL
   * exécute les déclencheurs BEFORE ROW *avant* la clause `with check` de la
   * politique RLS. Ce déclencheur est `security definer` : il contourne la
   * RLS et répondait donc le premier. Un compte d'un autre cabinet obtenait
   * alors deux réponses différentes selon le cas —
   *
   *   dossier appartenant AU cabinet visé  → 42501, refus de la RLS
   *   dossier inexistant ou d'un tiers     → 23503, « n'appartient pas »
   *
   * — soit un oracle d'appartenance : avec un identifiant de cabinet et un
   * identifiant candidat, on confirmait le lien sans être membre. Aucun
   * contenu ne fuyait, seulement l'appartenance ; et le scénario réaliste
   * n'est pas l'inconnu — `anon` est refusé au niveau privilège — mais le
   * MEMBRE RÉVOQUÉ, à qui `status <> 'active'` retire toute lecture en lui
   * laissant ce sondage.
   *
   * Ce refus initial ne restreint rien : les politiques d'écriture de cette
   * table exigent déjà `can_write`. Il rend seulement le refus UNIFORME, et
   * antérieur à tout ce qui pourrait le nuancer.
   *
   * IL NE PORTE QUE SUR LES REQUÊTES QUI ONT UNE SESSION, c'est-à-dire celles
   * qui viennent du produit — les seules à pouvoir sonder. Sans session, on
   * est en migration, en semence ou en maintenance : il n'y a pas de rôle à
   * vérifier, la RLS ne s'applique pas davantage, et exiger `can_write` ne
   * fermerait rien tout en cassant toute reprise de données.
   *
   * La même lacune existait sur l'attestation et le courrier de liaison :
   * elles sont corrigées plus bas, dans cette même migration. */
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

  /* ON SAIT À QUI ON REMET. Ni destinataire nommé, ni remise au patient, c'est
   * un document qui ne va nulle part — et dont on ne saura pas, dans un an, à
   * qui il a été donné. Même exigence que pour l'attestation. */
  if new.recipient_contact_id is null and not new.recipient_is_patient then
    raise exception 'Indiquez à qui cette synthèse est remise.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;
create trigger follow_up_coherence
  before insert or update on public.follow_up_summaries
  for each row execute function app.guard_follow_up_coherence();

-- ---------------------------------------------------------------------------
--  Immuabilité
-- ---------------------------------------------------------------------------
create or replace function app.guard_issued_follow_up()
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
        'Une synthèse remise s''annule, avec un motif — et une annulation ne se défait pas. Établissez-en une autre.'
        using errcode = 'check_violation';
    end if;
  end if;

  /* LE MOTIF D'ANNULATION SE FIGE À SON TOUR, UNE FOIS POSÉ. C'est la phrase
   * que lit celui qui a reçu la synthèse ; la laisser réécrire indéfiniment
   * revenait à lui raconter, plus tard, une autre histoire de la même
   * annulation. La fonction d'annulation, elle, l'écrit en passant de « emis »
   * à « annule » — ce chemin-là reste ouvert. [Point transverse : la même
   * lacune existe sur l'attestation et le courrier de liaison. Consignée.] */
  if new.cancellation_reason is distinct from old.cancellation_reason
     and new.status <> 'annule' then
    raise exception
      'Un motif d''annulation ne se pose que sur une annulation.'
      using errcode = 'check_violation';
  end if;
  if old.status = 'annule'
     and new.cancellation_reason is distinct from old.cancellation_reason then
    raise exception
      'Le motif d''une annulation ne se réécrit pas : il a déjà été lu.'
      using errcode = 'check_violation';
  end if;

  if new.observed_evolution is distinct from old.observed_evolution
     or new.means is distinct from old.means
     or new.next_step is distinct from old.next_step
     or new.adjustments is distinct from old.adjustments
     or new.period_start is distinct from old.period_start
     or new.period_end is distinct from old.period_end
     or new.issued_on is distinct from old.issued_on
     or new.snapshot is distinct from old.snapshot
     or new.note is distinct from old.note
     or new.detail_absences is distinct from old.detail_absences
     or new.detail_objectifs is distinct from old.detail_objectifs
     or new.patient_id <> old.patient_id
     or new.recipient_contact_id is distinct from old.recipient_contact_id
     or new.recipient_is_patient is distinct from old.recipient_is_patient
     /* CE QUI RATTACHE LA PIÈCE, et qui manquait à cette liste. Le document
      * imprimé ne bougeait pas — il lit l'instantané — mais son IMPUTATION,
      * elle, se déplaçait : à quel cabinet, à quel parcours, qui a signé,
      * quand elle a été créée et par qui. `issued_by` n'a de contrainte que
      * vers `auth.users` : on pouvait y inscrire quelqu'un d'un autre
      * cabinet. Trouvé par la relecture de sécurité du rang 3. */
     /* `practice_id` EST REDONDANT, ET C'EST DIT PLUTÔT QUE SOUS-ENTENDU.
      * Aucun contrôle ne peut l'atteindre seul : déplacer une synthèse vers un
      * autre cabinet bute d'abord sur la garde de cohérence — le rôle n'y écrit
      * pas, ou le dossier n'y appartient pas — et la déplacer AVEC son dossier
      * bute sur `patient_id`. Désarmer cette ligne ne fait échouer aucun
      * contrôle, et j'ai renoncé à en fabriquer un qui ne mettrait en scène que
      * lui. Elle reste comme second verrou : le jour où la cohérence change,
      * c'est elle qui rattrapera. */
     or new.practice_id is distinct from old.practice_id
     or new.pathway_id is distinct from old.pathway_id
     or new.issued_by is distinct from old.issued_by
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception
      'Une synthèse remise ne se modifie pas : elle est déjà entre les mains de son destinataire. Annulez-la, avec un motif, et établissez-en une autre.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger follow_up_immuable
  before update on public.follow_up_summaries
  for each row execute function app.guard_issued_follow_up();

create or replace function app.guard_delete_follow_up()
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
      'Une synthèse remise ne se supprime pas : elle se conserve et s''annule, avec un motif.'
      using errcode = 'check_violation';
  end if;
  return old;
end;
$$;
create trigger follow_up_suppression
  before delete on public.follow_up_summaries
  for each row execute function app.guard_delete_follow_up();

-- ---------------------------------------------------------------------------
--  RLS — contenu clinique
-- ---------------------------------------------------------------------------
alter table public.follow_up_summaries enable row level security;
alter table public.follow_up_summaries force row level security;

create policy follow_up_select on public.follow_up_summaries
  for select to authenticated
  using (practice_id in (select app.mes_cabinets_cliniques()));
create policy follow_up_insert on public.follow_up_summaries
  for insert to authenticated with check (app.can_write(practice_id));
create policy follow_up_update on public.follow_up_summaries
  for update to authenticated
  using (app.can_write(practice_id)) with check (app.can_write(practice_id));
create policy follow_up_delete on public.follow_up_summaries
  for delete to authenticated using (app.can_write(practice_id));

revoke all on public.follow_up_summaries from anon, authenticated;
grant select, insert, update, delete on public.follow_up_summaries to authenticated;

-- ---------------------------------------------------------------------------
--  Les faits de la période — calculés par la base, jamais postés
-- ---------------------------------------------------------------------------
/**
 * Ce que la période contient, en faits vérifiables.
 *
 * ELLE EST APPELÉE DEUX FOIS, ET C'EST VOULU : par l'écran, pour montrer à la
 * praticienne ce qui SERA figé, et par l'émission, qui le fige. Une seule
 * source, donc aucun écart possible entre ce qu'elle a vu et ce qui est parti.
 *
 * ELLE NE CONCLUT RIEN. Des comptes et des libellés. Aucune phrase, aucun
 * écart calculé, aucun objectif requalifié.
 */
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
         and (a.starts_at at time zone 'Europe/Paris')::date between p_from and p_to),

    'annulees_par_le_cabinet', (
      select count(*) from public.appointments a
       where a.patient_id = p_patient_id
         and a.practice_id = v_practice
         and (p_pathway_id is null or a.pathway_id = p_pathway_id)
         and a.kind in ('seance', 'bilan', 'entretien', 'restitution')
         and a.attendance = 'annule_praticien'
         and (a.starts_at at time zone 'Europe/Paris')::date between p_from and p_to),

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
revoke all on function public.follow_up_facts(uuid, uuid, date, date) from public, anon;
grant execute on function public.follow_up_facts(uuid, uuid, date, date) to authenticated;

-- ---------------------------------------------------------------------------
--  L'émission
-- ---------------------------------------------------------------------------
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

  v_emission := coalesce(p_issued_on, current_date);
  if v_emission > current_date then
    raise exception 'Une synthèse ne se date pas du futur.'
      using errcode = 'check_violation';
  end if;
  if s.period_end > current_date then
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
revoke all on function public.issue_follow_up_summary(uuid, date) from public, anon;
grant execute on function public.issue_follow_up_summary(uuid, date) to authenticated;

create or replace function public.cancel_follow_up_summary(
  p_summary_id uuid,
  p_reason text
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  s record;
begin
  select * into s from public.follow_up_summaries where id = p_summary_id;
  if s.id is null or not app.is_member(s.practice_id) then
    raise exception 'Synthèse introuvable.' using errcode = 'no_data_found';
  end if;
  if not app.can_write(s.practice_id) then
    raise exception 'Votre rôle ne permet pas d''annuler une synthèse.'
      using errcode = 'insufficient_privilege';
  end if;
  if s.status <> 'emis' then
    raise exception 'Seule une synthèse remise s''annule.' using errcode = 'check_violation';
  end if;
  if btrim(coalesce(p_reason, '')) = '' then
    raise exception
      'Une annulation sans motif n''apprend rien à qui a reçu la synthèse. Indiquez pourquoi.'
      using errcode = 'check_violation';
  end if;

  update public.follow_up_summaries
     set status = 'annule', cancellation_reason = btrim(p_reason)
   where id = p_summary_id;

  perform public.log_audit_event(
    s.practice_id, 'follow_up_summary.cancel', 'follow_up_summary', p_summary_id, null);
  return p_summary_id;
end;
$$;
revoke all on function public.cancel_follow_up_summary(uuid, text) from public, anon;
grant execute on function public.cancel_follow_up_summary(uuid, text) to authenticated;

-- ============================================================================
--  LA MÊME CORRECTION, SUR LES DEUX ÉCRITS DÉJÀ LIVRÉS
-- ============================================================================
--  L'oracle d'appartenance décrit plus haut n'est pas propre à la synthèse :
--  l'attestation (`0016`) et le courrier de liaison (`0022`) portent le même
--  déclencheur de cohérence, `security definer`, exécuté avant la clause
--  `with check` de la RLS. Les trois répondaient différemment selon que la
--  ressource visée appartenait ou non au cabinet — 42501 dans un cas, 23503
--  dans l'autre.
--
--  C'est UNE décision, pas trois : on la prend ici, en une fois. Les corps
--  sont recopiés à l'identique de leur migration d'origine, à ce refus initial
--  près. C'est la contrepartie assumée d'un `create or replace` : lire `0016`
--  ou `0022` ne montre plus la fonction qui s'exécute.
-- ============================================================================

create or replace function app.guard_attestation_coherence()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- On refuse d'abord, on renseigne ensuite. Voir l'en-tête de cette section.
  if app.current_user_id() is not null
     and not app.can_write(new.practice_id) then
    raise exception 'Accès refusé.' using errcode = 'insufficient_privilege';
  end if;

  if not exists (
    select 1 from public.patients p
    where p.id = new.patient_id and p.practice_id = new.practice_id
  ) then
    raise exception 'Le patient n''appartient pas à ce cabinet.'
      using errcode = 'foreign_key_violation';
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

create or replace function app.guard_liaison_letter_coherence()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- On refuse d'abord, on renseigne ensuite. Voir l'en-tête de cette section.
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

  if not exists (
    select 1 from public.contacts c
     where c.id = new.recipient_contact_id and c.practice_id = new.practice_id
  ) then
    raise exception 'Le destinataire n''appartient pas à ce cabinet.'
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

  return new;
end;
$$;
