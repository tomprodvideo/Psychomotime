/**
 * Types des transmissions par lien.
 *
 * MODULE PUR. Ni React, ni Supabase, ni `next/headers`.
 *
 * LE TYPE `DocumentPublic` NE DÉFINIT RIEN : il ne fait que TYPER ce que rend
 * `public.shared_document`. La définition de ce qui est public vit en SQL, à un
 * seul endroit, et une sentinelle de test prouve que rien d'autre ne sort. La
 * version précédente tenait deux listes de champs — une en SQL, une en
 * TypeScript — que rien ne maintenait alignées, et le code l'admettait.
 */

export type SujetPartage = "billing_document" | "attestation";

export interface LienPartage {
  id: string;
  practice_id: string;
  subject_type: SujetPartage;
  subject_id: string;
  /** Quatre derniers caractères du jeton. Le jeton lui-même n'existe nulle part. */
  token_hint: string;
  expires_at: string;
  revoked_at: string | null;
  recipient_label: string | null;
  recipient_contact_id: string | null;
  access_count: number;
  last_accessed_at: string | null;
  created_at: string;
}

export type EtatLien = "actif" | "expire" | "revoque";

export function etatLien(l: Pick<LienPartage, "expires_at" | "revoked_at">, maintenant: Date): EtatLien {
  if (l.revoked_at) return "revoque";
  return new Date(l.expires_at) > maintenant ? "actif" : "expire";
}

export const ETAT_LIEN_LABELS: Record<EtatLien, string> = {
  actif: "Actif",
  expire: "Expiré",
  revoque: "Révoqué",
};

/* ==========================================================================
 *  Ce que voit un destinataire sans compte
 * ========================================================================== */

export interface EmetteurPublic {
  cabinet?: string | null;
  entite?: {
    denomination?: string | null;
    forme?: string | null;
    adresse?: string | null;
    code_postal?: string | null;
    ville?: string | null;
  } | null;
  identifiants?: { type?: string; valeur?: string }[] | null;
  praticien?: { nom?: string | null; titre?: string | null } | null;
}

export interface PersonnePublique {
  nom?: string | null;
  adresse?: string | null;
  code_postal?: string | null;
  ville?: string | null;
  ne_le?: string | null;
}

export interface LignePublique {
  libelle: string;
  intro?: string | null;
  note?: string | null;
  tarification: string;
  prix_unitaire_centimes: number;
  quantite: number;
  montant_centimes: number;
  dates?: string[] | null;
  rendu_dates?: string | null;
  tva?: string | null;
}

export interface PiecePublique {
  nature: "billing_document";
  kind: string;
  numero: string | null;
  emise_le: string | null;
  echeance: string | null;
  periode_debut: string | null;
  periode_fin: string | null;
  total_centimes: number;
  mention: string | null;
  rectifie_numero: string | null;
  rectifie_emise_le: string | null;
  rectification_motif: string | null;
  etat: string;
  emetteur: EmetteurPublic;
  destinataire: PersonnePublique | null;
  patient: { nom?: string | null } | null;
  lignes: LignePublique[] | null;
  acquittee_le: string | null;
}

export interface AttestationPublique {
  nature: "attestation";
  kind: "presence" | "paiement";
  numero: string | null;
  emise_le: string | null;
  periode_debut: string | null;
  periode_fin: string | null;
  detail_nature: boolean;
  mention: string | null;
  etat: string;
  motif_annulation: string | null;
  total_centimes: number;
  emetteur: EmetteurPublic;
  destinataire: PersonnePublique | null;
  patient: PersonnePublique | null;
  seances: { date?: string; nature?: string }[] | null;
  reglements: { date?: string; moyen?: string; montant_centimes?: number }[] | null;
  factures: { numero?: string | null; emise_le?: string | null }[] | null;
  payeurs: string[] | null;
}

export type DocumentPublic = PiecePublique | AttestationPublique;

/**
 * Le document vaut-il encore ?
 *
 * Une pièce annulée par avoir, remplacée, ou une attestation annulée restent
 * consultables — quelqu'un en détient peut-être une copie — mais le destinataire
 * doit voir qu'elles ne valent plus. Le taire serait le laisser s'en servir.
 */
export function documentCaduc(d: DocumentPublic): boolean {
  return ["annule_par_avoir", "remplace", "annule"].includes(d.etat);
}

export function raisonCaducite(d: DocumentPublic): string {
  switch (d.etat) {
    case "annule_par_avoir":
      return "Cette facture a été annulée par un avoir.";
    case "remplace":
      return "Cette facture a été remplacée par une autre.";
    case "annule":
      return "Cette attestation a été annulée.";
    default:
      return "";
  }
}
