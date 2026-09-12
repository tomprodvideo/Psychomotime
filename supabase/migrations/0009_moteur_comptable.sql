-- ============================================================================
--  0009 — MOTEUR COMPTABLE : CATALOGUE, DEVIS, FACTURES, AVOIRS, PAIEMENTS
-- ============================================================================
--  RÈGLE DE FOND. Tout montant est un ENTIER DE CENTIMES (`bigint`), tout taux
--  un ENTIER DE POINTS DE BASE. Aucun flottant monétaire n'entre dans ce
--  schéma, et `lib/money.ts` en tient l'autre bout. Le défaut corrigé n'est pas
--  théorique : 32,30 € à 25 % donnait 8,07 € au lieu de 8,08 €, et de façon
--  incohérente selon l'ordre de grandeur.
--
--  CE QUE CE FICHIER REND IMPOSSIBLE, et que la v1 permettait :
--
--   · Supprimer une facture émise. Elle se conserve et s'annule — par avoir ou
--     par facture de remplacement. La v1 la supprimait physiquement, sans
--     trace, sans motif, et le compteur ne reculant pas, la série gardait un
--     trou définitif et inexpliqué.
--     [SOURCE] BOI-TVA-DECLA-30-20-20-10 § 90 (continuité) ; LPF art. L102 B
--     (conservation) ; l'existence même du régime de la facture rectificative.
--
--   · Modifier le numéro d'une pièce émise. La v1 reprenait le numéro posté par
--     le client, sans contrôle d'unicité ni de format.
--     [SOURCE] CGI, annexe II, art. 242 nonies A, I, 7° : unicité et chronologie.
--
--   · Retarifer une pièce ancienne. Un instantané immuable des identités, des
--     mentions et de la configuration fiscale est figé à l'émission.
--
--   · Confondre les dates. Prestation, émission, échéance, période de
--     rattachement et encaissement sont cinq dates distinctes. La v1 les
--     déduisait par une cascade de replis où le mois et l'année pouvaient venir
--     de sources différentes.
--
--  [VALIDATION HUMAINE — expert-comptable] Points à trancher, consignés dans
--  `docs/refonte/recherche/03-comptabilite-fiscalite-fr.md` : la remise à zéro
--  annuelle du compteur constitue-t-elle une série « justifiée » au sens du
--  BOFiP § 80 ; l'avoir doit-il partager la série des factures ; le champ
--  d'application du dispositif d'inaltérabilité logicielle (CGI art. 286, I,
--  3° bis) pour une activité entièrement exonérée.
-- ============================================================================

