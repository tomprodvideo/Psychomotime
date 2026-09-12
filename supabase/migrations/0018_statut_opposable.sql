-- ============================================================================
--  0018 — UN STATUT QUI NE PEUT PLUS MENTIR
-- ============================================================================
--  LE DÉFAUT, ET IL EST DE MOI. Le lot 7 a promu `status` au rang de contrôle
--  de sécurité : c'est la SEULE entrée du bandeau « Cette facture a été annulée
--  par un avoir » que voit le destinataire d'un lien. Mais aucune des deux
--  gardes d'immuabilité — celle des pièces comptables, celle des attestations —
--  ne mentionnait cette colonne. Elles verrouillaient le numéro, la série, la
--  date, l'instantané, le patient… et laissaient le statut libre.
--
--  Démontré en exécution, session authentifiée ordinaire :
--
--    A. état servi au départ      : emis
--    B. emis -> annule_par_avoir  : ACCEPTÉ — état servi : annule_par_avoir
--    C. annule_par_avoir -> emis  : ACCEPTÉ — état servi : emis
--    D. un avoir existe-t-il ?    : NON
--
--  Une facture parfaitement valide arrivait donc chez une mutuelle barrée d'un
--  bandeau d'annulation, sans qu'aucun avoir n'existe — ou l'inverse, une
--  facture annulée arrivait comme si elle valait encore. Rien n'était tracé :
--  un `update` direct n'écrit aucun événement.
--
--  Sur les attestations, `annule -> emis` passait aussi, et le motif
--  d'annulation restait en base : la pièce servie se contredisait elle-même.
--
--  ── LA FORME DE LA CORRECTION ─────────────────────────────────────────────
--
--  La garde ne demande pas QUI écrit. Elle demande si LE FAIT ANNONCÉ EST VRAI.
--
--  Une pièce ne peut passer à « annulée par avoir » que s'il existe vraiment un
--  avoir émis qui la rectifie ; à « remplacée » que s'il existe vraiment une
--  pièce de remplacement émise. C'est plus robuste qu'un drapeau de session
--  posé par les fonctions légitimes : un drapeau se pose, un fait se constate.
--  Et cela n'exige aucune modification des fonctions d'émission — elles créent
--  la pièce rectificative AVANT de toucher au statut de la cible, donc le fait
--  est déjà vrai quand la garde le vérifie.
--
--  Trouvé par la seconde relecture de sécurité du lot 7.
-- ============================================================================

-- ---------------------------------------------------------------------------
--  1. Le statut d'une pièce comptable émise
-- ---------------------------------------------------------------------------
create or replace function app.guard_issued_document()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.status = 'brouillon' then
    return new;   -- un brouillon se modifie librement
  end if;

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

  /* LE STATUT NE SE POSE PAS : IL SE CONSTATE.
   *
   * Les deux seules évolutions admises disent chacune qu'une autre pièce
   * existe. On vérifie qu'elle existe pour de bon. Une pièce ne peut donc plus
   * se déclarer annulée sans avoir, ni redevenir valide après l'avoir été. */
  if new.status is distinct from old.status then
    if new.status = 'annule_par_avoir' then
      if not exists (
        select 1 from public.billing_documents av
         where av.rectifies_id = old.id
           and av.kind = 'avoir'
           and av.status <> 'brouillon'
      ) then
        raise exception
          'Aucun avoir n''annule cette pièce : elle ne peut pas se déclarer annulée. Établissez l''avoir, et le statut suivra.'
          using errcode = 'check_violation';
      end if;

    elsif new.status = 'remplace' then
      if not exists (
        select 1 from public.billing_documents r
         where r.rectifies_id = old.id
           and r.kind <> 'avoir'
           and r.status <> 'brouillon'
      ) then
        raise exception
          'Aucune pièce de remplacement n''a été émise : celle-ci ne peut pas se déclarer remplacée.'
          using errcode = 'check_violation';
      end if;

    else
      raise exception
        'Le statut d''une pièce émise ne se modifie pas à la main. Une pièce s''annule par un avoir, ou se remplace par une nouvelle pièce.'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
--  2. Le statut d'une attestation émise
-- ---------------------------------------------------------------------------
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

  /* Seule l'annulation reste possible, elle EXIGE UN MOTIF, et elle ne se
   * défait pas. Sans cette dernière phrase, une attestation annulée redevenait
   * « émise » tout en gardant son motif d'annulation en base : le document
   * servi au destinataire se contredisait lui-même. */
  if new.status is distinct from old.status then
    if not (old.status = 'emis' and new.status = 'annule') then
      raise exception
        'Une attestation émise s''annule, avec un motif — et une annulation ne se défait pas. Établissez-en une nouvelle.'
        using errcode = 'check_violation';
    end if;
    /* Le MOTIF n'est pas vérifié ici : `attestations_annulation_ck` l'exige
     * déjà au niveau de la table, et une contrainte de table se déclenche
     * avant qu'on puisse la doubler utilement. Le contrôle correspondant
     * existe désormais — il n'en existait aucun — et c'est la contrainte
     * qu'il exerce. Dupliquer la règle ici ne l'aurait pas renforcée : elle
     * n'aurait simplement jamais pu se déclencher. */
  end if;

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

