import type { Band, Scale } from "@/lib/scales";
import type { Ton } from "@/components/Statut";

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
  /**
   * La séance que cette note raconte, s'il y en a une. Toutes les notes n'en
   * racontent pas : un appel entre deux rendez-vous est une note du dossier.
   * La cohérence — même cabinet, même dossier — est tenue en base (0021).
   */
  appointment_id: string | null;
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

/**
 * `en_pause` et `termine` étaient peints à l'identique. Ils ne disent pourtant
 * pas la même chose : une pause peut reprendre, un parcours terminé non.
 */
export const PATHWAY_TONS: Record<PathwayStatus, Ton> = {
  demande: "ailleurs",
  liste_attente: "avis",
  actif: "normal",
  en_pause: "attente",
  termine: "inerte",
  interrompu: "inerte",
  reoriente: "inerte",
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

/* ==========================================================================
 *  Agenda, séances et présences
 * ========================================================================== */

/** Ce qui était prévu. */
export type AppointmentKind =
  | "seance"
  | "bilan"
  | "entretien"
  | "restitution"
  | "reunion"
  | "administratif"
  | "autre";

/**
 * Ce qui s'est réellement passé.
 *
 * `a_venir` reste tant que rien n'est constaté — y compris pour un rendez-vous
 * déjà passé. Le logiciel ne décide pas à la place du praticien : un créneau
 * passé non qualifié est une chose à traiter, pas une absence supposée.
 */
export type Attendance =
  | "a_venir"
  | "honore"
  | "absent_excuse"
  | "absent_non_excuse"
  | "annule_praticien"
  | "annule_patient"
  | "reporte";

export interface Appointment {
  id: string;
  practice_id: string;
  patient_id: string | null;
  pathway_id: string | null;
  practitioner_member_id: string | null;
  location_id: string | null;
  kind: AppointmentKind;
  starts_at: string;
  ends_at: string;
  attendance: Attendance;
  attendance_note: string | null;
  billable: boolean;
  title: string | null;
  note: string | null;
}

/** Un rendez-vous accompagné du nom du patient, pour l'agenda. */
export interface AppointmentWithPatient extends Appointment {
  patient: Pick<Patient, "id" | "first_name" | "last_name" | "preferred_name"> | null;
}

export const APPOINTMENT_KIND_LABELS: Record<AppointmentKind, string> = {
  seance: "Séance",
  bilan: "Passation de bilan",
  entretien: "Entretien",
  restitution: "Restitution",
  reunion: "Réunion",
  administratif: "Temps administratif",
  autre: "Autre",
};

export const ATTENDANCE_LABELS: Record<Attendance, string> = {
  a_venir: "À venir",
  honore: "Honoré",
  absent_excuse: "Absent, prévenu",
  absent_non_excuse: "Absent, sans nouvelle",
  annule_praticien: "Annulé par le cabinet",
  annule_patient: "Annulé par le patient",
  reporte: "Reporté",
};

/**
 * Le TON de l'issue — plus la classe CSS : `components/Statut.tsx` la tient.
 *
 * ELLE VIT ICI PARCE QU'ELLE VIVAIT DEUX FOIS. L'agenda et le dossier en
 * portaient chacun une copie, octet pour octet identique, à sept entrées.
 * Deux écrans qui montrent la même chose n'ont aucune raison de pouvoir
 * diverger sur ce qu'« annulé » a l'air d'être.
 *
 * `reporte` est le seul état du produit qui ne soit ni bon, ni mauvais, ni
 * fini : c'est lui qui justifie le ton `ailleurs`.
 */
export const ATTENDANCE_TONS: Record<Attendance, Ton> = {
  a_venir: "attente",
  honore: "normal",
  absent_excuse: "avis",
  absent_non_excuse: "arret",
  annule_praticien: "inerte",
  annule_patient: "inerte",
  reporte: "ailleurs",
};

/**
 * Issues exigeant un motif, en écho à la contrainte de la base.
 * Sans motif, on ne saurait ni relancer, ni justifier une facturation.
 */
export const ATTENDANCE_REQUIRING_NOTE: Attendance[] = [
  "absent_non_excuse",
  "annule_praticien",
  "reporte",
];

/**
 * Issues facturables par défaut. Le praticien garde la main : la règle
 * d'un cabinet à l'autre n'est pas la même.
 */
export const ATTENDANCE_BILLABLE_BY_DEFAULT: Attendance[] = [
  "honore",
  "absent_non_excuse",
];

/** Un rendez-vous compte-t-il comme une séance réalisée ? */
export function isRealisedSession(a: Pick<Appointment, "attendance" | "kind" | "patient_id">): boolean {
  return (
    a.attendance === "honore" &&
    a.patient_id !== null &&
    ["seance", "bilan", "entretien", "restitution"].includes(a.kind)
  );
}

export type WaitlistPriority = "normale" | "prioritaire";

/* ==========================================================================
 *  Registre d'instruments
 *
 *  Le registre stocke des DÉSIGNATIONS et des propriétés déclarées, jamais du
 *  matériel : ni items, ni consignes, ni feuilles de cotation, ni tables
 *  d'étalonnage. Toute propriété y est conçue pour pouvoir être publiée telle
 *  quelle sans reproduire un manuel.
 * ========================================================================== */

export type LicenceStatus =
  | "reference_seule"
  | "scores_saisis_par_le_praticien"
  | "integration_editeur_autorisee"
  | "outil_libre_valide";

export interface Instrument {
  id: string;
  practice_id: string;
  name: string;
  publisher: string | null;
  edition: string | null;
  form: string | null;
  language: string | null;
  age_min_months: number | null;
  age_max_months: number | null;
  normative_population: string | null;
  domains: string[];
  licence_status: LicenceStatus;
  licence_scope: string | null;
  licence_reference: string | null;
  licence_url: string | null;
  licence_expires_on: string | null;
  licence_checked_on: string | null;
  licence_checked_by: string | null;
  validity_warnings: string | null;
  note: string | null;
  active: boolean;
}

export interface InstrumentScale extends Scale {
  practice_id: string;
  instrument_id: string;
  note: string | null;
  active: boolean;
}

export interface BandSetRow {
  id: string;
  practice_id: string;
  scale_id: string;
  vocabulary_id: string;
  version: string;
  origin: "manuel_editeur" | "publication_citee" | "convention_praticien";
  source: string;
  source_checked_on: string | null;
  active: boolean;
  validated_by: string | null;
  validated_on: string | null;
  bands: Band[];
}

export interface Vocabulary {
  id: string;
  practice_id: string;
  name: string;
  usage: "interne" | "document_remis";
  validated_by: string | null;
  validated_on: string | null;
  note: string | null;
  labels: { key: string; text: string }[];
}

/** Ce que chaque statut de licence autorise, et ce qu'il interdit. */
export const LICENCE_LABELS: Record<LicenceStatus, string> = {
  reference_seule: "Référence seule",
  scores_saisis_par_le_praticien: "Scores saisis par vous",
  integration_editeur_autorisee: "Intégration autorisée par l'éditeur",
  outil_libre_valide: "Outil libre vérifié",
};

export const LICENCE_EXPLICATIONS: Record<
  LicenceStatus,
  { autorise: string; interdit: string }
> = {
  reference_seule: {
    autorise:
      "L'instrument est nommé, sa plage d'âge est rappelée, et vous écrivez vos résultats en texte libre.",
    interdit:
      "Aucune échelle, aucun résultat structuré, aucune bande, aucune couleur.",
  },
  scores_saisis_par_le_praticien: {
    autorise:
      "Vous décrivez vos propres échelles et vos propres découpages, et vous y recopiez les scores que vous avez cotés vous-même.",
    interdit:
      "Le logiciel ne fournit ni intitulés d'épreuves, ni grille, ni découpage repris d'un manuel. Il ne convertit aucune échelle en une autre.",
  },
  integration_editeur_autorisee: {
    autorise: "Exactement ce que votre accord écrit énumère, et rien de plus.",
    interdit:
      "Tout usage non énuméré, même « évident ». Sans référence, date et nom de vérificateur, le statut retombe automatiquement au précédent.",
  },
  outil_libre_valide: {
    autorise:
      "Stocker et afficher les intitulés et la grille, dans le respect de l'attribution exigée.",
    interdit:
      "Traiter comme libre un outil simplement trouvé en ligne. « Librement accessible » n'est pas « libre de droits ».",
  },
};
