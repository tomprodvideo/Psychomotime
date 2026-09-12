/**
 * Types des attestations de présence et de paiement.
 *
 * MODULE PUR. Ni React, ni Supabase, ni `next/headers` : un composant client
 * doit pouvoir importer un libellé sans entraîner le client serveur avec lui.
 *
 * Ils décrivent `supabase/migrations/0016_attestations.sql`. Les valeurs
 * littérales reprennent exactement les contraintes CHECK de la base.
 */

/* ==========================================================================
 *  Natures et états
 * ========================================================================== */

/**
 * DEUX DOCUMENTS QUI NE DISENT PAS LA MÊME CHOSE.
 *
 * L'attestation de présence dit que la personne est VENUE. L'attestation de
 * paiement dit qu'une somme a été REÇUE. Une famille qui n'a pas encore payé a
 * bien été présente ; un règlement d'avance n'atteste d'aucune séance.
 */
export type AttestationKind = "presence" | "paiement";

export type AttestationStatus = "brouillon" | "emis" | "annule";

export interface Attestation {
  id: string;
  practice_id: string;
  kind: AttestationKind;
  patient_id: string;
  recipient_contact_id: string | null;
  recipient_is_patient: boolean;
  period_start: string | null;
  period_end: string | null;
  series: string | null;
  number: string | null;
  status: AttestationStatus;
  issued_on: string | null;
  /** Imprimer la nature exacte des actes, ou s'en tenir à « séance ». */
  detail_nature: boolean;
  sessions_count: number;
  total_cents: number;
  note: string | null;
  internal_note: string | null;
  cancellation_reason: string | null;
  snapshot: AttestationSnapshot | null;
  created_at: string;
  updated_at: string;
}

/**
 * Ce que l'attestation affirme, figé le jour de la signature.
 *
 * Toutes les clés sont optionnelles : l'instantané décrit ce qui était connu à
 * cette date. Une clé absente est une information qui n'existait pas — elle ne
 * doit jamais être remplacée par la valeur du jour.
 */
export interface AttestationSnapshot {
  emis_le?: string;
  cabinet?: { nom?: string } | null;
  entite_juridique?: {
    denomination?: string | null;
    forme?: string | null;
    adresse?: string | null;
    code_postal?: string | null;
    ville?: string | null;
  } | null;
  /** Sans nom ni titre, une attestation ne vaut rien pour qui la reçoit. */
  praticien?: { nom?: string | null; titre?: string | null } | null;
  identifiants?: { type?: string; valeur?: string }[] | null;
  patient?: {
    nom?: string | null;
    ne_le?: string | null;
    adresse?: string | null;
    code_postal?: string | null;
    ville?: string | null;
  } | null;
  destinataire?: {
    nom?: string | null;
    adresse?: string | null;
    code_postal?: string | null;
    ville?: string | null;
  } | null;
  /** Les dates attestées, figées : le document ne dépend plus de leur relecture. */
  seances?: { date?: string; nature?: string }[] | null;
  reglements?: { date?: string; moyen?: string; montant_centimes?: number }[] | null;
  factures?: { numero?: string | null; emise_le?: string | null }[] | null;
}

/* ==========================================================================
 *  Libellés
 * ========================================================================== */

export const ATTESTATION_KIND_LABELS: Record<AttestationKind, string> = {
  presence: "Attestation de présence",
  paiement: "Attestation de paiement",
};

export const ATTESTATION_KIND_SHORT: Record<AttestationKind, string> = {
  presence: "Présence",
  paiement: "Paiement",
};

export const ATTESTATION_STATUS_LABELS: Record<AttestationStatus, string> = {
  brouillon: "Brouillon",
  emis: "Émise",
  annule: "Annulée",
};

/**
 * Ce que chaque nature affirme, en une phrase.
 *
 * Affiché au moment de choisir : c'est le seul endroit où la confusion entre
 * les deux peut être évitée avant qu'elle ne se retrouve sur un document.
 */
export const ATTESTATION_KIND_EXPLICATIONS: Record<AttestationKind, string> = {
  presence:
    "Atteste que la personne est venue, aux dates indiquées. Ne dit rien des règlements.",
  paiement:
    "Atteste qu'une somme a été reçue, pour les séances facturées de la période. Ne prouve aucune présence.",
};

/**
 * Nature d'un acte, telle qu'elle s'imprime.
 *
 * Le défaut est le moins disant : tout est présenté comme une séance, sauf si
 * le praticien demande explicitement le détail. Une attestation part parfois
 * chez un employeur, et « entretien parental » en dit plus que nécessaire.
 */
export const NATURE_ACTE_LABELS: Record<string, string> = {
  seance: "Séance de psychomotricité",
  bilan: "Bilan psychomoteur",
  entretien: "Entretien",
  restitution: "Restitution de bilan",
};

export function libelleActe(nature: string, detail: boolean): string {
  if (!detail) return "Séance de psychomotricité";
  return NATURE_ACTE_LABELS[nature] ?? "Séance de psychomotricité";
}

/* ==========================================================================
 *  Règles d'affichage
 * ========================================================================== */

export function attestationModifiable(
  a: Pick<Attestation, "status">,
): boolean {
  return a.status === "brouillon";
}

/**
 * Intitulé affichable.
 *
 * Un brouillon n'a pas de numéro — et ne doit pas en afficher un, même
 * provisoire : un numéro visible avant l'émission serait compris comme attribué.
 */
export function attestationTitre(
  a: Pick<Attestation, "kind" | "number" | "status">,
): string {
  if (a.status === "brouillon" || !a.number) {
    return `${ATTESTATION_KIND_LABELS[a.kind]} — brouillon`;
  }
  return `${ATTESTATION_KIND_LABELS[a.kind]} ${a.number}`;
}

/**
 * L'attestation affirme-t-elle encore quelque chose ?
 *
 * Une attestation annulée reste consultable — quelqu'un en détient peut-être
 * une copie — mais elle n'affirme plus rien.
 */
export function attestationVaut(a: Pick<Attestation, "status">): boolean {
  return a.status === "emis";
}
