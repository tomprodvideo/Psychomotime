
import type { Ton } from "@/components/Statut";
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
  /**
   * Qui a réglé. Lu sur les factures d'imputation, où le payeur est déjà porté.
   * Plusieurs sont possibles — une famille et une plateforme, par exemple : on
   * les nomme tous plutôt que d'en choisir un.
   */
  payeurs?: string[] | null;
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
 * `annule` est en `avis` (ambre) et NON en `arret` (rose), à l'inverse des
 * quatre écrits cliniques. C'est le ton d'aujourd'hui, conservé tel quel : la
 * question de savoir si une annulation se reprend appartient au métier, pas à
 * une harmonisation de palette. Voir `docs/context/CURRENT_STATE.md`.
 */
export const ATTESTATION_STATUS_TONS: Record<AttestationStatus, Ton> = {
  brouillon: "attente",
  emis: "normal",
  annule: "avis",
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

/* ==========================================================================
 *  Ce que le document peut affirmer
 * ========================================================================== */

/** Natures d'acte où la présence du PATIENT est certaine. */
const PRESENCE_DU_PATIENT = ["seance", "bilan"];

export interface FormulePresence {
  /** Phrase d'introduction de la liste des dates. */
  phrase: string;
  /**
   * La nature de chaque acte doit-elle être imprimée, même si le praticien
   * n'a pas demandé le détail ?
   */
  forcerNature: boolean;
}

/**
 * Choisit la formule du document selon ce qui est réellement attesté.
 *
 * LE DÉFAUT « LE MOINS DISANT » CÈDE DEVANT LA VÉRITÉ. Le modèle enregistre la
 * nature d'un rendez-vous, pas QUI y était présent. Or `entretien` couvre
 * l'anamnèse et l'entretien parental, et `restitution` la remise d'un compte
 * rendu : l'enfant n'y est pas toujours.
 *
 * Imprimer « a été reçu(e) en séance de psychomotricité » pour une date où
 * seuls les parents sont venus transformerait une présence des parents en
 * présence attestée de l'enfant. Quand l'ensemble contient autre chose qu'une
 * séance ou un bilan, la formule cesse donc d'affirmer une présence physique,
 * et la nature de chaque acte est imprimée — même si le praticien avait
 * demandé de n'en rien dire, parce que taire ici reviendrait à affirmer faux.
 *
 * [HYPOTHÈSE] Ce comportement est un défaut prudent et réversible. Le vrai
 * correctif est un champ « qui était présent » sur le rendez-vous.
 * [VALIDATION HUMAINE — psychomotricienne en exercice] : atteste-t-on un
 * entretien parental, et sous quelle formule ?
 */
export function formulePresence(natures: string[]): FormulePresence {
  const toutesCertaines = natures.every((n) => PRESENCE_DU_PATIENT.includes(n));
  if (toutesCertaines) {
    return {
      phrase: "a été reçu(e) en séance de psychomotricité",
      forcerNature: false,
    };
  }
  return {
    phrase: "a bénéficié des temps de psychomotricité suivants",
    forcerNature: true,
  };
}