-- ---------------------------------------------------------------------------
--  3. Qui a transmis, qui a retiré
-- ---------------------------------------------------------------------------
--  Les deux colonnes existaient avec une intention écrite — « savoir, six mois
--  plus tard, à qui on avait donné quoi » — et rien ne les renseignait. Le
--  modèle admet plusieurs membres par cabinet : sans elles, rien sur la ligne
--  ne dit qui a transmis un document de santé.
alter table public.shared_links
  alter column created_by set default app.current_user_id();

-- ---------------------------------------------------------------------------
--  4. La lecture publique : bornée, et journalisée pour ce qui est servi
-- ---------------------------------------------------------------------------
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
  /* L'ENTRÉE EST BORNÉE DES DEUX CÔTÉS.
   *
   * Elle ne l'était que par le bas. Cette fonction est accordée à `anon` et la
   * clé anonyme est publique : n'importe qui peut l'appeler directement, sans
   * compte. Mesuré sur la base locale — un jeton invalide de 43 caractères
   * coûte 9,6 µs, le même de 8 Mo coûte 23,3 ms : un facteur 2 400, offert à
   * qui veut, sur la base qui sert les dossiers.
   *
   * Un jeton fait 43 caractères base64url. Au-delà de 128, ce n'est pas un
   * jeton qu'on nous présente. */
  if p_token is null or length(p_token) not between 16 and 128 then
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

  /* FREIN. Un jeton légitime appelé des centaines de fois par heure n'est plus
   * une famille qui consulte sa facture. On ne bloque pas le lien — il reste
   * valide — on refuse le service le temps que ça se calme. */
  select count(*) into v_recents from public.shared_link_accesses
   where link_id = l.id and accessed_at > now() - interval '1 hour';
  if v_recents >= 120 then
    raise exception
      'Ce lien a été consulté un très grand nombre de fois dans l''heure. Réessayez plus tard.'
      using errcode = 'too_many_connections';
  end if;

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
      'etat', d.status,
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
      'acquittee_le', (
        select max(pay.received_on)
          from public.payment_allocations al
          join public.payments pay on pay.id = al.payment_id
         where al.document_id = d.id
           and public.document_balance_cents_interne(d.id) = 0)
    ) into v_contenu
    from public.billing_documents d
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
      'patient', jsonb_build_object(
        'nom', a.snapshot -> 'patient' ->> 'nom',
        'ne_le', a.snapshot -> 'patient' ->> 'ne_le'),
      'seances', a.snapshot -> 'seances',
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

  /* ON JOURNALISE CE QUI EST SERVI, DONC APRÈS L'AVOIR CALCULÉ.
   *
   * L'ordre inverse comptait une consultation même quand rien ne sortait, et
   * le compte rendu du cabinet affirmait alors qu'un document avait circulé.
   *
   * AUCUN CONTRÔLE NE COUVRE CETTE LIGNE, et il faut le dire : je n'ai pas su
   * atteindre l'état qu'elle traite. Un lien valide dont la projection ne rend
   * rien supposerait que la pièce cible ait changé de cabinet ou soit
   * redevenue brouillon — les deux sont refusés — ou qu'un membre appartienne
   * à deux cabinets, ce qu'aucun écran ne permet aujourd'hui. Fabriquer cet
   * état dans un contrôle reviendrait à vérifier une mise en scène. La ligne
   * reste, parce que l'ordre correct ne coûte rien ; elle est présentée pour
   * ce qu'elle est : une précaution non démontrée.
   *
   * La version précédente lisait `row_count` après l'insertion, en expliquant
   * qu'une RLS devenue opposable au propriétaire filtrerait la ligne en
   * silence. C'ÉTAIT FAUX, et vérifié : sur une table en RLS forcée sans
   * politique d'écriture, un `insert` lève `42501`, il ne rend jamais zéro
   * ligne. Le filtrage muet n'existe que pour `update` et `delete`. Le
   * garde-fou ne protégeait donc de rien — l'exception, elle, annule bien tout
   * l'appel, et c'est ce qui reste vrai. */
  if v_contenu is null then
    return null;
  end if;

  insert into public.shared_link_accesses (link_id, practice_id)
  values (l.id, l.practice_id);

  update public.shared_links
     set access_count = access_count + 1, last_accessed_at = now()
   where id = l.id;

  return v_contenu;
end;
$$;
revoke all on function public.shared_document(text) from public;
grant execute on function public.shared_document(text) to anon, authenticated;
