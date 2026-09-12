-- ============================================================================
--  0014 — LE SOLDE NE FRANCHIT PLUS LA FRONTIÈRE DU CABINET,
--  ET UN AVOIR PARTIEL N'ANNULE PLUS TOUTE LA FACTURE
-- ============================================================================
--  Deux défauts trouvés par la relecture du lot 5, dont le premier a été
--  DÉMONTRÉ EN EXÉCUTION contre la base locale.
--
--  ── 1. Le solde fuyait ────────────────────────────────────────────────────
--
--  `public.document_balance_cents` est `security definer` : elle s'exécute avec
--  les droits de son propriétaire, donc au-dessus de la RLS. Elle était
--  accordée à `authenticated` SANS AUCUN CONTRÔLE DE CABINET.
--
--  Le scénario, rejoué : un membre du cabinet A demande la pièce du cabinet B.
--    · `select` sur `billing_documents` → 0 ligne. La RLS refuse.
--    · `select` sur `billing_lines`     → 0 ligne. La RLS refuse.
--    · `document_balance_cents(pièce B)` → 9 000 centimes. LA FUITE.
--
--  Il faut connaître l'identifiant de la pièce — il n'est pas devinable, mais il
--  circule dans l'URL, donc dans un historique de navigation, une capture
--  d'écran ou un ticket de support. Ce n'est pas un accès de masse ; c'est une
--  levée de confidentialité sur cible connue, et elle suffit.
--
--  LA LEÇON, et elle est plus large que ce correctif : le fichier 0009 énonçait
--  lui-même la bonne doctrine — « une clé étrangère ne connaît pas le
--  locataire » — et l'appliquait à cinq déclencheurs. Une fonction
--  `security definer` ne le connaît pas davantage, sauf si on le lui dit.
--  `issue_billing_document` le disait ; celle-ci l'avait oublié.
--
--  ── 2. Un avoir de 20 € faisait disparaître 180 € ─────────────────────────
--
--  À l'émission d'un avoir, la pièce corrigée passait en « annulée par avoir »
--  QUEL QUE SOIT LE MONTANT de l'avoir. Or l'interface propose explicitement
--  d'ajuster les lignes pour faire un avoir partiel.
--
--  Une facture de 180 € corrigée de 20 € sortait donc entièrement du chiffre
--  d'affaires. Le mois perdait 180 € pour une erreur de 20 €.
--
--  Désormais une pièce n'est marquée annulée que lorsque les avoirs émis la
--  couvrent entièrement. En dessous, elle reste émise, et l'avoir se déduit —
--  ce qui est déjà ce que `document_balance_cents` calculait.
-- ============================================================================

-- ---------------------------------------------------------------------------
--  1. Le solde, cloisonné
-- ---------------------------------------------------------------------------
--  `stable` et non `sql` pur : il faut pouvoir lever une exception.
create or replace function public.document_balance_cents(p_document_id uuid)
returns bigint
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_practice uuid;
begin
  select practice_id into v_practice
    from public.billing_documents where id = p_document_id;

  -- Pièce inexistante et pièce d'un autre cabinet rendent la MÊME réponse :
  -- distinguer les deux dirait à l'appelant que l'identifiant existe.
  if v_practice is null or not app.is_member(v_practice) then
    raise exception 'Pièce introuvable.' using errcode = 'no_data_found';
  end if;

  return
    coalesce((select d.total_cents from public.billing_documents d
               where d.id = p_document_id), 0)
    - coalesce((select sum(a.amount_cents) from public.payment_allocations a
                 where a.document_id = p_document_id), 0)
    - coalesce((select sum(av.total_cents) from public.billing_documents av
                 where av.rectifies_id = p_document_id
                   and av.kind = 'avoir'
                   and av.status <> 'brouillon'), 0);
end;
$$;
revoke all on function public.document_balance_cents(uuid) from public, anon;
grant execute on function public.document_balance_cents(uuid) to authenticated;

-- ---------------------------------------------------------------------------
--  2. L'avoir n'annule que ce qu'il couvre
-- ---------------------------------------------------------------------------
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

  -- La date d'émission est un PARAMÈTRE, pas l'horloge.
  v_emission := coalesce(p_issued_on, current_date);

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
revoke all on function public.issue_billing_document(uuid, text, text, date) from public, anon;
grant execute on function public.issue_billing_document(uuid, text, text, date) to authenticated;

-- ---------------------------------------------------------------------------
--  3. Les trois références croisées qui manquaient à la règle
-- ---------------------------------------------------------------------------
--  0009 posait cinq gardes de cohérence et énonçait la doctrine. Trois
--  références y échappaient. Aucune n'est écrite par l'interface avec une
--  valeur venue du client : l'impact réel est faible, et c'est précisément
--  pour cela qu'il fallait les combler maintenant — une règle appliquée
--  partout sauf à trois endroits n'est plus une règle, c'est un usage.
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
  -- La LIGNE aussi appartient à ce cabinet. C'est ce qui manquait.
  if not exists (
    select 1 from public.billing_lines l
    where l.id = new.line_id and l.practice_id = new.practice_id
  ) then
    raise exception 'Cette ligne n''appartient pas à ce cabinet.'
      using errcode = 'foreign_key_violation';
  end if;

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

create or replace function app.guard_payment_coherence()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.payer_contact_id is not null and not exists (
    select 1 from public.contacts c
    where c.id = new.payer_contact_id and c.practice_id = new.practice_id
  ) then
    raise exception 'Le payeur n''appartient pas à ce cabinet.'
      using errcode = 'foreign_key_violation';
  end if;
  return new;
end;
$$;
create trigger payments_coherence
  before insert or update on public.payments
  for each row execute function app.guard_payment_coherence();

create or replace function app.guard_expense_coherence()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.recurrence_id is not null and not exists (
    select 1 from public.expense_recurrences r
    where r.id = new.recurrence_id and r.practice_id = new.practice_id
  ) then
    raise exception 'Cette charge récurrente n''appartient pas à ce cabinet.'
      using errcode = 'foreign_key_violation';
  end if;
  return new;
end;
$$;
create trigger practice_expenses_coherence
  before insert or update on public.practice_expenses
  for each row execute function app.guard_expense_coherence();
