-- ============================================================================
--  0016 — ATTESTATIONS DE PRÉSENCE ET DE PAIEMENT
-- ============================================================================
--  DEUX DOCUMENTS QUI NE DISENT PAS LA MÊME CHOSE, et que rien ne doit
--  permettre de confondre :
--
--   · L'ATTESTATION DE PRÉSENCE dit que la personne est VENUE, à telles dates.
--     Elle ne dit rien de l'argent.
--   · L'ATTESTATION DE PAIEMENT dit qu'une somme a été REÇUE, au titre de telle
--     période. Elle ne prouve aucune présence.
--
--  Les mélanger produirait un document faux dans les deux sens : une famille
--  qui n'a pas encore payé a bien été présente, et un règlement d'avance
--  n'atteste d'aucune séance.
--
--  ── POURQUOI UNE TABLE À PART, ET NON UNE NATURE DE PLUS DANS
--     `billing_documents` ─────────────────────────────────────────────────
--
--  Une attestation ne porte aucun montant DÛ, n'entre dans aucun total de
--  chiffre d'affaires, ne consomme pas la série des factures et ne se corrige
--  pas par un avoir. L'ajouter au moteur comptable aurait faussé les totaux de
--  période et brouillé le sens de sa numérotation — qui, elle, répond à une
--  exigence de continuité que rien n'impose ici.
--
--  ── CE SUR QUOI ELLES S'APPUIENT, ET C'EST TOUT LE POINT ─────────────────
--
--  Aucune date, aucun montant ne se saisit à la main. Une attestation est
--  RATTACHÉE aux faits qu'elle atteste :
--
--   · présence  → des rendez-vous dont l'issue est « honoré », rattachés au
--                 patient concerné. La vue `realised_sessions` écarte déjà par
--                 construction les créneaux à venir, annulés, non qualifiés et
--                 sans patient ; les gardes ci-dessous le réexigent en écriture.
--   · paiement  → des règlements réellement imputés sur des pièces DE CE
--                 PATIENT, et à hauteur de cette imputation seulement. Un
--                 virement couvrant deux familles ne peut pas être attesté en
--                 entier à l'une d'elles.
--
--  Une attestation dont les dates seraient tapées serait une déclaration sans
--  support. Celle-ci est vérifiable ligne à ligne, dans le dossier.
--
--  ── CE QU'ELLES NE PORTENT PAS ───────────────────────────────────────────
--
--  AUCUN CONTENU CLINIQUE. Ces documents partent chez un employeur, une
--  mutuelle, une MDPH, parfois une administration. Le motif de la demande,
--  l'hypothèse, les notes, le parcours de soin : rien de cela n'est lu par ce
--  fichier, et aucune colonne ne le recopie.
--  [SOURCE] CSP art. L1110-4 (secret professionnel) — le principe est nommé,
--  son application à un document donné reste à valider.
--  [VALIDATION HUMAINE — psychomotricienne en exercice et juriste] : ce qu'une
--  attestation doit et ne doit pas porter n'est pas tranché par ce fichier.
--
--  La NATURE des actes — séance, bilan, entretien — n'est imprimée que si le
--  praticien le demande explicitement. Par défaut, tout est présenté comme une
--  « séance de psychomotricité » : le défaut prudent est celui qui en dit le
--  moins.
--
--  ── QUI PEUT ATTESTER ────────────────────────────────────────────────────
--
--  Attester est un acte professionnel : c'est le nom et le numéro du praticien
--  qui figurent sur le document.
--
--  ÉTAT RÉEL AUJOURD'HUI, et il ne faut pas le présenter autrement :
--  `app.can_write` exclut DÉJÀ les assistants et les comptables. Personne ne
--  peut donc préparer un brouillon sans pouvoir aussi le signer, et le contrôle
--  ajouté ici ne retire aujourd'hui aucun droit à personne.
--
--  Il existe quand même, et séparément, pour deux raisons. D'abord parce que
--  « peut écrire dans le dossier » et « peut signer un document remis à un
--  tiers » sont deux questions différentes, qui se poseront séparément le jour
--  où un assistant obtiendra un droit d'écriture. Ensuite parce qu'une garantie
--  qui repose sur la coïncidence actuelle de deux prédicats disparaît sans
--  bruit le jour où l'un des deux bouge. Un test fige cette coïncidence pour
--  qu'elle ne se défasse pas par inadvertance.
-- ============================================================================

