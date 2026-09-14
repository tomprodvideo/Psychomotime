-- ============================================================================
--  0026 — LA SIGNATURE D'UNE ATTESTATION SE DATE AU JOUR DU CABINET
-- ============================================================================
--
--  LE DÉFAUT. `issue_attestation` prenait la date « du jour » de la base pour
--  défaut et refusait toute date qui lui était postérieure (« on ne signe pas
--  dans le futur »). Or cette date se calcule dans le fuseau de la SESSION de
--  la base, pas dans celui du cabinet. Sous une base réglée en UTC, entre minuit
--  et une heure du matin l'hiver — deux heures l'été —, « aujourd'hui » à Paris
--  était encore « demain » pour la base : une attestation datée du jour était
--  refusée comme future, et une attestation sans date recevait la veille.
--
--  CE QUI EN DÉPEND CÔTÉ APPLICATION. La date proposée pour signer est
--  calculée dans le fuseau du cabinet (`lib/dateCivile.ts`) — mais seulement
--  une fois que cette garde l'accepte. Livrer l'application AVANT cette
--  migration ferait refuser des signatures dans cette fenêtre, sur une base en
--  UTC. L'ordre est donc : cette migration d'abord, l'application ensuite.
--
--  RÉTROCOMPATIBLE avec l'application d'avant : elle envoyait la date UTC, qui
--  n'est jamais postérieure au jour d'un cabinet situé à l'est d'UTC. Rien de ce
--  qui était accepté ne devient refusé pour un cabinet en France.
--
--  PÉRIMÈTRE DÉLIBÉRÉMENT RESTREINT. Les quatre écrits cliniques (`0022` à
--  `0025`) portent la même garde ; leur interface ne leur transmet pas de date,
--  l'application ne les expose donc à aucun refus. Ils restent inscrits à
--  `Q-507`, avec les défauts de colonnes et `realised_sessions`.
--
--  CONTRÔLÉ PAR `supabase/tests/150_jour_du_cabinet.sql`, qui fait varier le
--  fuseau de la session dans la transaction ; falsifié par
--  `supabase/falsifications/0026_jour_du_cabinet_attestation.json`.
-- ============================================================================

/**
 * Le jour civil du cabinet — `practices.timezone`, `'Europe/Paris'` par défaut.
 *
 * Indépendant du fuseau de la session : `now()` est un instant, et `at time
 * zone` le convertit explicitement. La colonne n'a aucune contrainte de
 * validité ; un fuseau illisible retombe sur le défaut que la colonne aurait
 * posé, plutôt que de faire échouer une signature.
 *
 * Non exposée : seule une fonction du cabinet l'appelle, sous ses propres
 * droits. Personne n'a à interroger le fuseau d'un cabinet par son identifiant.
 */
create or replace function app.jour_du_cabinet(p_practice_id uuid)
returns date
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_fuseau text;
begin
  select pr.timezone into v_fuseau from public.practices pr where pr.id = p_practice_id;
  begin
    return (now() at time zone coalesce(nullif(btrim(v_fuseau), ''), 'Europe/Paris'))::date;
  exception when invalid_parameter_value then
    return (now() at time zone 'Europe/Paris')::date;
  end;
end;
$$;

revoke all on function app.jour_du_cabinet(uuid) from public, anon, authenticated;

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
