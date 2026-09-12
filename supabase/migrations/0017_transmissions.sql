-- ============================================================================
--  0017 — TRANSMISSIONS : LIENS HACHÉS, RÉVOCABLES, TRACÉS
-- ============================================================================
--  CE QUE LA v1 FAISAIT, ET QU'ON NE REFERA PAS.
--
--   · Le jeton était stocké EN CLAIR sur la facture. Qui lisait la table lisait
--     les liens. Et comme la liste des factures chargeait `select *`, TOUS les
--     jetons du cabinet partaient dans la charge de la page à chaque
--     affichage — vers le navigateur, donc vers son cache et son historique.
--     [A-37]
--   · Aucun lien n'était listé, révocable, ni daté autrement que par une
--     expiration posée à la création. Un lien envoyé par erreur ne se reprenait
--     pas. [A-17]
--   · Aucune consultation n'était tracée. [C-20]
--   · La liste des champs exposés existait EN DOUBLE — une fois en SQL, une
--     fois en TypeScript — sans rien pour les tenir alignées. Le commentaire du
--     code l'admettait : « les deux doivent rester alignées ; TypeScript ne peut
--     pas le vérifier ». [A-27, A-36]
--
--  CONSTAT DE FAIT, vérifié avant d'écrire ce fichier : AUCUN lien de partage
--  n'existe en production. Les neuf factures reprises n'en portent aucun. La
--  raison invoquée en 0011 pour conserver `invoices` — « des liens déjà envoyés
--  y pointent » — était donc fausse. `invoices` reste en place comme filet de
--  retour arrière, au même titre que `patients_v1`, mais sa surface de partage
--  disparaît ici.
--
--  ── CE QUI CHANGE ────────────────────────────────────────────────────────
--
--  1. LE JETON N'EST JAMAIS STOCKÉ. Seule son empreinte SHA-256 l'est. Il est
--     rendu UNE FOIS à qui le crée, et nulle part ailleurs — la base ne peut
--     pas le redonner, et aucune liste ne peut le faire fuiter. Le défaut
--     [A-37] devient structurellement impossible.
--
--  2. UN LIEN SE RÉVOQUE. Il porte aussi une expiration courte. Les trois
--     causes de refus — jeton inconnu, expiré, révoqué — rendent la MÊME
--     réponse : distinguer dirait à qui tâtonne si le jeton a existé.
--
--  3. CHAQUE CONSULTATION EST TRACÉE. Date et lien, rien d'autre : ni adresse
--     IP, ni empreinte de navigateur. Ce qu'on veut savoir, c'est qu'un
--     document a été consulté et combien de fois — pas qui, ni d'où.
--     [VALIDATION HUMAINE — DPO] la durée de conservation de ce journal.
--
--  4. LE CONTENU PUBLIC A UNE SEULE DÉFINITION, ici, en SQL. Le TypeScript ne
--     fait que TYPER ce qui revient ; il ne redresse aucune liste. Et un test
--     plante une valeur sentinelle dans chaque colonne non publique, puis exige
--     qu'aucune ne ressorte par le chemin public. Ajouter une colonne quelque
--     part ne peut donc plus élargir le partage sans que le contrôle échoue.
--
--  ── CE QUI N'EST PAS PUBLIC, ET POURQUOI C'EST VÉRIFIÉ ───────────────────
--
--  L'instantané d'une pièce reprise de la v1 porte les estimations de
--  rétrocession et d'URSSAF, le brut d'origine et la case PCO. Aucune de ces
--  données n'a sa place sur un document remis à une famille :
--   · rétrocession, URSSAF, net, encaissé sont des affaires du cabinet [B-10] ;
--   · le rattachement à une plateforme de coordination est une information de
--     santé, qui ne s'imprime pas [A-40].
--  La projection ci-dessous ne les lit pas, et la sentinelle le prouve.
-- ============================================================================

