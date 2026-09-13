/**
 * L'ÉTAT D'UN OBJET, ÉCRIT ET TEINTÉ — dans cet ordre.
 *
 * ── CE QU'IL CENTRALISE ───────────────────────────────────────────────────
 *
 * Quatorze correspondances état → couleur coexistaient, rendues de QUATORZE
 * façons différentes. Le même rôle y était peint à deux forces de teinte selon
 * l'écran où on le lisait : `brand-50` ici et `brand-100` là pour « c'est
 * fait », `amber-50` et `amber-100` pour « vérifiez », `slate-100` et
 * `slate-200` pour « rien n'est engagé ». Personne n'a décidé cela ; c'est le
 * dépôt de sédiment de quinze écrans écrits à des moments différents.
 *
 * ── CE QU'IL NE DÉCIDE PAS ────────────────────────────────────────────────
 *
 * Le rattachement d'un état à un ton reste chez le DOMAINE qui connaît cet
 * état. `Statut` ne sait pas ce qu'est un avoir, ni ce qu'« interrompu »
 * signifie pour un parcours. Chaque domaine pose sa carte à côté de ses
 * libellés ; ce composant ne connaît que six tons.
 *
 * C'est ce qui permet de ne PAS trancher une question ouverte en passant :
 * « annulé » est rendu en rose dans les écrits cliniques et en ambre en
 * comptabilité. Les deux moitiés du produit sont en désaccord sur la
 * réversibilité d'une annulation — une attestation annulée se refait, un écrit
 * clinique annulé engage autre chose. Les deux cartes conservent donc leur ton
 * d'aujourd'hui, et la question reste posée à `expert-metier-psychomotricien`.
 *
 * ── SIX TONS, SIX RENDUS, ET AUCUN « SUCCÈS » ─────────────────────────────
 *
 * Six tons parce qu'il y a six rendus distincts. Une proposition intermédiaire
 * en comptait sept, dont deux — « en cours » et « fait » — peints exactement
 * pareil : deux noms pour une seule apparence, c'est-à-dire une distinction que
 * personne ne peut voir. Ils sont fondus en `normal`. Si un écran futur doit
 * vraiment les séparer, c'est à ce moment-là qu'un septième ton se méritera.
 *
 * Et aucun ton « succès ». Le produit n'a pas de succès : une facture émise,
 * un rendez-vous honoré, un objectif atteint sont des états NORMAUX, et l'un
 * d'eux peut être une mauvaise nouvelle. Créer le rôle inviterait le prochain
 * écran à se réjouir à la place de la praticienne.
 *
 * ── LE LIBELLÉ EST OBLIGATOIRE (WCAG 1.4.1) ───────────────────────────────
 *
 * `libelle` n'est pas facultatif. Les quatorze endroits tenaient déjà cette
 * règle — le mot était toujours écrit à côté de la couleur — mais par
 * discipline. Le typage la tient désormais tout seul.
 */

export type Ton =
  /** Rien n'est encore engagé : brouillon, à venir, en pause. */
  | "attente"
  /** L'objet vit, ou a atteint son état attendu : actif, émis, honoré. */
  | "normal"
  /** Déplacé, ou attendu de quelqu'un d'autre : reporté, demande reçue. */
  | "ailleurs"
  /** Une vérification est demandée ; l'objet vaut encore. */
  | "avis"
  /** L'objet ne vaut plus, et ça ne se reprend pas. */
  | "arret"
  /** Sorti sans drame : refusé, expiré, terminé, réorienté. */
  | "inerte";

/**
 * Exportée pour le SEUL cas légitime : un rendu de taille différente qui doit
 * quand même partager le ton. Le badge d'abonnement porte une icône et un
 * corps plus grand ; c'est le TON qui doit être commun, pas la taille. Toute
 * autre reprise de cette carte est une pastille déguisée — employer `Statut`.
 */
export const TONS: Record<Ton, string> = {
  attente: "bg-slate-100 text-slate-700",
  normal: "bg-brand-50 text-brand-700",
  ailleurs: "bg-sky-50 text-sky-700",
  avis: "bg-avis-fond text-avis-encre",
  arret: "bg-arret-fond text-arret-encre",
  inerte: "bg-slate-100 text-encre-faible",
};

export function Statut({
  ton,
  libelle,
  precision,
}: {
  ton: Ton;
  /** Obligatoire. La couleur n'informe jamais seule. */
  libelle: string;
  /** Ce qui suit la pastille : une date, un motif d'annulation. */
  precision?: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span
        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${TONS[ton]}`}
      >
        {libelle}
      </span>
      {precision && (
        <span className="text-xs text-encre-faible">{precision}</span>
      )}
    </span>
  );
}
