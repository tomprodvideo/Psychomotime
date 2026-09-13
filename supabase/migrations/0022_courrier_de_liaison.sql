-- ============================================================================
--  0022 — LE COURRIER DE LIAISON
-- ============================================================================
--  RANG 2 DES ÉCRITS MANQUANTS. Une page adressée à UN professionnel nommé —
--  médecin adresseur, orthophoniste, ergothérapeute, pédiatre. Une question,
--  ou un élément à transmettre. Ce n'est pas un compte rendu raccourci.
--
--  Aujourd'hui il s'écrit dans le corps d'un courriel ou dans un traitement de
--  texte : aucune trace au dossier de ce qui a été dit, à qui, ni quand.
--
--  ── L'INCOHÉRENCE QUE CELA CORRIGE ────────────────────────────────────────
--
--  `patient_consents.kind` accepte déjà `partage_professionnels` et
--  `transmission_prescripteur`. LE PRODUIT TRACE DONC LE CONSENTEMENT À UN
--  PARTAGE QU'IL NE SAIT PAS MATÉRIALISER. On enregistre une autorisation pour
--  un geste qui n'existe pas dans le logiciel.
--
--  ── CE QUE CE DOCUMENT N'EST PAS ──────────────────────────────────────────
--
--  Il ne reprend RIEN d'un bilan. Pas de blocs à cocher, pas d'extraction, pas
--  de pièce jointe. Un courrier de liaison qui recopie un bilan n'est plus un
--  courrier de liaison — c'est un compte rendu envoyé à quelqu'un qui n'a
--  peut-être pas à le recevoir. Le corps est écrit par la praticienne, et par
--  elle seule.
--
--  L'écrit destiné à l'école ou à la MDPH, lui, REPREND des éléments — et
--  c'est un autre document, avec d'autres garde-fous. Il n'est pas ici.
--
--  ── PAS DE NUMÉROTATION ───────────────────────────────────────────────────
--
--  Une facture se numérote parce qu'une série doit être continue et
--  vérifiable. Un courrier n'appartient à aucune série : le numéroter
--  donnerait l'apparence d'une pièce opposable à ce qui est une
--  correspondance. Il porte sa date et son destinataire, cela suffit à le
--  retrouver.
--
--  ── CE QUI RESTE À TRANCHER ───────────────────────────────────────────────
--
--  [VALIDATION HUMAINE — psychomotricienne] Faut-il EXIGER qu'un consentement
--  au partage professionnel soit enregistré avant d'émettre ? Le produit se
--  contente aujourd'hui de DIRE ce qu'il sait : consentement enregistré,
--  retiré, ou absent. Bloquer serait inventer une obligation que je ne peux
--  pas sourcer ; taire serait pire. [D-i]
-- ============================================================================

create table public.liaison_letters (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,

  -- Un courrier de liaison concerne TOUJOURS quelqu'un.
  patient_id uuid not null references public.patients(id) on delete restrict,
  pathway_id uuid references public.care_pathways(id) on delete set null,

  /* LE DESTINATAIRE EST OBLIGATOIRE, ET C'EST LA PROPRIÉTÉ QUI DÉFINIT CE
   * DOCUMENT. Un courrier de liaison sans destinataire nommé n'est pas un
   * courrier : c'est une note. La table `patient_notes` existe pour cela. */
  recipient_contact_id uuid not null references public.contacts(id) on delete restrict,

  subject text not null check (length(btrim(subject)) > 0),
  body text not null check (length(btrim(body)) > 0),

  status text not null default 'brouillon' check (status in (
    'brouillon',   -- modifiable, supprimable
    'emis',        -- figé, remis ou transmis
    'annule'       -- retiré, avec un motif ; l'original est conservé
  )),
  issued_on date,

  internal_note text,          -- jamais imprimée
  cancellation_reason text,
  snapshot jsonb,

  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  issued_by uuid references auth.users(id) on delete set null,

  constraint liaison_letters_emission_ck check (
    (status = 'brouillon') = (issued_on is null)),
  constraint liaison_letters_instantane_ck check (
    (status = 'brouillon') = (snapshot is null)),
  -- Une annulation dit pourquoi : sans motif, c'est un document qui disparaît
  -- sans explication pour qui en détient une copie.
  constraint liaison_letters_annulation_ck check (
    status <> 'annule' or length(btrim(coalesce(cancellation_reason, ''))) > 0)
);
create index idx_liaison_letters_practice
  on public.liaison_letters (practice_id, status, issued_on desc);
create index idx_liaison_letters_patient on public.liaison_letters (patient_id);

create trigger liaison_letters_updated_at before update on public.liaison_letters
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
--  Cohérence : tout appartient au même cabinet, et au même dossier
-- ---------------------------------------------------------------------------
create or replace function app.guard_liaison_letter_coherence()
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
create trigger liaison_letters_coherence
  before insert or update on public.liaison_letters
  for each row execute function app.guard_liaison_letter_coherence();