-- ---------------------------------------------------------------------------
--  Qui peut signer une attestation
-- ---------------------------------------------------------------------------
--  Même liste de rôles que `app.can_write` et `app.can_read_clinical`
--  aujourd'hui — la coïncidence est réelle et assumée, pas cachée. Trois
--  questions distinctes s'y posent pourtant : écrire dans le dossier, lire une
--  note clinique, signer un document remis à un tiers. Le jour où les rôles se
--  diversifient, elles doivent pouvoir diverger sans qu'on ait à retrouver tous
--  les appels.
create or replace function app.can_attest(p_practice_id uuid)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select app.has_role(p_practice_id, array['owner', 'practitioner']);
$$;
revoke all on function app.can_attest(uuid) from public, anon;
grant execute on function app.can_attest(uuid) to authenticated;

-- ---------------------------------------------------------------------------
--  Les attestations
-- ---------------------------------------------------------------------------
create table public.attestations (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,

  kind text not null check (kind in ('presence', 'paiement')),

  -- Une attestation concerne TOUJOURS quelqu'un. Pas de document flottant.
  patient_id uuid not null references public.patients(id) on delete restrict,

  /* À qui elle est remise. Le patient lui-même, ou un tiers : un parent, un
   * organisme, un employeur. Ce n'est pas forcément le payeur. */
  recipient_contact_id uuid references public.contacts(id) on delete restrict,
  recipient_is_patient boolean not null default true,

  -- Période attestée. Bornes incluses.
  period_start date,
  period_end date,

  series text,
  number text,
  status text not null default 'brouillon' check (status in (
    'brouillon',   -- modifiable, supprimable, sans numéro
    'emis',        -- numéroté, figé
    'annule'       -- retiré, avec un motif ; l'original est conservé
  )),
  issued_on date,

  /* Imprimer la nature exacte de chaque acte (bilan, entretien, restitution)
   * en dit plus que « séance ». C'est parfois ce qu'on veut, et parfois une
   * information de trop pour le destinataire. Le défaut est le moins disant. */
  detail_nature boolean not null default false,

  -- Totaux tenus par déclencheur, jamais postés par l'application.
  sessions_count integer not null default 0,
  total_cents bigint not null default 0,

  note text,            -- mention visible sur le document
  internal_note text,   -- jamais imprimée
  cancellation_reason text,

  snapshot jsonb,

  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  issued_by uuid references auth.users(id) on delete set null,

  constraint attestations_numero_ck check (
    (status = 'brouillon') = (number is null)),
  constraint attestations_emission_ck check (
    (status = 'brouillon') = (issued_on is null)),
  constraint attestations_periode_ck check (
    period_end is null or period_start is null or period_end >= period_start),
  -- Une annulation dit pourquoi. Sans motif, c'est un document qui disparaît
  -- sans explication pour qui en détient une copie.
  constraint attestations_annulation_ck check (
    status <> 'annule' or length(btrim(coalesce(cancellation_reason, ''))) > 0)
);
create index idx_attestations_practice on public.attestations (practice_id, kind, status);
create index idx_attestations_patient on public.attestations (patient_id);
create unique index uq_attestations_numero
  on public.attestations (practice_id, series, number) where number is not null;
create trigger attestations_updated_at before update on public.attestations
  for each row execute function app.set_updated_at();

-- Une attestation ne franchit pas la frontière du cabinet.
create or replace function app.guard_attestation_coherence()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
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
create trigger attestations_coherence
  before insert or update on public.attestations
  for each row execute function app.guard_attestation_coherence();