-- ============================================================================
--  CATALOGUE DE PRESTATIONS
-- ============================================================================
--  RÉFÉRENTIEL, pas source de vérité. Une ligne de document en RECOPIE les
--  valeurs à l'enregistrement et ne les relit plus jamais : modifier un tarif
--  ne change aucune pièce déjà établie. C'est cela, l'historisation qui
--  compte — pas un historique de prix que personne ne consulterait.
create table public.service_catalog_items (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,

  label text not null check (length(btrim(label)) > 0),
  unit_price_cents bigint not null default 0 check (unit_price_cents >= 0),

  pricing text not null default 'unitaire'
    check (pricing in ('unitaire', 'forfait')),

  -- Nature de l'acte, pour distinguer ce qui peut nourrir une attestation de
  -- présence de ce qui ne le peut pas.
  nature text not null default 'seance' check (nature in (
    'seance', 'bilan', 'entretien', 'groupe', 'atelier',
    'deplacement', 'forfait', 'autre'
  )),

  -- Phrase imprimée au-dessus des dates. Peut rester vide.
  default_intro text,
  default_date_render text not null default 'liste'
    check (default_date_render in ('liste', 'par_date')),

  -- TVA de la ligne. Par défaut l'exonération des soins : c'est le cas
  -- général du psychomotricien, mais une activité accessoire peut relever
  -- d'une autre qualification, d'où le champ par prestation.
  -- [VALIDATION HUMAINE] expert-comptable.
  vat_treatment text not null default 'exoneration_soins'
    check (vat_treatment in (
      'exoneration_soins', 'franchise_en_base', 'assujetti', 'autre'
    )),
  vat_rate_bp integer not null default 0 check (vat_rate_bp between 0 and 10000),

  active boolean not null default true,
  position integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_service_catalog_practice on public.service_catalog_items (practice_id)
  where active;
create trigger service_catalog_items_updated_at before update on public.service_catalog_items
  for each row execute function app.set_updated_at();

-- ============================================================================
--  COMPTEURS DE NUMÉROTATION
-- ============================================================================
--  Un compteur par (cabinet, série). La série est la portée : un gabarit
--  contenant l'année ouvre une série par an. Un numéro attribué n'est JAMAIS
--  réutilisé, même si le document est ensuite annulé — c'est la propriété que
--  la v1 tenait déjà, et qu'il faut conserver.
create table public.billing_counters (
  practice_id uuid not null references public.practices(id) on delete cascade,
  series text not null,
  last_value integer not null default 0 check (last_value >= 0),
  updated_at timestamptz not null default now(),
  primary key (practice_id, series)
);

/**
 * Réserve le rang suivant d'une série, de façon atomique.
 *
 * `insert … on conflict do update` verrouille la ligne : deux émissions
 * simultanées ne peuvent pas obtenir le même rang. Le test de concurrence le
 * vérifie.
 */
create or replace function app.next_billing_seq(p_practice_id uuid, p_series text)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_next integer;
begin
  insert into public.billing_counters (practice_id, series, last_value)
  values (p_practice_id, p_series, 1)
  on conflict (practice_id, series) do update
    set last_value = public.billing_counters.last_value + 1,
        updated_at = now()
  returning last_value into v_next;
  return v_next;
end;
$$;

-- ============================================================================
--  DOCUMENTS COMMERCIAUX
-- ============================================================================
create table public.billing_documents (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,

  /* Quatre natures, et non un booléen. Un avoir et une facture de remplacement
   * sont des documents émis, numérotés, qui font référence à la pièce qu'ils
   * corrigent — « de façon spécifique et non équivoque » (CGI art. 289, I, 5). */
  kind text not null check (kind in (
    'devis', 'facture', 'facture_de_remplacement', 'avoir'
  )),

  patient_id uuid references public.patients(id) on delete set null,
  pathway_id uuid references public.care_pathways(id) on delete set null,

  /* Le payeur peut n'être NI le patient NI un responsable légal : une
   * grand-mère, un organisme, une plateforme de coordination. La v1 adressait
   * toujours au patient. */
  payer_contact_id uuid references public.contacts(id) on delete restrict,
  payer_is_patient boolean not null default true,

  funding_scheme text check (funding_scheme is null or funding_scheme in (
    'liberal', 'pco', 'mdph', 'etablissement', 'autre'
  )),

  -- Numérotation : nulle tant que le document est un brouillon.
  series text,
  number text,

  status text not null default 'brouillon' check (status in (
    'brouillon',          -- jamais numéroté ; seul état supprimable
    'emis',               -- numéroté, immuable
    'accepte',            -- devis accepté
    'refuse',             -- devis refusé
    'expire',             -- devis périmé
    'remplace',           -- facture remplacée par une facture de remplacement
    'annule_par_avoir'
  )),

  /* CINQ DATES DISTINCTES. La v1 les déduisait par une cascade de replis où
   * l'année et le mois pouvaient venir de sources différentes, et où la date
   * de paiement primait sur celle d'émission — déplaçant rétroactivement une
   * facture d'un mois à l'autre dans tous les totaux déjà consultés. */
  issued_on date,                 -- émission
  due_on date,                    -- échéance de règlement
  period_start date,              -- rattachement comptable
  period_end date,
  valid_until date,               -- validité d'un devis

  -- Rectification. Le numéro ET la date de la pièce d'origine sont FIGÉS ici :
  -- la référence doit rester lisible même si la pièce d'origine bouge.
  rectifies_id uuid references public.billing_documents(id) on delete restrict,
  rectifies_number text,
  rectifies_issued_on date,
  rectification_reason text,

  -- Total, en centimes. Tenu égal à la somme des lignes par déclencheur.
  total_cents bigint not null default 0,

  /* Instantané figé à l'émission : identité de l'émetteur, du payeur, mentions
   * légales, configuration fiscale applicable à cette date. C'est lui qui
   * empêche une pièce ancienne d'être relue avec les paramètres du jour. */
  snapshot jsonb,

  note text,            -- visible sur le document
  internal_note text,   -- jamais imprimée

  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  issued_by uuid references auth.users(id) on delete set null,

  -- Un brouillon n'a pas de numéro ; tout le reste en a un.
  constraint billing_documents_numero_ck check (
    (status = 'brouillon') = (number is null)),
  constraint billing_documents_emission_ck check (
    (status = 'brouillon') = (issued_on is null)),

  -- Une pièce rectificative désigne sa cible sans équivoque : identifiant,
  -- numéro et date. Un devis ne rectifie rien.
  constraint billing_documents_rectification_ck check (
    case
      when kind in ('avoir', 'facture_de_remplacement')
        then rectifies_id is not null
             and rectifies_number is not null
             and rectifies_issued_on is not null
      else rectifies_id is null
    end),

  constraint billing_documents_periode_ck check (
    period_end is null or period_start is null or period_end >= period_start),
  constraint billing_documents_validite_ck check (
    kind = 'devis' or valid_until is null)
);
create index idx_billing_documents_practice
  on public.billing_documents (practice_id, kind, status);
create index idx_billing_documents_patient on public.billing_documents (patient_id);
create index idx_billing_documents_periode
  on public.billing_documents (practice_id, period_start);
create index idx_billing_documents_rectifies on public.billing_documents (rectifies_id);
-- Unicité du numéro par cabinet et par série : c'est l'exigence du 7° du I de
-- l'article 242 nonies A, que la v1 ne portait nulle part.
create unique index uq_billing_documents_numero
  on public.billing_documents (practice_id, series, number) where number is not null;
create trigger billing_documents_updated_at before update on public.billing_documents
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
--  Cohérence : une pièce ne franchit pas la frontière d'un cabinet
-- ---------------------------------------------------------------------------
--  La RLS vérifie que l'AUTEUR appartient au cabinet de la pièce. Elle ne
--  vérifie PAS que le patient, le parcours, le payeur et la pièce rectifiée
--  appartiennent au même cabinet : ce sont des clés étrangères, et une clé
--  étrangère ne connaît pas le locataire.
--
--  Sans ce déclencheur, un identifiant deviné suffisait à facturer le patient
--  d'un autre cabinet. Trouvé par le test d'isolation du moteur comptable.
create or replace function app.guard_billing_document_coherence()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.patient_id is not null and not exists (
    select 1 from public.patients p
    where p.id = new.patient_id and p.practice_id = new.practice_id
  ) then
    raise exception 'Le patient n''appartient pas à ce cabinet.'
      using errcode = 'foreign_key_violation';
  end if;

  if new.pathway_id is not null and not exists (
    select 1 from public.care_pathways c
    where c.id = new.pathway_id
      and c.practice_id = new.practice_id
      and c.patient_id is not distinct from new.patient_id
  ) then
    raise exception 'Le parcours ne correspond pas à ce patient.'
      using errcode = 'foreign_key_violation';
  end if;

  if new.payer_contact_id is not null and not exists (
    select 1 from public.contacts c
    where c.id = new.payer_contact_id and c.practice_id = new.practice_id
  ) then
    raise exception 'Le payeur n''appartient pas à ce cabinet.'
      using errcode = 'foreign_key_violation';
  end if;

  if new.rectifies_id is not null and not exists (
    select 1 from public.billing_documents d
    where d.id = new.rectifies_id and d.practice_id = new.practice_id
  ) then
    raise exception 'La pièce rectifiée n''appartient pas à ce cabinet.'
      using errcode = 'foreign_key_violation';
  end if;

  return new;
end;
$$;
create trigger billing_documents_coherence
  before insert or update on public.billing_documents
  for each row execute function app.guard_billing_document_coherence();

-- Une ligne appartient au cabinet de sa pièce, et à aucun autre.
create or replace function app.guard_billing_line_coherence()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.billing_documents d
    where d.id = new.document_id and d.practice_id = new.practice_id
  ) then
    raise exception 'Cette pièce n''appartient pas à ce cabinet.'
      using errcode = 'foreign_key_violation';
  end if;
  return new;