-- ---------------------------------------------------------------------------
--  Immuabilité : un courrier remis ne se réécrit pas
-- ---------------------------------------------------------------------------
--  Même doctrine que les pièces comptables et les attestations. Ce qui est
--  parti chez un confrère est parti : on l'annule avec un motif, et on en
--  écrit un autre.
create or replace function app.guard_issued_liaison_letter()
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
        'Un courrier remis s''annule, avec un motif — et une annulation ne se défait pas. Écrivez-en un autre.'
        using errcode = 'check_violation';
    end if;
  end if;

  if new.subject is distinct from old.subject
     or new.body is distinct from old.body
     or new.issued_on is distinct from old.issued_on
     or new.snapshot is distinct from old.snapshot
     or new.patient_id <> old.patient_id
     or new.recipient_contact_id <> old.recipient_contact_id then
    raise exception
      'Un courrier remis ne se modifie pas : il est déjà entre les mains de son destinataire. Annulez-le, avec un motif, et écrivez-en un autre.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger liaison_letters_immuable
  before update on public.liaison_letters
  for each row execute function app.guard_issued_liaison_letter();

-- Un courrier remis ne se supprime pas non plus.
create or replace function app.guard_delete_liaison_letter()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from public.practices p where p.id = old.practice_id) then
    return old;   -- suppression en cascade du cabinet
  end if;
  if old.status <> 'brouillon' then
    raise exception
      'Un courrier remis ne se supprime pas : il se conserve et s''annule, avec un motif.'
      using errcode = 'check_violation';
  end if;
  return old;
end;
$$;
create trigger liaison_letters_suppression
  before delete on public.liaison_letters
  for each row execute function app.guard_delete_liaison_letter();

-- ---------------------------------------------------------------------------
--  RLS
-- ---------------------------------------------------------------------------
--  UN COURRIER DE LIAISON EST UN CONTENU CLINIQUE. Il se lit donc comme les
--  notes et les objectifs — propriétaire et praticien — et non comme une
--  facture. Un assistant tient un agenda ; il ne lit pas ce qu'on écrit à un
--  confrère sur un patient.
alter table public.liaison_letters enable row level security;
alter table public.liaison_letters force row level security;

create policy liaison_letters_select on public.liaison_letters
  for select to authenticated
  using (practice_id in (select app.mes_cabinets_cliniques()));
create policy liaison_letters_insert on public.liaison_letters
  for insert to authenticated with check (app.can_write(practice_id));
create policy liaison_letters_update on public.liaison_letters
  for update to authenticated
  using (app.can_write(practice_id)) with check (app.can_write(practice_id));
create policy liaison_letters_delete on public.liaison_letters
  for delete to authenticated using (app.can_write(practice_id));

revoke all on public.liaison_letters from anon, authenticated;
grant select, insert, update, delete on public.liaison_letters to authenticated;

-- ---------------------------------------------------------------------------
--  L'émission : le courrier fige ce qu'il porte
-- ---------------------------------------------------------------------------
/**
 * Émet un courrier de liaison.
 *
 * L'INSTANTANÉ EST LA RAISON D'ÊTRE DE CETTE FONCTION. Un courrier remis doit
 * pouvoir se relire dans dix ans tel qu'il a été remis : avec le nom que
 * portait le cabinet ce jour-là, le titre et l'identifiant professionnel du
 * signataire à cette date, et le nom du destinataire tel qu'il était alors.
 * Recalculer ces mentions à l'affichage ferait changer un document déjà parti.
 */
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

  v_emission := coalesce(p_issued_on, current_date);
  if v_emission > current_date then
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
revoke all on function public.issue_liaison_letter(uuid, date) from public, anon;
grant execute on function public.issue_liaison_letter(uuid, date) to authenticated;

/** Annule un courrier remis. L'original est conservé. */
create or replace function public.cancel_liaison_letter(
  p_letter_id uuid,
  p_reason text
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  l record;
begin
  select * into l from public.liaison_letters where id = p_letter_id;
  if l.id is null or not app.is_member(l.practice_id) then
    raise exception 'Courrier introuvable.' using errcode = 'no_data_found';
  end if;
  if not app.can_write(l.practice_id) then
    raise exception 'Votre rôle ne permet pas d''annuler un courrier.'
      using errcode = 'insufficient_privilege';
  end if;
  if l.status <> 'emis' then
    raise exception 'Seul un courrier remis s''annule.' using errcode = 'check_violation';
  end if;
  /* CE CONTRÔLE NE PEUT PAS REFUSER SEUL — et il reste pour le message.
   *
   * Vérifié par mutation : le désarmer ne fait échouer aucun contrôle, parce
   * que `liaison_letters_annulation_ck` refuse de toute façon un statut
   * « annulé » sans motif. Ce qu'il apporte, c'est une phrase qui dit POURQUOI
   * — là où la contrainte de table ne rendrait qu'un nom de contrainte à
   * quelqu'un qui essaie d'annuler un courrier parti chez un confrère. */
  if btrim(coalesce(p_reason, '')) = '' then
    raise exception
      'Une annulation sans motif n''apprend rien à qui a reçu le courrier. Indiquez pourquoi.'
      using errcode = 'check_violation';
  end if;

  update public.liaison_letters
     set status = 'annule', cancellation_reason = btrim(p_reason)
   where id = p_letter_id;

  perform public.log_audit_event(
    l.practice_id, 'liaison_letter.cancel', 'liaison_letter', p_letter_id, null);
  return p_letter_id;
end;
$$;
revoke all on function public.cancel_liaison_letter(uuid, text) from public, anon;
grant execute on function public.cancel_liaison_letter(uuid, text) to authenticated;