-- ---------------------------------------------------------------------------
--  Les liens
-- ---------------------------------------------------------------------------
create table public.shared_links (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.practices(id) on delete cascade,

  -- Ce qui est partagé. Deux natures aujourd'hui ; le contrôle de cohérence
  -- ci-dessous refuse tout ce qui n'appartient pas au cabinet.
  subject_type text not null check (subject_type in ('billing_document', 'attestation')),
  subject_id uuid not null,

  /* EMPREINTE SEULE. Le jeton n'existe en clair que le temps de l'afficher à
   * qui le crée. Personne — pas même le propriétaire de la base — ne peut le
   * retrouver ensuite. */
  token_hash text not null unique check (length(token_hash) = 64),

  /* Quatre derniers caractères du jeton, pour reconnaître un lien dans une
   * liste sans jamais le reconstituer. Quatre caractères base64url, c'est
   * moins de 24 bits : ils n'aident en rien à deviner les 256 autres. */
  token_hint text not null check (length(token_hint) <= 8),

  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,

  /* Pour qui ce lien a été fait. C'est ce qui permet de dire, six mois plus
   * tard, à qui on avait donné quoi — et de révoquer le bon. */
  recipient_label text,
  recipient_contact_id uuid references public.contacts(id) on delete set null,

  access_count integer not null default 0,
  last_accessed_at timestamptz,

  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
create index idx_shared_links_practice on public.shared_links (practice_id, created_at desc);
create index idx_shared_links_subject on public.shared_links (subject_type, subject_id);

-- Un lien ne franchit pas la frontière du cabinet, et ne pointe que sur une
-- pièce ÉMISE : partager un brouillon reviendrait à transmettre un document
-- sans numéro ni date, que son destinataire prendrait pour définitif.
create or replace function app.guard_shared_link()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_statut text;
begin
  if new.subject_type = 'billing_document' then
    select status into v_statut from public.billing_documents
     where id = new.subject_id and practice_id = new.practice_id;
  else
    select status into v_statut from public.attestations
     where id = new.subject_id and practice_id = new.practice_id;
  end if;

  if v_statut is null then
    raise exception 'Ce document n''appartient pas à ce cabinet.'
      using errcode = 'foreign_key_violation';
  end if;
  if v_statut = 'brouillon' then
    raise exception
      'Un brouillon ne se partage pas : il n''a ni numéro ni date, et son destinataire le prendrait pour un document définitif.'
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
create trigger shared_links_coherence
  before insert or update on public.shared_links
  for each row execute function app.guard_shared_link();

-- L'empreinte ne se réécrit pas : changer le jeton d'un lien déjà transmis
-- reviendrait à en fabriquer un autre sous le même compte rendu d'accès.
create or replace function app.guard_shared_link_immuable()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.token_hash is distinct from old.token_hash
     or new.subject_id is distinct from old.subject_id
     or new.subject_type is distinct from old.subject_type
     or new.created_at is distinct from old.created_at then
    raise exception
      'Un lien ne change ni de jeton ni de document. Révoquez-le et créez-en un autre.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger shared_links_immuable
  before update on public.shared_links
  for each row execute function app.guard_shared_link_immuable();

-- ---------------------------------------------------------------------------
--  Les consultations
-- ---------------------------------------------------------------------------
--  DATE ET LIEN, RIEN D'AUTRE. Ni adresse IP, ni empreinte de navigateur : ce
--  qu'on veut savoir, c'est qu'un document a été consulté et combien de fois,
--  pas qui l'a ouvert ni d'où. Le destinataire n'a pas de compte et n'a rien
--  demandé ; le tracer plus finement serait le surveiller.
create table public.shared_link_accesses (
  id bigint generated always as identity primary key,
  link_id uuid not null references public.shared_links(id) on delete cascade,
  practice_id uuid not null references public.practices(id) on delete cascade,
  accessed_at timestamptz not null default now()
);
create index idx_shared_link_accesses_link
  on public.shared_link_accesses (link_id, accessed_at desc);
create index idx_shared_link_accesses_practice
  on public.shared_link_accesses (practice_id, accessed_at desc);

-- ---------------------------------------------------------------------------
--  RLS
-- ---------------------------------------------------------------------------
alter table public.shared_links          enable row level security;
alter table public.shared_link_accesses  enable row level security;
alter table public.shared_links          force row level security;
alter table public.shared_link_accesses  force row level security;

create policy shared_links_select on public.shared_links
  for select to authenticated using (app.is_member(practice_id));
create policy shared_links_write on public.shared_links
  for all to authenticated
  using (app.can_write(practice_id)) with check (app.can_write(practice_id));

-- Le journal se lit, il ne s'écrit que par la fonction publique. Un journal
-- modifiable depuis l'application ne prouverait rien.
create policy shared_link_accesses_select on public.shared_link_accesses
  for select to authenticated using (app.is_member(practice_id));

revoke all on public.shared_links         from anon, authenticated;
revoke all on public.shared_link_accesses from anon, authenticated;
grant select, insert, update, delete on public.shared_links to authenticated;
grant select on public.shared_link_accesses to authenticated;

-- ============================================================================
--  LA LECTURE PUBLIQUE
-- ============================================================================
/**
 * Rend le document désigné par un jeton, ou rien.
 *
 * SEULE PORTE OUVERTE SANS COMPTE, avec `handle_new_user` retirée de l'API au
 * lot précédent. Tout ce qui suit est donc écrit en supposant un appelant
 * hostile qui ne possède qu'une chaîne de caractères.
 *
 * TROIS REFUS, UNE SEULE RÉPONSE. Jeton inconnu, expiré ou révoqué rendent
 * `null` sans distinction : dire « ce lien a expiré » à qui tâtonne lui
 * apprendrait qu'il a existé, et pour quel cabinet.
 *
 * CETTE FONCTION EST LA DÉFINITION DU CONTENU PUBLIC. Il n'y en a pas d'autre.
 * Le TypeScript ne fait que typer ce qui revient — c'est ce qui corrige le
 * défaut où deux listes de champs, l'une en SQL, l'autre en TypeScript,
 * devaient rester alignées à la main.
 */
create or replace function public.shared_document(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_hash text;
  l record;
  v_recents integer;
  v_contenu jsonb;
begin
  if p_token is null or length(btrim(p_token)) < 16 then
    return null;
  end if;

  v_hash := encode(sha256(convert_to(p_token, 'UTF8')), 'hex');

  select * into l from public.shared_links
   where token_hash = v_hash
     and revoked_at is null
     and expires_at > now();

  -- Inconnu, expiré, révoqué : indiscernables.
  if l.id is null then
    return null;
  end if;

  /* FREIN. Un jeton légitime qui se met à être appelé des centaines de fois
   * par heure n'est plus une famille qui consulte sa facture. On ne bloque pas
   * l'accès définitivement — le lien reste valide — mais on refuse le service
   * le temps que ça se calme. Ce refus-ci est explicite : il ne se produit
   * qu'après qu'un jeton valide a été présenté. */
  select count(*) into v_recents from public.shared_link_accesses
   where link_id = l.id and accessed_at > now() - interval '1 hour';
  if v_recents >= 120 then
    raise exception
      'Ce lien a été consulté un très grand nombre de fois dans l''heure. Réessayez plus tard.'
      using errcode = 'too_many_connections';
  end if;

  insert into public.shared_link_accesses (link_id, practice_id)
  values (l.id, l.practice_id);
  update public.shared_links
     set access_count = access_count + 1, last_accessed_at = now()
   where id = l.id;

  if l.subject_type = 'billing_document' then
    select jsonb_build_object(
      'nature', 'billing_document',
      'kind', d.kind,
      'numero', d.number,
      'emise_le', d.issued_on,
      'echeance', d.due_on,
      'periode_debut', d.period_start,
      'periode_fin', d.period_end,
      'total_centimes', d.total_cents,
      'mention', d.note,
      'rectifie_numero', d.rectifies_number,
      'rectifie_emise_le', d.rectifies_issued_on,
      'rectification_motif', d.rectification_reason,
      -- Une pièce annulée ou remplacée doit le dire à qui l'ouvre.
      'etat', d.status,

      /* L'INSTANTANÉ EST PROJETÉ, PAS RENDU TEL QUEL. Celui d'une pièce
       * reprise de la v1 porte les estimations de rétrocession et d'URSSAF, le
       * brut d'origine et la case PCO : rien de cela n'a sa place sur un
       * document remis à une famille. */
      'emetteur', jsonb_build_object(
        'cabinet', d.snapshot -> 'cabinet' ->> 'nom',
        'entite', d.snapshot -> 'entite_juridique',
        'identifiants', d.snapshot -> 'identifiants'),
      'destinataire', d.snapshot -> 'payeur',
      'patient', jsonb_build_object('nom', d.snapshot -> 'patient' ->> 'nom'),

      'lignes', (select jsonb_agg(jsonb_build_object(
          'libelle', li.label,
          'intro', li.intro,
          'note', li.note,
          'tarification', li.pricing,
          'prix_unitaire_centimes', li.unit_price_cents,
          'quantite', li.quantity,
          'montant_centimes', li.amount_cents,
          'dates', li.service_dates,
          'rendu_dates', li.date_render,
          'tva', li.vat_treatment) order by li.position)
        from public.billing_lines li where li.document_id = d.id),

      /* « Acquittée le… » est ce qu'une famille demande le plus souvent. On
       * rend la DATE du dernier règlement imputé, jamais les règlements
       * eux-mêmes : ni moyen de paiement, ni référence de chèque. */
      'acquittee_le', (
        select max(pay.received_on)
          from public.payment_allocations al
          join public.payments pay on pay.id = al.payment_id
         where al.document_id = d.id
           and public.document_balance_cents_interne(d.id) = 0)
    ) into v_contenu
    from public.billing_documents d
    where d.id = l.subject_id;
  else
    select jsonb_build_object(
      'nature', 'attestation',
      'kind', a.kind,
      'numero', a.number,
      'emise_le', a.issued_on,
      'periode_debut', a.period_start,
      'periode_fin', a.period_end,
      'detail_nature', a.detail_nature,
      'mention', a.note,
      'etat', a.status,
      'motif_annulation', a.cancellation_reason,
      'total_centimes', a.total_cents,

      'emetteur', jsonb_build_object(
        'cabinet', a.snapshot -> 'cabinet' ->> 'nom',
        'entite', a.snapshot -> 'entite_juridique',
        'identifiants', a.snapshot -> 'identifiants',
        'praticien', a.snapshot -> 'praticien'),
      'destinataire', a.snapshot -> 'destinataire',
      'patient', a.snapshot -> 'patient',
      'seances', a.snapshot -> 'seances',
      'reglements', a.snapshot -> 'reglements',
      'factures', a.snapshot -> 'factures',
      'payeurs', a.snapshot -> 'payeurs'
    ) into v_contenu
    from public.attestations a
    where a.id = l.subject_id;
  end if;

  return v_contenu;
end;
$$;

/**
 * Solde d'une pièce, SANS contrôle d'appartenance.
 *
 * Elle existe pour un seul appelant : la lecture publique ci-dessus, qui a
 * déjà prouvé son droit en présentant un jeton valide et n'a aucune session.
 * Elle n'est accordée à PERSONNE d'autre — ni `anon`, ni `authenticated` :
 * `public.document_balance_cents`, elle, vérifie l'appartenance et reste la
 * seule porte pour un utilisateur connecté.
 */
create or replace function public.document_balance_cents_interne(p_document_id uuid)
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
revoke all on function public.document_balance_cents_interne(uuid)
  from public, anon, authenticated;

revoke all on function public.shared_document(text) from public;
grant execute on function public.shared_document(text) to anon, authenticated;

-- ============================================================================
--  RETRAIT DE LA SURFACE DE PARTAGE DE LA v1
-- ============================================================================
--  `invoice_by_token` était la dernière fonction appelable sans compte. Elle
--  lisait une table v1 dont AUCUNE ligne ne porte de jeton — vérifié avant
--  d'écrire ce fichier. La retirer ne casse donc aucun lien existant : elle
--  n'ouvrait plus que la porte.
--
--  `invoices` reste en place, comme `patients_v1`, en filet de retour arrière.
--  Seules les colonnes de partage disparaissent : un jeton en clair dans une
--  table est un défaut même quand il est nul.
do $$
begin
  if to_regprocedure('public.invoice_by_token(text)') is not null then
    drop function public.invoice_by_token(text);
  end if;
end
$$;

do $$
begin
  if to_regclass('public.invoices') is not null then
    alter table public.invoices drop column if exists share_token;
    alter table public.invoices drop column if exists share_expires_at;
  end if;
end
$$;