end;
$$;

-- ============================================================================
--  LIGNES
-- ============================================================================
create table public.billing_lines (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  document_id uuid not null references public.billing_documents(id) on delete cascade,
  position integer not null,

  /* PROVENANCE SEULE. Ne sert jamais à relire le catalogue pour recomposer la
   * ligne : les valeurs ci-dessous en ont été copiées à l'enregistrement et ne
   * bougent plus. */
  catalog_item_id uuid references public.service_catalog_items(id) on delete set null,

  label text not null check (length(btrim(label)) > 0),
  nature text not null default 'seance',
  pricing text not null default 'unitaire' check (pricing in ('unitaire', 'forfait')),
  unit_price_cents bigint not null default 0,
  quantity integer not null default 1 check (quantity >= 1),
  amount_cents bigint not null default 0,

  -- Dates de prestation portées par la ligne, distinctes de la date d'émission.
  service_dates date[] not null default '{}',
  date_render text not null default 'liste'
    check (date_render in ('liste', 'par_date')),

  vat_treatment text not null default 'exoneration_soins',
  vat_rate_bp integer not null default 0 check (vat_rate_bp between 0 and 10000),

  intro text,
  note text,

  unique (document_id, position),
  -- Un forfait vaut pour un bloc : sa quantité est toujours 1.
  constraint billing_lines_forfait_ck check (pricing <> 'forfait' or quantity = 1)
);
create index idx_billing_lines_document on public.billing_lines (document_id, position);
create index idx_billing_lines_practice on public.billing_lines (practice_id);