-- ---------------------------------------------------------------------------
--  Ce que l'attestation de PRÉSENCE atteste
-- ---------------------------------------------------------------------------
create table public.attestation_sessions (
  attestation_id uuid not null references public.attestations(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete restrict,
  practice_id uuid not null references public.practices(id) on delete cascade,
  primary key (attestation_id, appointment_id)
);
create index idx_attestation_sessions_rdv on public.attestation_sessions (appointment_id);
create index idx_attestation_sessions_practice on public.attestation_sessions (practice_id);

/**
 * Trois conditions, et aucune n'est superflue.
 *
 * 1. Le rendez-vous appartient à ce cabinet.
 * 2. Son issue est « honoré ». Attester la présence d'une séance annulée ou
 *    d'un créneau non qualifié serait attester ce qui n'a pas eu lieu.
 * 3. IL CONCERNE LE PATIENT DE L'ATTESTATION. Sans ce contrôle, on pourrait
 *    attester les séances de quelqu'un d'autre — c'est-à-dire révéler à un
 *    tiers qu'une autre personne est suivie.
 *
 * La nature de l'acte est restreinte aux contacts de soin : une réunion
 * d'équipe ou un temps administratif n'est pas une présence du patient.
 */
create or replace function app.guard_attestation_session()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_patient uuid;
  a record;
begin
  select at.patient_id into v_patient
    from public.attestations at
   where at.id = new.attestation_id and at.practice_id = new.practice_id;
  if v_patient is null then
    raise exception 'Cette attestation n''appartient pas à ce cabinet.'
      using errcode = 'foreign_key_violation';
  end if;

  select attendance, patient_id, kind into a
    from public.appointments
   where id = new.appointment_id and practice_id = new.practice_id;

  if a.attendance is null then
    raise exception 'Ce rendez-vous n''appartient pas à ce cabinet.'
      using errcode = 'foreign_key_violation';
  end if;
  if a.patient_id is distinct from v_patient then
    raise exception 'Ce rendez-vous concerne un autre patient.'
      using errcode = 'foreign_key_violation';
  end if;
  if a.attendance <> 'honore' then
    raise exception
      'Seule une séance dont l''issue est « honoré » peut être attestée. Renseignez-la d''abord.'
      using errcode = 'check_violation';
  end if;
  if a.kind not in ('seance', 'bilan', 'entretien', 'restitution') then
    raise exception
      'Ce créneau n''est pas un temps de soin : il ne peut pas attester d''une présence.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;
create trigger attestation_sessions_guard
  before insert or update on public.attestation_sessions
  for each row execute function app.guard_attestation_session();

-- ---------------------------------------------------------------------------
--  Ce que l'attestation de PAIEMENT atteste
-- ---------------------------------------------------------------------------
create table public.attestation_payments (
  attestation_id uuid not null references public.attestations(id) on delete cascade,
  payment_id uuid not null references public.payments(id) on delete restrict,
  practice_id uuid not null references public.practices(id) on delete cascade,
  -- Part du règlement attestée pour CE patient. Un virement couvrant deux
  -- familles ne s'atteste pas en entier à l'une d'elles.
  amount_cents bigint not null check (amount_cents > 0),
  primary key (attestation_id, payment_id)
);
create index idx_attestation_payments_reglement on public.attestation_payments (payment_id);
create index idx_attestation_payments_practice on public.attestation_payments (practice_id);

/**
 * Le montant attesté ne peut pas dépasser ce qui a RÉELLEMENT été imputé sur
 * les pièces de ce patient.
 *
 * C'est ce qui empêche d'attester à une famille un argent reçu d'une autre.
 * Un règlement non imputé — un acompte en attente — n'atteste de rien non
 * plus : il n'est rattaché à aucune prestation.
 */
create or replace function app.guard_attestation_payment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_patient uuid;
  v_impute bigint;
begin
  select at.patient_id into v_patient
    from public.attestations at
   where at.id = new.attestation_id and at.practice_id = new.practice_id;
  if v_patient is null then
    raise exception 'Cette attestation n''appartient pas à ce cabinet.'
      using errcode = 'foreign_key_violation';
  end if;

  if not exists (
    select 1 from public.payments p
    where p.id = new.payment_id and p.practice_id = new.practice_id
  ) then
    raise exception 'Ce règlement n''appartient pas à ce cabinet.'
      using errcode = 'foreign_key_violation';
  end if;

  select coalesce(sum(a.amount_cents), 0) into v_impute
    from public.payment_allocations a
    join public.billing_documents d on d.id = a.document_id
   where a.payment_id = new.payment_id
     and d.patient_id = v_patient
     and d.kind <> 'devis';

  if v_impute = 0 then
    raise exception
      'Ce règlement n''est imputé sur aucune facture de ce patient : il n''atteste d''aucun paiement le concernant.'
      using errcode = 'check_violation';
  end if;
  if new.amount_cents > v_impute then
    raise exception
      'Le montant attesté (% centimes) dépasse ce qui a été imputé sur les factures de ce patient (% centimes).',
      new.amount_cents, v_impute using errcode = 'check_violation';
  end if;

  return new;
end;
$$;
create trigger attestation_payments_guard
  before insert or update on public.attestation_payments
  for each row execute function app.guard_attestation_payment();

-- ---------------------------------------------------------------------------
--  Les totaux suivent leurs rattachements
-- ---------------------------------------------------------------------------
--  Recalculés par la base, comme le total d'une facture : un nombre de séances
--  posté par le client serait un nombre que personne n'a vérifié.
create or replace function app.recompute_attestation_totals()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid := coalesce(new.attestation_id, old.attestation_id);
begin
  update public.attestations at
     set sessions_count = coalesce(
           (select count(*) from public.attestation_sessions s
             where s.attestation_id = v_id), 0),
         total_cents = coalesce(
           (select sum(p.amount_cents) from public.attestation_payments p
             where p.attestation_id = v_id), 0)
   where at.id = v_id;
  return coalesce(new, old);
end;
$$;
create trigger attestation_sessions_totaux
  after insert or update or delete on public.attestation_sessions
  for each row execute function app.recompute_attestation_totals();
create trigger attestation_payments_totaux
  after insert or update or delete on public.attestation_payments
  for each row execute function app.recompute_attestation_totals();

-- ---------------------------------------------------------------------------
--  Une attestation émise ne bouge plus
-- ---------------------------------------------------------------------------
--  Elle est entre les mains d'un tiers. La corriger en silence produirait deux
--  documents contradictoires portant le même numéro. Une erreur s'annule, avec
--  un motif, et s'attestera à nouveau.
create or replace function app.guard_issued_attestation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.status = 'brouillon' then
    return new;
  end if;

  -- Seule l'annulation reste possible sur une attestation émise.
  if new.status = 'annule' and old.status = 'emis'
     and new.number is not distinct from old.number
     and new.snapshot is not distinct from old.snapshot
     and new.patient_id = old.patient_id then
    return new;
  end if;

  if new.number is distinct from old.number
     or new.series is distinct from old.series
     or new.kind is distinct from old.kind
     or new.issued_on is distinct from old.issued_on
     or new.snapshot is distinct from old.snapshot
     or new.patient_id is distinct from old.patient_id
     or new.recipient_contact_id is distinct from old.recipient_contact_id
     or new.detail_nature is distinct from old.detail_nature
     or new.note is distinct from old.note then
    raise exception
      'Une attestation émise ne se modifie pas : elle est déjà entre les mains de son destinataire. Annulez-la, avec un motif, et établissez-en une nouvelle.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger attestations_immuable
  before update on public.attestations
  for each row execute function app.guard_issued_attestation();

create or replace function app.guard_delete_attestation()
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
      'Une attestation émise ne se supprime pas : annulez-la, avec un motif. Quelqu''un en détient peut-être une copie.'
      using errcode = 'check_violation';
  end if;
  return old;
end;
$$;
create trigger attestations_non_supprimable
  before delete on public.attestations
  for each row execute function app.guard_delete_attestation();

-- Les rattachements d'une attestation émise sont verrouillés avec elle : ce
-- sont eux qui portent la preuve de ce qu'elle affirme.
create or replace function app.guard_issued_attestation_links()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
begin
  select status into v_status from public.attestations
   where id = coalesce(new.attestation_id, old.attestation_id);
  if v_status is null or v_status = 'brouillon' then
    return coalesce(new, old);
  end if;
  raise exception
    'Ce que cette attestation atteste ne se modifie plus : elle a été émise.'
    using errcode = 'check_violation';
end;
$$;
create trigger attestation_sessions_immuables
  before insert or update or delete on public.attestation_sessions
  for each row execute function app.guard_issued_attestation_links();
create trigger attestation_payments_immuables
  before insert or update or delete on public.attestation_payments
  for each row execute function app.guard_issued_attestation_links();

-- ---------------------------------------------------------------------------
--  RLS
-- ---------------------------------------------------------------------------
alter table public.attestations         enable row level security;
alter table public.attestation_sessions enable row level security;
alter table public.attestation_payments enable row level security;
alter table public.attestations         force row level security;
alter table public.attestation_sessions force row level security;
alter table public.attestation_payments force row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'attestations', 'attestation_sessions', 'attestation_payments'
  ]
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated
         using (app.is_member(practice_id))', t || '_select', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (app.can_write(practice_id)) with check (app.can_write(practice_id))',
      t || '_write', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format(
      'grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end
$$;

-- ============================================================================
--  ÉMISSION
-- ============================================================================
/**
 * Émet une attestation : la valide, la numérote, et FIGE ce qu'elle affirme.
 *
 * L'INSTANTANÉ EST LE CŒUR DU DISPOSITIF. Un rendez-vous peut être requalifié
 * plus tard, un patient changer d'adresse, un praticien changer de numéro
 * professionnel. L'attestation déjà remise, elle, ne change pas : elle porte
 * ce qui était vrai le jour où elle a été signée, et doit pouvoir se
 * réimprimer à l'identique des années après.
 *
 * Elle fige aussi les DATES ATTESTÉES elles-mêmes. Le rattachement aux
 * rendez-vous reste, et c'est lui qui rend l'attestation vérifiable dans le
 * dossier ; mais le document, lui, ne dépend plus de leur relecture.
 */
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
begin
  select * into a from public.attestations where id = p_attestation_id;
  if a.id is null then
    raise exception 'Attestation introuvable.' using errcode = 'no_data_found';
  end if;

  /* ATTESTER EST UN ACTE PROFESSIONNEL. Un assistant administratif peut
   * préparer le brouillon ; seul un praticien le signe. C'est son nom et son
   * numéro qui figureront sur le document. */
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

  v_emission := coalesce(p_issued_on, current_date);

  /* ON NE SIGNE PAS DANS LE FUTUR, ni avant le dernier fait attesté.
   *
   * Rien ne bornait cette date, et la série se calcule sur son année : on
   * pouvait signer au 1er janvier une attestation listant des séances de juin,
   * ou dater de l'an prochain. Une attestation antidatée ne vaut rien pour qui
   * la reçoit, et une attestation postdatée n'est pas encore un document. */
  if v_emission > current_date then
    raise exception 'Une attestation ne se signe pas à une date future.'
      using errcode = 'check_violation';
  end if;

  select max(x.jour) into v_dernier from (
    select (ap.starts_at at time zone 'Europe/Paris')::date as jour
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
              and (ap.starts_at at time zone 'Europe/Paris')::date < a.period_start)
          or (a.period_end is not null
              and (ap.starts_at at time zone 'Europe/Paris')::date > a.period_end))
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
        'date', (ap.starts_at at time zone 'Europe/Paris')::date,
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
revoke all on function public.issue_attestation(uuid, date) from public, anon;
grant execute on function public.issue_attestation(uuid, date) to authenticated;

