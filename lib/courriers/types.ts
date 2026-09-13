
import type { Ton } from "@/components/Statut";
/**
 * LE COURRIER DE LIAISON.
 *
 * Une page adressée à UN professionnel nommé — médecin adresseur,
 * orthophoniste, ergothérapeute. Une question, ou un élément à transmettre.
 *
 * CE N'EST PAS UN COMPTE RENDU RACCOURCI, et le modèle le dit : il ne porte
 * aucune reprise d'un bilan, aucun bloc à cocher, aucune pièce jointe. Le
 * corps est écrit par la praticienne, et par elle seule. Un courrier qui
 * recopierait un bilan serait un compte rendu envoyé à quelqu'un qui n'a
 * peut-être pas à le recevoir.
 */

export type CourrierStatus = "brouillon" | "emis" | "annule";

export const COURRIER_STATUS_LABELS: Record<CourrierStatus, string> = {
  brouillon: "Brouillon",
  emis: "Remis",
  annule: "Annulé",
};

/**
 * « Brouillon » passe de l'ambre au gris.
 *
 * L'ambre a un sens écrit dans `components/SectionDossier.tsx` : « regardez
 * avant de continuer ». Un brouillon ne demande pas qu'on le vérifie, il
 * demande qu'on le finisse — et la comptabilité le peignait déjà en gris. Le
 * garder en ambre ici diluait le seul signal censé dire « attention ».
 *
 * « Annulé » RESTE rose, et la comptabilité le garde en ambre : les deux
 * moitiés du produit sont en désaccord sur la réversibilité d'une annulation,
 * et ce n'est pas une cohérence visuelle qui doit trancher cela.
 */
export const COURRIER_STATUS_TONS: Record<CourrierStatus, Ton> = {
  brouillon: "attente",
  emis: "normal",
  annule: "arret",
};

export interface InstantaneCourrier {
  emis_le?: string | null;
  cabinet?: { nom?: string | null } | null;
  entite_juridique?: {
    denomination?: string | null;
    forme?: string | null;
    adresse?: string | null;
    code_postal?: string | null;
    ville?: string | null;
  } | null;
  praticien?: { nom?: string | null; titre?: string | null } | null;
  identifiants?: { type?: string; valeur?: string }[] | null;
  patient?: { nom?: string | null; ne_le?: string | null } | null;
  destinataire?: {
    nom?: string | null;
    profession?: string | null;
    adresse?: string | null;
    code_postal?: string | null;
    ville?: string | null;
  } | null;
}

export interface Courrier {
  id: string;
  practice_id: string;
  patient_id: string;
  pathway_id: string | null;
  recipient_contact_id: string;
  subject: string;
  body: string;
  status: CourrierStatus;
  issued_on: string | null;
  internal_note: string | null;
  cancellation_reason: string | null;
  snapshot: InstantaneCourrier | null;
  created_at: string;
  updated_at: string;
}

/** Un courrier remis ne se modifie plus : il s'annule et se réécrit. */
export function courrierModifiable(c: Pick<Courrier, "status">): boolean {
  return c.status === "brouillon";
}

/**
 * L'état du consentement au partage professionnel, pour ce dossier.
 *
 * LE PRODUIT DIT CE QU'IL SAIT, IL NE BLOQUE PAS. Exiger un consentement
 * enregistré avant d'écrire à un confrère reviendrait à inventer une
 * obligation que je ne peux pas sourcer ; ne rien dire alors que le dossier
 * porte un retrait explicite serait pire. La décision appartient à la
 * praticienne, et elle la prend en connaissance de cause. [D-i]
 */
export type EtatConsentement = "accorde" | "retire" | "absent";

export function messageConsentement(etat: EtatConsentement): string {
  switch (etat) {
    case "accorde":
      return "Un accord de partage avec les professionnels est enregistré pour ce dossier.";
    case "retire":
      return "L'accord de partage avec les professionnels a été RETIRÉ pour ce dossier.";
    default:
      return "Aucun accord de partage avec les professionnels n'est enregistré pour ce dossier.";
  }
}

/**
 * La règle, isolée pour être vérifiable sans base ni session.
 *
 * Elle vit ICI, et pas dans le module de lecture, pour la même raison que
 * `lib/supabase/chemins.ts` : une règle qui décide de ce qu'un écran affirme
 * au-dessus d'un bouton de remise doit pouvoir être éprouvée sans fabriquer
 * une requête, une session et un client Supabase.
 *
 * L'ordre des trois cas est la règle elle-même : un retrait d'abord, puis un
 * accord effectif, et « absent » comme seul reste.
 */
export function etatDesAccords(
  lignes: { granted_on: string | null; withdrawn_on: string | null }[],
): EtatConsentement {
  if (lignes.some((l) => l.withdrawn_on !== null)) return "retire";
  if (lignes.some((l) => l.granted_on !== null && l.withdrawn_on === null)) {
    return "accorde";
  }
  return "absent";
}