/**
 * Rattachement d'une ligne aux rendez-vous qu'elle facture.
 *
 * C'est ce lien qui rendra une attestation de présence vérifiable : elle ne
 * pourra s'appuyer que sur des rendez-vous dont l'issue est « honoré ». Sans
 * lui, une attestation reposerait sur des dates saisies à la main.
 */
create table public.billing_line_appointments (
  line_id uuid not null references public.billing_lines(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete restrict,
  practice_id uuid not null references public.practices(id) on delete cascade,
  primary key (line_id, appointment_id)
);
create index idx_billing_line_appointments_rdv
  on public.billing_line_appointments (appointment_id);
create index idx_billing_line_appointments_practice
  on public.billing_line_appointments (practice_id);

-- Un rendez-vous ne se facture que s'il a réellement eu lieu, et s'il est
-- facturable. Une absence non facturable ne produit aucune ligne.
create or replace function app.guard_line_appointment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_attendance text;
  v_billable boolean;
begin
  select attendance, billable into v_attendance, v_billable
    from public.appointments
   where id = new.appointment_id and practice_id = new.practice_id;

  if v_attendance is null then
    raise exception 'Ce rendez-vous n''appartient pas à ce cabinet.'
      using errcode = 'foreign_key_violation';
  end if;
  if v_attendance <> 'honore' then
    raise exception
      'Seul un rendez-vous dont l''issue est « honoré » peut être facturé. Renseignez-le d''abord.'
      using errcode = 'check_violation';
  end if;
  if not v_billable then
    raise exception 'Ce rendez-vous est marqué non facturable.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger billing_line_appointments_guard
  before insert or update on public.billing_line_appointments
  for each row execute function app.guard_line_appointment();

-- ---------------------------------------------------------------------------
--  Le total du document suit ses lignes, toujours
-- ---------------------------------------------------------------------------
--  Recalculé par la base et non par l'application : un total posté par le
--  client ne peut donc pas diverger de ses lignes.
create or replace function app.recompute_document_total()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_doc uuid := coalesce(new.document_id, old.document_id);
begin
  update public.billing_documents d
     set total_cents = coalesce(
           (select sum(l.amount_cents) from public.billing_lines l
             where l.document_id = v_doc), 0)
   where d.id = v_doc;
  return coalesce(new, old);
end;
$$;
create trigger billing_lines_coherence
  before insert or update on public.billing_lines
  for each row execute function app.guard_billing_line_coherence();

create trigger billing_lines_total
  after insert or update or delete on public.billing_lines
  for each row execute function app.recompute_document_total();

-- ---------------------------------------------------------------------------
--  Une pièce émise ne bouge plus
-- ---------------------------------------------------------------------------
create or replace function app.guard_issued_document()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'brouillon' then
    return new;   -- un brouillon se modifie librement
  end if;

  -- Le total suit ses lignes, qui sont elles-mêmes verrouillées : la base a le
  -- droit de le recalculer, pas l'application de le fixer.
  if new.number is distinct from old.number
     or new.series is distinct from old.series
     or new.kind is distinct from old.kind
     or new.issued_on is distinct from old.issued_on
     or new.rectifies_id is distinct from old.rectifies_id
     or new.snapshot is distinct from old.snapshot
     or new.payer_contact_id is distinct from old.payer_contact_id
     or new.patient_id is distinct from old.patient_id then
    raise exception
      'Une pièce émise ne se modifie pas. Corrigez-la par un avoir ou par une facture de remplacement.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger billing_documents_immuable
  before update on public.billing_documents
  for each row execute function app.guard_issued_document();

-- Une pièce émise ne se supprime pas non plus.
create or replace function app.guard_delete_document()
returns trigger
language plpgsql
as $$
begin
  if old.status <> 'brouillon' then
    raise exception
      'Une pièce émise ne se supprime pas : elle se conserve et s''annule par un avoir. Supprimer creuserait un trou définitif dans la numérotation.'
      using errcode = 'check_violation';
  end if;
  return old;
end;
$$;
create trigger billing_documents_non_supprimable
  before delete on public.billing_documents
  for each row execute function app.guard_delete_document();

-- Les lignes d'une pièce émise sont verrouillées avec elle.
--
-- UNE SEULE EXCEPTION, et elle est raisonnée : la perte du lien de PROVENANCE
-- vers le catalogue. `catalog_item_id` ne répond qu'à la question « d'où vient
-- cette ligne ? » ; il ne sort jamais sur le document et ne participe à aucun
-- montant. Retirer une prestation du catalogue est légitime, et le blocage
-- aurait rendu le catalogue immuable dès la première facture émise — ce qui
-- n'était pas le but.
create or replace function app.guard_issued_lines()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
begin
  select status into v_status from public.billing_documents
   where id = coalesce(new.document_id, old.document_id);

  if v_status is null or v_status = 'brouillon' then
    return coalesce(new, old);
  end if;

  -- Effacement du seul lien de provenance : autorisé, car il ne change rien
  -- de ce que la pièce dit.
  if tg_op = 'UPDATE'
     and old.catalog_item_id is not null
     and new.catalog_item_id is null
     and new.label = old.label
     and new.unit_price_cents = old.unit_price_cents
     and new.quantity = old.quantity
     and new.amount_cents = old.amount_cents
     and new.service_dates is not distinct from old.service_dates then
    return new;
  end if;

  raise exception
    'Les lignes d''une pièce émise ne se modifient pas. Corrigez-la par un avoir ou par une facture de remplacement.'
    using errcode = 'check_violation';
end;
$$;
create trigger billing_lines_immuables
  before insert or update or delete on public.billing_lines
  for each row execute function app.guard_issued_lines();

-- ============================================================================
--  PAIEMENTS
-- ============================================================================
--  Un paiement existe par lui-même, puis s'AFFECTE à une ou plusieurs pièces.
--  C'est ce qui permet un règlement groupé, un règlement partiel, et de voir
--  un trop-perçu pour ce qu'il est : une part non affectée.
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,

  payer_contact_id uuid references public.contacts(id) on delete set null,
  received_on date not null default current_date,
  amount_cents bigint not null check (amount_cents <> 0),

  method text not null default 'autre' check (method in (
    'virement', 'cheque', 'especes', 'carte', 'prelevement',
    'tiers_payant', 'autre'
  )),
  reference text,
  note text,

  -- Un remboursement est un paiement négatif : même table, même affectation.
  is_refund boolean not null default false,

  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),

  constraint payments_remboursement_ck check (
    (is_refund and amount_cents < 0) or (not is_refund and amount_cents > 0))
);
create index idx_payments_practice on public.payments (practice_id, received_on desc);
create trigger payments_updated_at before update on public.payments
  for each row execute function app.set_updated_at();

