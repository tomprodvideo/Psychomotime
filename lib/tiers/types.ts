
import type { Ton } from "@/components/Statut";
/**
 * L'ÉCRIT POUR UN TIERS NON SOIGNANT.
 *
 * Ce qui part chez une école, une équipe éducative, ou dans un dossier déposé
 * à un organisme évaluateur.
 *
 * CE QUI LE SÉPARE DU COURRIER DE LIAISON : le destinataire n'est pas un
 * professionnel de santé. Il n'est pas tenu au même secret, il n'a pas le cadre
 * pour lire une réserve ou une hypothèse, et l'information circulera plus loin
 * que lui. D'où un registre d'écriture FONCTIONNEL ET SITUÉ, jamais clinique —
 * et un défaut à « rien » sur absolument tout ce qui peut être ajouté.
 */

export type TiersStatus = "brouillon" | "emis" | "annule";

export const TIERS_STATUS_LABELS: Record<TiersStatus, string> = {
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
export const TIERS_STATUS_TONS: Record<TiersStatus, Ton> = {
  brouillon: "attente",
  emis: "normal",
  annule: "arret",
};

export type UsageTiers = "ecole" | "mdph" | "autre_tiers";

export const USAGE_LABELS: Record<UsageTiers, string> = {
  ecole: "Pour l'école ou l'équipe éducative",
  mdph: "Pour un dossier déposé à un organisme évaluateur",
  autre_tiers: "Pour un autre tiers",
};

export const USAGE_AIDES: Record<UsageTiers, string> = {
  ecole:
    "Lu dans un lieu où l'enfant est présent, par des gens qui le verront demain. Le registre est celui de la classe : ce qui se passe, quand, et ce qui aide.",
  mdph:
    "Archivé, relu des années plus tard, et il pèse sur des droits. Le registre est celui du retentissement dans la vie quotidienne.",
  autre_tiers:
    "À n'employer que si les deux précédents ne conviennent pas. Ce document n'est pas un signalement : ce circuit-là n'est pas celui-ci.",
};

/** Le titre imprimé. Jamais « attestation », jamais « certificat ». */
export const USAGE_TITRES: Record<UsageTiers, string> = {
  ecole: "Écrit à l'attention de l'école",
  mdph: "Écrit destiné à un dossier déposé à un organisme évaluateur",
  autre_tiers: "Écrit à l'attention d'un tiers",
};

export type ModeRemiseTiers =
  | "destinataire"
  | "remis_pour_transmission"
  | "personne_suivie"
  | "au_dossier";

export const MODE_REMISE_TIERS_LABELS: Record<ModeRemiseTiers, string> = {
  destinataire: "Adressé à un destinataire nommé",
  remis_pour_transmission: "Remis à la personne, qui le transmettra",
  personne_suivie: "Remis à la personne suivie ou à ses représentants",
  au_dossier: "Versé au dossier, non remis",
};

export const MODE_REMISE_TIERS_AIDES: Record<ModeRemiseTiers, string> = {
  destinataire:
    "Le cabinet adresse l'écrit lui-même. Le destinataire est nommé sur le document.",
  remis_pour_transmission:
    "Le mode dominant vers un organisme. Le document dira que le cabinet ne l'a adressé directement à personne — c'est vrai, et cela répond par avance à « qui a envoyé ça ? ».",
  personne_suivie: "Remis en main propre, sans destination déclarée.",
  au_dossier: "Rien ne part. L'écrit est daté, signé, et reste au dossier.",
};

export type EtatAccord = "accorde" | "retire" | "absent";

/**
 * Les faits que la base pose — TROIS, et l'abstention sur tout le reste.
 *
 * Les quatre derniers ne s'impriment jamais : deux avertissements destinés à
 * elle avant de remettre, et la parole du demandeur, proposée à la reprise.
 */
export interface FaitsTiers {
  premiere_seance_le: string | null;
  derniere_seance_le: string | null;
  seances_honorees: number;
  prescripteur: {
    nom?: string | null;
    profession?: string | null;
    prescrit_le?: string | null;
  } | null;
  objectifs: { intitule?: string | null; statut?: string | null }[];

  // Écran seulement.
  motif_demande_a_reprendre: string | null;
  honorees_hors_parcours: number;
  accord_partage: EtatAccord;
}

export interface InstantaneTiers {
  emis_le?: string | null;
  usage?: UsageTiers | null;
  remise?: ModeRemiseTiers | null;
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
    role_au_dossier?: string | null;
  } | null;
  consentement_partage?: EtatAccord | null;
  mentions?: {
    cadre?: string | null;
    remise?: string | null;
    comptes?: string | null;
    chiffres?: string | null;
  } | null;
  faits?: Partial<
    Omit<
      FaitsTiers,
      "motif_demande_a_reprendre" | "honorees_hors_parcours" | "accord_partage"
    >
  > | null;
}

export interface EcritTiers {
  id: string;
  practice_id: string;
  patient_id: string;
  pathway_id: string | null;
  intended_use: UsageTiers;
  delivery_mode: ModeRemiseTiers;
  recipient_contact_id: string | null;
  context: string | null;
  observation_setting: string | null;
  observed: string | null;
  daily_impact: string | null;
  what_helps: string | null;
  proposals: string | null;
  limits_note: string | null;
  detail_scores: boolean;
  detail_objectifs: boolean;
  detail_seances: boolean;
  detail_prescripteur: boolean;
  detail_professionnels: boolean;
  professionnels: string | null;
  consent_override_reason: string | null;
  status: TiersStatus;
  issued_on: string | null;
  note: string | null;
  internal_note: string | null;
  cancellation_reason: string | null;
  snapshot: InstantaneTiers | null;
  created_at: string;
  updated_at: string;
}

/**
 * Ce que l'écran dit de l'accord, AVANT qu'elle écrive.
 *
 * Un refus au moment de remettre, sur un écrit déjà rédigé, est un refus qui
 * arrive trop tard.
 */
export function messageAccordTiers(etat: EtatAccord): {
  ton: "ok" | "avertir" | "bloquer";
  texte: string;
} {
  switch (etat) {
    case "accorde":
      return {
        ton: "ok",
        texte:
          "Un accord de partage est enregistré pour ce dossier. Cet écrit pourra être remis.",
      };
    case "retire":
      return {
        ton: "bloquer",
        texte:
          "L'accord de partage a été RETIRÉ pour ce dossier. Cet écrit ne pourra pas être remis à un tiers non soignant, et ce refus ne se contourne pas : c'est le cabinet lui-même qui a enregistré ce retrait.",
      };
    default:
      return {
        ton: "avertir",
        texte:
          "Aucun accord de partage n'est enregistré pour ce dossier. Enregistrez-le depuis les consentements, ou écrivez plus bas pourquoi vous remettez cet écrit sans lui — ce motif restera interne.",
      };
  }
}

/** Une synthèse ou un écrit remis ne se modifie plus. */
export function tiersModifiable(e: Pick<EcritTiers, "status">): boolean {
  return e.status === "brouillon";
}