/**
 * Annule une attestation émise, avec un motif.
 *
 * Elle n'est pas supprimée : quelqu'un en détient peut-être une copie, et
 * faire disparaître le document ferait disparaître la trace de ce qui a été
 * affirmé. Elle reste consultable, marquée annulée, avec la raison.
 */
create or replace function public.cancel_attestation(
  p_attestation_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  a record;
begin
  select * into a from public.attestations where id = p_attestation_id;
  if a.id is null then
    raise exception 'Attestation introuvable.' using errcode = 'no_data_found';
  end if;
  if not app.can_attest(a.practice_id) then
    raise exception 'Seul un praticien du cabinet peut annuler une attestation.'
      using errcode = 'insufficient_privilege';
  end if;
  if a.status <> 'emis' then
    raise exception 'Seule une attestation émise peut être annulée.'
      using errcode = 'check_violation';
  end if;
  if length(btrim(coalesce(p_reason, ''))) = 0 then
    raise exception
      'Indiquez pourquoi cette attestation est annulée : son destinataire peut en détenir une copie.'
      using errcode = 'check_violation';
  end if;

  update public.attestations
     set status = 'annule', cancellation_reason = btrim(p_reason)
   where id = a.id;

  insert into public.audit_events
    (practice_id, actor_user_id, action, subject_type, subject_id, metadata)
  values (a.practice_id, app.current_user_id(), 'attestation.cancel',
          'attestation', a.id, jsonb_build_object('numero', a.number));
end;
$$;
revoke all on function public.cancel_attestation(uuid, text) from public, anon;
grant execute on function public.cancel_attestation(uuid, text) to authenticated;