create table public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,
  payment_id uuid not null references public.payments(id) on delete cascade,
  document_id uuid not null references public.billing_documents(id) on delete restrict,
  amount_cents bigint not null check (amount_cents <> 0),
  created_at timestamptz not null default now(),
  unique (payment_id, document_id)
);
create index idx_payment_allocations_document on public.payment_allocations (document_id);
create index idx_payment_allocations_practice on public.payment_allocations (practice_id);

-- La somme affectée ne peut pas dépasser le paiement : ce qui reste est un
-- trop-perçu, visible comme tel, et non une affectation fantôme.
create or replace function app.guard_allocation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_paiement bigint;
  v_affecte bigint;
  v_doc_kind text;
begin
  select amount_cents into v_paiement from public.payments where id = new.payment_id;
  select coalesce(sum(amount_cents), 0) into v_affecte
    from public.payment_allocations
   where payment_id = new.payment_id and id <> coalesce(new.id, gen_random_uuid());

  if abs(v_affecte + new.amount_cents) > abs(v_paiement) then
    raise exception
      'La somme affectée dépasse le montant du règlement. Ce qui reste non affecté est un trop-perçu, et doit le rester.'
      using errcode = 'check_violation';
  end if;

  -- On n'affecte pas un règlement à un brouillon ni à un devis : ni l'un ni
  -- l'autre n'appelle de paiement.
  select kind into v_doc_kind from public.billing_documents
   where id = new.document_id and status <> 'brouillon';
  if v_doc_kind is null then
    raise exception 'On ne peut affecter un règlement qu''à une pièce émise.'
      using errcode = 'check_violation';
  end if;
  if v_doc_kind = 'devis' then
    raise exception 'Un devis n''appelle pas de règlement.'
      using errcode = 'check_violation';
  end if;

  -- Le règlement, la pièce et l'affectation appartiennent au même cabinet.
  if not exists (
    select 1 from public.payments p
    where p.id = new.payment_id and p.practice_id = new.practice_id
  ) or not exists (
    select 1 from public.billing_documents d
    where d.id = new.document_id and d.practice_id = new.practice_id
  ) then
    raise exception 'Le règlement et la pièce doivent appartenir au même cabinet.'
      using errcode = 'foreign_key_violation';
  end if;

  return new;
