/**
 * Types du dossier patient — modèle cible.
 *
 * Ils décrivent les tables de `supabase/migrations/0002_dossier_patient.sql`.
 * Les valeurs littérales reprennent exactement les contraintes CHECK de la
 * base : si l'une bouge, l'autre doit bouger, et le typecheck le dira.
 */

/* ==========================================================================
 *  Cabinet
 * ========================================================================== */

export type PracticeRole =
  | "owner"
  | "practitioner"
  | "assistant"
  | "accountant"
  | "readonly";

export type MembershipStatus = "invited" | "active" | "suspended" | "revoked";

/** Le cabinet courant et la place qu'y tient l'utilisateur connecté. */
export interface PracticeContext {
  practiceId: string;
  practiceName: string;
  memberId: string;
  role: PracticeRole;
  /** Peut écrire les données d'exercice (propriétaire ou praticien). */
  canWrite: boolean;
  /** Peut lire notes et objectifs. Un assistant administratif ne le peut pas. */
  canReadClinical: boolean;
  /** Peut administrer le cabinet : membres, entité juridique, fiscalité. */
  canAdminister: boolean;
}

/* ==========================================================================
 *  Patient
 * ========================================================================== */

export type PatientStatus = "actif" | "archive";

/** Sexe de référence pour l'étalonnage d'un instrument, et rien d'autre. */
export type NormReferenceSex = "f" | "m" | "autre";

export interface Patient {
  id: string;
  practice_id: string;
  first_name: string;
  last_name: string;
  birth_name: string | null;
  preferred_name: string | null;
  birth_date: string | null;
  norm_reference_sex: NormReferenceSex | null;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  country_code: string;
  administrative_notes: string | null;
  status: PatientStatus;
  archived_at: string | null;
  archive_reason: string | null;
  created_at: string;
  updated_at: string;
}

/* ==========================================================================
 *  Contacts et rôles
 * ========================================================================== */

export type ContactKind = "personne" | "organisation";

export interface Contact {
  id: string;
  practice_id: string;
  kind: ContactKind;
  first_name: string | null;
  last_name: string | null;
  organisation_name: string | null;
  profession: string | null;
  rpps: string | null;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  country_code: string;
  notes: string | null;
}

/**
 * Les six rôles que la v1 confondait. Ce ne sont pas des synonymes :
 * chacun donne un droit différent, révocable séparément.
 */
export type PatientContactRole =
  | "responsable_legal"
  | "parent_sans_autorite"
  | "proche"
  | "destinataire"
  | "payeur"
  | "assure"
  | "adresseur"
  | "professionnel"
  | "etablissement"
  | "autre";

/**
 * Fondement juridique d'un rôle de responsable légal.
 * L'autorité parentale sur un mineur et la protection d'un majeur sont deux
 * régimes distincts : les confondre sous le mot « tuteur » est une erreur.
 */
export type LegalBasis =
  | "autorite_parentale"
  | "tutelle_majeur"
  | "curatelle"
  | "habilitation_familiale"
  | "mandat_protection_future"
  | "autre";

export interface PatientContactLink {
  id: string;
  practice_id: string;
  patient_id: string;
  contact_id: string;
  role: PatientContactRole;
  legal_basis: LegalBasis | null;
  relationship: string | null;
  valid_from: string | null;
  valid_to: string | null;
  is_primary: boolean;
  note: string | null;
}

/** Un lien, joint à la personne qu'il désigne. */
export interface PatientContactWithContact extends PatientContactLink {
  contact: Contact;
}

/* ==========================================================================
 *  Parcours de prise en soin
 * ========================================================================== */

export type PathwayStatus =
  | "demande"
  | "liste_attente"
  | "actif"
  | "en_pause"
  | "termine"
  | "interrompu"
  | "reoriente";

export type FundingScheme =
  | "liberal"
  | "pco"
  | "mdph"
  | "etablissement"
  | "autre";

export interface CarePathway {
  id: string;
  practice_id: string;
  patient_id: string;
  label: string | null;
  status: PathwayStatus;
  referral_reason: string | null;
  referral_source_contact_id: string | null;
  prescriber_contact_id: string | null;
  prescription_date: string | null;
  prescription_reference: string | null;
  funding_scheme: FundingScheme | null;
  requested_on: string | null;
  started_on: string | null;
  ended_on: string | null;
  end_reason: string | null;
}

