-- ============================================================================
--  0020 — LE DOCUMENT TRANSMIS PAR LIEN DIT LA MÊME CHOSE QUE L'IMPRIMÉ
-- ============================================================================
--  DEUX VERSIONS D'UNE MÊME PIÈCE NUMÉROTÉE CIRCULAIENT. Pour une profession
--  dont le livrable EST le document, c'est un défaut de fond, pas d'affichage.
--
--  Relevé par la relecture métier du lot 7, et vérifié :
--
--   · UN DEVIS PARTAGÉ ARRIVAIT SANS SA VALIDITÉ. `valid_until` est imprimé
--     sur la version papier — « Valable jusqu'au … » — et n'existait pas dans
--     le contrat public. Or `TITRES_PIECE` prévoit bien « Devis » : un devis
--     se partage, et arrivait donc sans la seule date qui le rend opposable.
--     C'est la correction qui exige cette migration ; les autres ne tiennent
--     qu'à la page.
--   · L'échéance de paiement était projetée et jamais affichée.
--   · La mise en forme des dates de séance choisie par la praticienne était
--     projetée et ignorée.
--   · Le motif d'annulation d'une attestation était projeté et jamais affiché :
--     le destinataire lisait « Cette attestation a été annulée », sans savoir
--     pourquoi, là où l'imprimé le dit.
--
--  ── UN ARBITRAGE ENTRE DEUX RELECTURES ────────────────────────────────────
--
--  La relecture protection des données proposait de RETIRER le motif
--  d'annulation du contrat public, au motif qu'il en sortait sans être affiché.
--  La relecture métier proposait de L'AFFICHER, parce que l'imprimé le porte.
--
--  Les deux visaient le même défaut : une donnée qui quitte la base sans
--  servir. L'afficher le corrige aussi — et mieux : le destinataire d'une
--  attestation annulée a besoin de savoir POURQUOI, la praticienne écrit ce
--  motif en sachant qu'il figure sur le document remis, et deux versions d'une
--  même pièce qui divergent sont un défaut en soi.
--
--  Règle retenue, et appliquée à tout le contrat : rien n'est projeté qui ne
--  soit affiché. Le contrôle du jeu de clés exact la rend vérifiable.
-- ============================================================================

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
      'valable_jusqu_au', d.valid_until,
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