end;
$$;
create trigger payment_allocations_guard
  before insert or update on public.payment_allocations
  for each row execute function app.guard_allocation();

-- ---------------------------------------------------------------------------
--  Solde d'une pièce
-- ---------------------------------------------------------------------------
--  Calculé, jamais stocké : un solde stocké finit toujours par diverger de ses
--  affectations. Un avoir compte en déduction de la pièce qu'il rectifie.
create or replace function public.document_balance_cents(p_document_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    coalesce((select d.total_cents from public.billing_documents d
               where d.id = p_document_id), 0)
    - coalesce((select sum(a.amount_cents) from public.payment_allocations a
                 where a.document_id = p_document_id), 0)
    - coalesce((select sum(av.total_cents) from public.billing_documents av
                 where av.rectifies_id = p_document_id
                   and av.kind = 'avoir'
                   and av.status <> 'brouillon'), 0);
$$;
revoke all on function public.document_balance_cents(uuid) from public, anon;
grant execute on function public.document_balance_cents(uuid) to authenticated;

-- ============================================================================
--  ÉMISSION
-- ============================================================================
/**
 * Émet une pièce : la valide, lui attribue son numéro, fige son instantané.
 *
 * L'ÉMISSION EST LE POINT DE NON-RETOUR. Avant, tout se modifie ; après, plus
 * rien. C'est pourquoi elle est une opération explicite et non un effet de
 * bord de l'enregistrement — et pourquoi ouvrir un formulaire puis l'abandonner
 * ne consomme aucun numéro.
 */
create or replace function public.issue_billing_document(
  p_document_id uuid,
  p_series text default null,
  p_number_format text default '{AAAA}-{NNN}'
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  d record;
  v_series text;
  v_seq integer;
  v_number text;
  v_lignes integer;
  v_snapshot jsonb;
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

  -- La série sépare les natures : une facture et un avoir ne partagent pas la
  -- même suite de numéros.
  -- [VALIDATION HUMAINE] Le BOFiP admet les séries distinctes « lorsque les
  -- conditions d'exercice le justifient » (§ 80). La justification de cette
  -- séparation, comme celle de la remise à zéro annuelle, est à faire valider.
  v_series := coalesce(
    p_series,
    case d.kind
      when 'devis' then 'DEVIS'
      when 'avoir' then 'AVOIR'
      else 'FACTURE'
    end || '-' || to_char(coalesce(d.issued_on, current_date), 'YYYY'));

  v_seq := app.next_billing_seq(d.practice_id, v_series);

  v_number := replace(
    replace(
      replace(p_number_format, '{AAAA}', to_char(current_date, 'YYYY')),
      '{MM}', to_char(current_date, 'MM')),
    '{NNN}', lpad(v_seq::text, 3, '0'));

  -- Instantané : ce qui vaut à cette date, figé pour toujours. Une pièce
  -- ancienne se relit ainsi avec les paramètres de son époque.
  select jsonb_build_object(
    'emis_le', current_date,
    'cabinet', (select jsonb_build_object('nom', p.name) from public.practices p
                 where p.id = d.practice_id),
    'entite_juridique', (select jsonb_build_object(
        'denomination', le.legal_name, 'forme', le.legal_form,
        'adresse', le.address_line1, 'code_postal', le.postal_code, 'ville', le.city)
      from public.legal_entities le where le.practice_id = d.practice_id limit 1),
    'identifiants', (select jsonb_agg(jsonb_build_object('type', pi.kind, 'valeur', pi.value))
      from public.professional_identifiers pi
      where pi.practice_id = d.practice_id
        and (pi.valid_from is null or pi.valid_from <= current_date)
        and (pi.valid_to is null or pi.valid_to >= current_date)),
    'configuration_fiscale', (select jsonb_build_object(
        'regime_fiscal', fc.tax_regime, 'regime_tva', fc.vat_regime,
        'methode_comptable', fc.accounting_method)
      from public.fiscal_configurations fc
      where fc.practice_id = d.practice_id
        and fc.valid_from <= current_date
        and (fc.valid_to is null or fc.valid_to > current_date)
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
         issued_on = coalesce(issued_on, current_date),
         snapshot = v_snapshot,
         issued_by = app.current_user_id()
   where id = d.id;

  -- Une pièce rectificative marque sa cible : sans quoi l'ancienne serait
  -- comptée deux fois dans les totaux.
  if d.kind = 'avoir' then
    update public.billing_documents set status = 'annule_par_avoir'
     where id = d.rectifies_id and status = 'emis';
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
revoke all on function public.issue_billing_document(uuid, text, text) from public, anon;
grant execute on function public.issue_billing_document(uuid, text, text) to authenticated;

-- ============================================================================
--  ROW LEVEL SECURITY
-- ============================================================================
alter table public.service_catalog_items      enable row level security;
alter table public.billing_counters           enable row level security;
alter table public.billing_documents          enable row level security;
alter table public.billing_lines              enable row level security;
alter table public.billing_line_appointments  enable row level security;
alter table public.payments                   enable row level security;
alter table public.payment_allocations        enable row level security;

alter table public.service_catalog_items      force row level security;
alter table public.billing_counters           force row level security;
alter table public.billing_documents          force row level security;
alter table public.billing_lines              force row level security;
alter table public.billing_line_appointments  force row level security;
alter table public.payments                   force row level security;
alter table public.payment_allocations        force row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'service_catalog_items', 'billing_documents', 'billing_lines',
    'billing_line_appointments', 'payments', 'payment_allocations'
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

-- Le compteur se lit, il ne s'écrit que par `app.next_billing_seq`. Un
-- compteur modifiable à la main permettrait de réattribuer un numéro consommé.
create policy billing_counters_select on public.billing_counters
  for select to authenticated using (app.is_member(practice_id));
revoke all on public.billing_counters from anon, authenticated;
grant select on public.billing_counters to authenticated;