export type ObjectiveStatus =
  | "en_cours"
  | "atteint"
  | "partiellement_atteint"
  | "abandonne"
  | "reformule";

export interface CareObjective {
  id: string;
  practice_id: string;
  pathway_id: string;
  label: string;
  detail: string | null;
  status: ObjectiveStatus;
  position: number;
  set_on: string | null;
  reviewed_on: string | null;
  review_note: string | null;
}

/* ==========================================================================
 *  Notes et consentements
 * ========================================================================== */

export interface PatientNote {
  id: string;
  practice_id: string;
  patient_id: string;
  pathway_id: string | null;
  body: string;
  written_on: string;
  author_member_id: string | null;
  /**
   * Article L1111-7 du CSP : le droit d'accès du patient exclut les
   * informations recueillies auprès d'un tiers n'intervenant pas dans la prise
   * en charge, ou concernant un tel tiers. Ce marquage permet de les
   * distinguer — il ne promet pas qu'elles soient inaccessibles.
   */
  third_party_information: boolean;
  third_party_source: string | null;
}

export type ConsentKind =
  | "information_recue"
  | "partage_professionnels"
  | "partage_etablissement"
  | "transmission_prescripteur"
  | "photo_video"
  | "autre";

export interface PatientConsent {
  id: string;
  practice_id: string;
  patient_id: string;
  kind: ConsentKind;
  scope: string | null;
  granted_by_contact_id: string | null;
  granted_by_patient: boolean;
  granted_on: string | null;
  withdrawn_on: string | null;
  evidence: string | null;
}

/* ==========================================================================
 *  Libellés d'affichage
 * ========================================================================== */

export const ROLE_LABELS: Record<PatientContactRole, string> = {
  responsable_legal: "Responsable légal",
  parent_sans_autorite: "Parent sans autorité parentale",
  proche: "Proche",
  destinataire: "Destinataire des documents",
  payeur: "Payeur",
  assure: "Assuré",
  adresseur: "A orienté vers le cabinet",
  professionnel: "Autre professionnel",
  etablissement: "Établissement",
  autre: "Autre",
};

export const LEGAL_BASIS_LABELS: Record<LegalBasis, string> = {
  autorite_parentale: "Autorité parentale",
  tutelle_majeur: "Tutelle (majeur)",
  curatelle: "Curatelle",
  habilitation_familiale: "Habilitation familiale",
  mandat_protection_future: "Mandat de protection future",
  autre: "Autre mesure",
};

export const PATHWAY_STATUS_LABELS: Record<PathwayStatus, string> = {
  demande: "Demande reçue",
  liste_attente: "Liste d'attente",
  actif: "En cours",
  en_pause: "En pause",
  termine: "Terminé",
  interrompu: "Interrompu",
  reoriente: "Réorienté",
};

export const FUNDING_LABELS: Record<FundingScheme, string> = {
  liberal: "Libéral",
  pco: "Plateforme de coordination",
  mdph: "MDPH",
  etablissement: "Établissement",
  autre: "Autre",
};

export const OBJECTIVE_STATUS_LABELS: Record<ObjectiveStatus, string> = {
  en_cours: "En cours",
  atteint: "Atteint",
  partiellement_atteint: "Partiellement atteint",
  abandonne: "Abandonné",
  reformule: "Reformulé",
};

export const CONSENT_LABELS: Record<ConsentKind, string> = {
  information_recue: "Information reçue",
  partage_professionnels: "Partage avec d'autres professionnels",
  partage_etablissement: "Partage avec un établissement",
  transmission_prescripteur: "Transmission au prescripteur",
  photo_video: "Photographies ou vidéos",
  autre: "Autre",
};

/** Nom affichable d'un contact, personne ou organisation. */
export function contactName(c: Pick<Contact, "kind" | "first_name" | "last_name" | "organisation_name">): string {
  if (c.kind === "organisation") return c.organisation_name?.trim() || "Organisation sans nom";
  const nom = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
  return nom || "Contact sans nom";
}

/** Nom affichable d'un patient. */
export function patientName(p: Pick<Patient, "first_name" | "last_name" | "preferred_name">): string {
  const prenom = p.preferred_name?.trim() || p.first_name?.trim() || "";
  const nom = [prenom, p.last_name?.trim()].filter(Boolean).join(" ").trim();
  return nom || "Dossier sans nom";
}
