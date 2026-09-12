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
  created_by uuid references auth.users(id) on delete set null,

  /* LA VALIDITÉ EST BORNÉE EN BASE, PAS SEULEMENT DANS L'APPLICATION.
   *
   * L'interface propose 7, 30, 90 ou 365 jours. Mais la clé anonyme est
   * publique :
   * qui possède une session peut écrire directement dans l'API et poser
   * l'échéance qu'il veut. Un lien à dix ans, c'est un document de santé
   * accessible sans compte pendant dix ans, à une adresse que personne ne
   * surveille plus.
   *
   * [HYPOTHÈSE — produit, réversible] Le plafond de 400 jours n'est la
   * transposition d'AUCUNE obligation légale : c'est un défaut prudent, choisi
   * pour couvrir un exercice comptable complet et sa marge de relance, et
   * modifiable par une migration. [VALIDATION HUMAINE — DPO] La durée de
   * conservation des liens et de leur journal reste à trancher, comme les
   * autres durées du produit. */
  constraint shared_links_validite_ck check (
    expires_at > created_at
    and expires_at <= created_at + interval '400 days')
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
  v_emetteur text;
begin
  if new.subject_type = 'billing_document' then
    select status, snapshot -> 'cabinet' ->> 'nom'
      into v_statut, v_emetteur
      from public.billing_documents
     where id = new.subject_id and practice_id = new.practice_id;
  else
    select status, snapshot -> 'cabinet' ->> 'nom'
      into v_statut, v_emetteur
      from public.attestations
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

  /* UN DOCUMENT SANS ÉMETTEUR NE SE PARTAGE PAS.
   *
   * Les pièces reprises de la version précédente n'ont pas d'instantané
   * d'émetteur : la reprise a conservé leur numéro, leur date et leur montant,
   * mais la v1 ne portait ni entité juridique ni identifiants professionnels
   * rattachés à la pièce. Partagée telle quelle, une de ces factures donnerait
   * au destinataire une page intitulée « FACTURE », numérotée, datée, avec un
   * montant — et AUCUN nom de cabinet, aucune adresse, aucun identifiant.
   *
   * On ne complète pas l'instantané après coup : ce serait affirmer que
   * l'identité d'aujourd'hui était celle du jour de l'émission. On refuse, et
   * on dit quoi faire.
   *
   * Trouvé par la relecture de sécurité, qui a constaté que le contrôle
   * correspondant fabriquait un instantané complet — il validait sa propre
   * mise en scène au lieu d'une pièce réelle. */
  if v_emetteur is null or btrim(v_emetteur) = '' then
    raise exception
      'Ce document ne porte pas l''identité du cabinet : partagé, il arriverait sans nom, sans adresse et sans identifiant professionnel. Établissez une facture de remplacement, qui figera ces mentions.'
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

/* CE QU'UN LIEN NE PEUT PLUS DEVENIR.
 *
 * La clé anonyme est publique, et un titulaire de session écrit directement
 * dans l'API sans passer par l'application. Tout ce qui n'est pas interdit ici
 * l'est donc seulement par politesse de l'interface.
 *
 * Trois choses sont figées, et la troisième est la moins évidente :
 *
 *  · L'EMPREINTE ET LE DOCUMENT. Changer le jeton d'un lien déjà transmis
 *    reviendrait à en fabriquer un autre sous le même compte rendu d'accès ;
 *    changer le document ferait pointer un lien déjà envoyé vers une autre
 *    pièce, à l'insu de celui qui l'a reçu.
 *
 *  · LA RÉVOCATION NE SE DÉFAIT PAS. Un lien retiré a été retiré pour une
 *    raison — le plus souvent parce qu'il est parti au mauvais destinataire.
 *    Le ressusciter rouvrirait ce qu'on venait de fermer.
 *
 *  · LE COMPTE DES CONSULTATIONS NE RECULE PAS. Ce compteur existe pour
 *    constater qu'un document de santé a circulé, et la seule personne qu'il
 *    pourrait mettre en cause est précisément celle qui a la main sur la
 *    ligne. Un journal qu'on peut remettre à zéro n'est pas un journal.
 */
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

  if old.revoked_at is not null then
    if new.revoked_at is null then
      raise exception
        'Une révocation ne se défait pas. Si ce document doit être transmis de nouveau, créez un nouveau lien : le destinataire saura ainsi qu''il en a reçu un second.'
        using errcode = 'check_violation';
    end if;
    if new.expires_at is distinct from old.expires_at then
      raise exception 'Un lien révoqué ne se prolonge pas.'
        using errcode = 'check_violation';
    end if;
  end if;

  if new.access_count < old.access_count then
    raise exception
      'Le compte des consultations ne recule pas : il constate qu''un document a circulé.'
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
create policy shared_links_insert on public.shared_links
  for insert to authenticated with check (app.can_write(practice_id));
