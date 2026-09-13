/**
 * CE DOCUMENT VAUT-IL ENCORE ? — la réponse, écrite une seule fois.
 *
 * ── POURQUOI UNE SEULE FONCTION ───────────────────────────────────────────
 *
 * Une même pièce se lit à deux endroits : la page d'impression du cabinet, et
 * la page publique qu'un tiers ouvre depuis un lien. Chacune décidait seule de
 * ce qu'elle dirait d'une pièce qui ne vaut plus, et elles avaient divergé :
 *
 *  · la page du cabinet marquait l'annulation par avoir, le remplacement, le
 *    refus et l'expiration d'un devis ;
 *  · la page publique ne marquait QUE les deux premiers. Un devis refusé ou
 *    expiré, transmis par lien, s'affichait comme valide chez le destinataire —
 *    alors que la base lui transmettait bien son statut (`'etat', d.status`,
 *    migration `0020`). La donnée était là ; seul l'affichage l'ignorait.
 *
 * Le produit l'écrivait pourtant lui-même dans `lib/transmissions/types.ts` :
 * « deux versions d'une même pièce numérotée qui divergent sont un défaut en
 * soi ». Une fonction appelée par les deux pages ne peut plus diverger d'avec
 * elle-même.
 *
 * ── CE QU'ELLE DIT ────────────────────────────────────────────────────────
 *
 * La CONSÉQUENCE, et le RECOURS quand il y en a un. « Ce document est annulé »
 * ne dit ni l'une ni l'autre. La pièce qui en rectifie une autre n'est nommée
 * que si l'appelant la connaît : la page publique ne reçoit pas cette
 * référence, elle dit donc la même chose sans le numéro.
 *
 * MODULE PUR. Ni React, ni Supabase : contrôlé par `mentions.test.mts`.
 */

import { frDate } from "@/lib/format";

export interface Mention {
  /** En capitales à l'impression : le premier des trois canaux. */
  titre: string;
  texte: string;
}

/* Le genre et l'élision ne se DÉDUISENT pas du libellé : « Ce avoir » était
   imprimé avant que l'élision soit posée à la main. Une nature inconnue — le
   contrat public transmet `kind` en chaîne libre — se dit « pièce ». */
const NATURES: Record<string, { nom: string; feminin: boolean; ce: string }> = {
  devis: { nom: "devis", feminin: false, ce: "Ce" },
  facture: { nom: "facture", feminin: true, ce: "Cette" },
  facture_de_remplacement: { nom: "facture de remplacement", feminin: true, ce: "Cette" },
  avoir: { nom: "avoir", feminin: false, ce: "Cet" },
};
const INCONNUE = { nom: "pièce", feminin: true, ce: "Cette" };

export function mentionEtatPiece(p: {
  kind: string;
  status: string;
  /** Pour un devis : la date au-delà de laquelle il n'engage plus. */
  validUntil?: string | null;
  /** La pièce qui rectifie celle-ci, quand l'appelant la connaît. */
  rectifiant?: { numero: string | null; emiseLe: string | null } | null;
}): Mention | null {
  const n = NATURES[p.kind] ?? INCONNUE;
  const e = n.feminin ? "E" : "";
  const titre = (suffixe: string) => `${n.nom.toUpperCase()} ${suffixe}${e}`;
  const ref = p.rectifiant?.numero
    ? `n° ${p.rectifiant.numero}${p.rectifiant.emiseLe ? ` du ${frDate(p.rectifiant.emiseLe)}` : ""}`
    : null;

  switch (p.status) {
    case "annule_par_avoir":
      return {
        titre: `${n.nom.toUpperCase()} ANNULÉ${e} PAR AVOIR`,
        texte: ref
          ? `Cette pièce a été annulée par l'avoir ${ref}. Elle ne peut pas servir de justificatif.`
          : "Cette pièce a été annulée par un avoir. Elle ne peut pas servir de justificatif.",
      };
    case "remplace":
      return {
        titre: titre("REMPLACÉ"),
        texte: ref
          ? `Cette pièce a été remplacée par la pièce ${ref}, qui seule fait foi.`
          : "Cette pièce a été remplacée. C'est la pièce de remplacement qui fait foi.",
      };
    case "refuse":
      return {
        titre: titre("REFUSÉ"),
        texte: `${n.ce} ${n.nom} n'a pas été accepté${n.feminin ? "e" : ""}. Les montants indiqués n'engagent personne.`,
      };
    case "expire":
      return {
        titre: titre("EXPIRÉ"),
        texte: p.validUntil
          ? `${n.ce} ${n.nom} était valable jusqu'au ${frDate(p.validUntil)}. Les montants indiqués ne sont plus engageants.`
          : `${n.ce} ${n.nom} a dépassé sa durée de validité. Les montants indiqués ne sont plus engageants.`,
      };
    default:
      return null;
  }
}

export function mentionEtatAttestation(a: {
  status: string;
  motif?: string | null;
}): Mention | null {
  if (a.status !== "annule") return null;
  /* LE MOTIF EST DIT. Deux relectures l'avaient établi pour la page publique :
     qui reçoit une attestation annulée a besoin de savoir pourquoi, et la
     praticienne l'écrit en sachant qu'il figure sur le document remis. La
     ponctuation finale qu'elle a pu taper est retirée, pour ne pas imprimer
     « .. ». */
  const motif = a.motif?.trim().replace(/[\s.;:,]+$/u, "");
  return {
    titre: "ATTESTATION ANNULÉE",
    texte: `${motif ? `Cette attestation a été annulée : ${motif}.` : "Cette attestation a été annulée."} Elle ne peut pas servir de justificatif.`,
  };
}