create policy shared_links_update on public.shared_links
  for update to authenticated
  using (app.can_write(practice_id)) with check (app.can_write(practice_id));

/* AUCUNE POLITIQUE DE SUPPRESSION, ET AUCUN PRIVILÈGE `delete`.
 *
 * Un lien ne s'efface pas : il porte le compte rendu de ce qui a été consulté.
 * La première version de ce fichier écrivait « effacer la ligne effacerait la
 * preuve qu'un document a circulé » — et accordait `delete` juste en dessous.
 * Le commentaire était juste, le privilège le contredisait. */

-- Le journal se lit, il ne s'écrit que par la fonction publique. Un journal
-- modifiable depuis l'application ne prouverait rien.
create policy shared_link_accesses_select on public.shared_link_accesses
  for select to authenticated using (app.is_member(practice_id));

revoke all on public.shared_links         from anon, authenticated;
revoke all on public.shared_link_accesses from anon, authenticated;
grant select, insert, update on public.shared_links to authenticated;
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
  v_ecrites integer;
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

  /* LE JOURNAL S'ÉCRIT, OU RIEN N'EST SERVI.
   *
   * `shared_link_accesses` est en RLS forcée et n'a AUCUNE politique
   * d'écriture : l'insertion ne passe que parce que le propriétaire de cette
   * fonction contourne la RLS. C'est vrai sur l'hébergeur d'aujourd'hui — et
   * c'est un attribut de rôle que rien dans ce dépôt ne fixe.
   *
   * S'il venait à changer, l'insertion serait FILTRÉE sans erreur : des
   * documents de santé seraient servis sans laisser de trace, et le compte
   * rendu affirmerait « jamais consulté ». On préfère refuser de servir. */
  insert into public.shared_link_accesses (link_id, practice_id)
  values (l.id, l.practice_id);
  get diagnostics v_ecrites = row_count;
  if v_ecrites = 0 then
    raise exception
      'La consultation n''a pas pu être enregistrée : le document n''est pas servi.'
      using errcode = 'internal_error';
  end if;

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
    -- Profondeur : la lecture ne s'en remet pas au seul contrôle d'écriture.
    -- Une ligne de plus, et elle devient autoportante.
    where d.id = l.subject_id
      and d.practice_id = l.practice_id
      and d.status <> 'brouillon';
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

      /* LE PATIENT EST PROJETÉ, COMME DANS LA BRANCHE FACTURE. Le passe-plat
       * rendait aussi son ADRESSE POSTALE, que la page n'affiche pas mais que
       * la charge transporte. Une attestation part chez un employeur, une
       * mutuelle, une MDPH : c'est eux qui détiennent le lien. Le nom et la
       * date de naissance suffisent à lever une homonymie. */
      'patient', jsonb_build_object(
        'nom', a.snapshot -> 'patient' ->> 'nom',
        'ne_le', a.snapshot -> 'patient' ->> 'ne_le'),

      'seances', a.snapshot -> 'seances',

      /* Le MOYEN de paiement ne sort pas : le document imprimé ne le porte pas
       * davantage, et prouver qu'une somme a été reçue n'exige pas de dire par
       * quel canal. La branche facture s'interdisait déjà le détail des
       * règlements ; celle-ci le laissait passer. */
      'reglements', (select jsonb_agg(jsonb_build_object(
          'date', r ->> 'date', 'montant_centimes', r -> 'montant_centimes'))
        from jsonb_array_elements(
          case when jsonb_typeof(a.snapshot -> 'reglements') = 'array'
               then a.snapshot -> 'reglements' else '[]'::jsonb end) r),

      'factures', a.snapshot -> 'factures',
      'payeurs', a.snapshot -> 'payeurs'
    ) into v_contenu
    from public.attestations a
    where a.id = l.subject_id
      and a.practice_id = l.practice_id
      and a.status <> 'brouillon';
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
