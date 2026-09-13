/**
 * Types du moteur comptable — modèle cible.
 *
 * Ils décrivent les tables de `supabase/migrations/0009_moteur_comptable.sql`.
 * Les valeurs littérales reprennent exactement les contraintes CHECK de la
 * base : si l'une bouge, l'autre doit bouger, et le typecheck le dira.
 *
 * MODULE PUR. Ni React, ni Supabase, ni `next/headers`. Un composant client
 * doit pouvoir importer un libellé sans entraîner le client serveur avec lui —
 * la leçon a déjà été apprise une fois sur le registre des instruments.
 *
 * TOUT MONTANT EST UN ENTIER DE CENTIMES. Aucun nombre de ce fichier ne
 * représente des euros. `lib/money.ts` tient les conversions.
 */

import { formatCents } from "@/lib/money";
import type { Ton } from "@/components/Statut";

/* ==========================================================================
 *  Natures et états
 * ========================================================================== */

export type DocumentKind =
  | "devis"
  | "facture"
  | "facture_de_remplacement"
  | "avoir";

export type DocumentStatus =
  | "brouillon"
  | "emis"
  | "accepte"
  | "refuse"
  | "expire"
  | "remplace"
  | "annule_par_avoir";

export type BillingFundingScheme =
  | "liberal"
  | "pco"
  | "mdph"
  | "etablissement"
  | "autre";

export type ServicePricing = "unitaire" | "forfait";

export type ServiceNature =
  | "seance"
  | "bilan"
  | "entretien"
  | "groupe"
  | "atelier"
  | "deplacement"
  | "forfait"
  | "autre";

export type VatTreatment =
  | "exoneration_soins"
  | "franchise_en_base"
  | "assujetti"
  | "autre";

export type DateRender = "liste" | "par_date";

export type PaymentMethod =
  | "virement"
  | "cheque"
  | "especes"
  | "carte"
  | "prelevement"
  | "tiers_payant"
  | "autre";

/* ==========================================================================
 *  Enregistrements
 * ========================================================================== */

export interface CatalogItem {
  id: string;
  practice_id: string;
  label: string;
  unit_price_cents: number;
  pricing: ServicePricing;
  nature: ServiceNature;
  default_intro: string | null;
  default_date_render: DateRender;
  vat_treatment: VatTreatment;
  vat_rate_bp: number;
  active: boolean;
  position: number;
}

export interface BillingDocument {
  id: string;
  practice_id: string;
  kind: DocumentKind;
  patient_id: string | null;
  pathway_id: string | null;
  payer_contact_id: string | null;
  payer_is_patient: boolean;
  funding_scheme: BillingFundingScheme | null;
  series: string | null;
  number: string | null;
  status: DocumentStatus;
  issued_on: string | null;
  due_on: string | null;
  period_start: string | null;
  period_end: string | null;
  valid_until: string | null;
  rectifies_id: string | null;
  rectifies_number: string | null;
  rectifies_issued_on: string | null;
  rectification_reason: string | null;
  total_cents: number;
  snapshot: DocumentSnapshot | null;
  note: string | null;
  internal_note: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * L'instantané figé à l'émission.
 *
 * Toutes les clés sont optionnelles : il décrit ce qui était connu à cette
 * date, et une pièce ancienne peut légitimement en savoir moins qu'une pièce
 * d'aujourd'hui. Une clé absente est une information qui n'existait pas — elle
 * ne doit jamais être remplacée par la valeur du jour.
 */
export interface DocumentSnapshot {
  origine?: string;
  emis_le?: string;
  cabinet?: { nom?: string } | null;
  entite_juridique?: {
    denomination?: string | null;
    forme?: string | null;
    adresse?: string | null;
    code_postal?: string | null;
    ville?: string | null;
  } | null;
  identifiants?: { type?: string; valeur?: string }[] | null;
  configuration_fiscale?: {
    regime_fiscal?: string | null;
    regime_tva?: string | null;
    methode_comptable?: string | null;
  } | null;
  payeur?: {
    nom?: string | null;
    adresse?: string | null;
    code_postal?: string | null;
    ville?: string | null;
  } | null;
  patient?: {
    nom?: string | null;
    adresse?: string | null;
    code_postal?: string | null;
    ville?: string | null;
  } | null;
  /** Reprise de la v1 : estimations dérivées, jamais du contenu de facture. */
  estimations_v1?: {
    retrocession_centimes?: number;
    urssaf_centimes?: number;
    note?: string;
  } | null;
  numero_v1?: string | null;
  periode_v1?: { mois?: string | null; annee?: number | null } | null;
  pco_v1?: boolean;
  brut_v1_centimes?: number;
}

export interface BillingLine {
  id: string;
  practice_id: string;
  document_id: string;
  position: number;
  catalog_item_id: string | null;
  label: string;
  nature: string;
  pricing: ServicePricing;
  unit_price_cents: number;
  quantity: number;
  amount_cents: number;
  service_dates: string[];
  date_render: DateRender;
  vat_treatment: string;
  vat_rate_bp: number;
  intro: string | null;
  note: string | null;
}

export interface Payment {
  id: string;
  practice_id: string;
  payer_contact_id: string | null;
  received_on: string;
  amount_cents: number;
  method: PaymentMethod;
  reference: string | null;
  note: string | null;
  is_refund: boolean;
  created_at: string;
}

export interface PaymentAllocation {
  id: string;
  practice_id: string;
  payment_id: string;
  document_id: string;
  amount_cents: number;
}

/* ==========================================================================
 *  Libellés
 * ========================================================================== */

export const KIND_LABELS: Record<DocumentKind, string> = {
  devis: "Devis",
  facture: "Facture",
  facture_de_remplacement: "Facture de remplacement",
  avoir: "Avoir",
};

/** Forme courte, pour une colonne de liste. */
export const KIND_SHORT: Record<DocumentKind, string> = {
  devis: "Devis",
  facture: "Facture",
  facture_de_remplacement: "Remplacement",
  avoir: "Avoir",
};

export const STATUS_LABELS: Record<DocumentStatus, string> = {
  brouillon: "Brouillon",
  emis: "Émise",
  accepte: "Accepté",
  refuse: "Refusé",
  expire: "Expiré",
  remplace: "Remplacée",
  annule_par_avoir: "Annulée par avoir",
};

/**
 * `accepte` rejoint `normal` : il était le seul état du produit peint en
 * émeraude, une seconde teinte de « tout va bien » que rien ne distinguait de
 * la première.
 *
 * `remplace` et `annule_par_avoir` restent en `avis` (ambre) alors que les
 * quatre écrits cliniques peignent `annule` en `arret` (rose). Conservé tel
 * quel : une facture annulée par avoir se refait, un écrit clinique annulé
 * engage autre chose. Question ouverte pour `expert-metier-psychomotricien`.
 */
export const STATUS_TONS: Record<DocumentStatus, Ton> = {
  brouillon: "attente",
  emis: "normal",
  accepte: "normal",
  refuse: "inerte",
  expire: "inerte",
  remplace: "avis",
  annule_par_avoir: "avis",
};

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  virement: "Virement",
  cheque: "Chèque",
  especes: "Espèces",
  carte: "Carte bancaire",
  prelevement: "Prélèvement",
  tiers_payant: "Tiers payant",
  autre: "Autre",
};

export const BILLING_FUNDING_LABELS: Record<BillingFundingScheme, string> = {
  liberal: "Libéral",
  pco: "Plateforme de coordination et d'orientation",
  mdph: "MDPH",
  etablissement: "Établissement",
  autre: "Autre",
};

export const NATURE_LABELS: Record<ServiceNature, string> = {
  seance: "Séance",
  bilan: "Bilan",
  entretien: "Entretien",
  groupe: "Groupe",
  atelier: "Atelier",
  deplacement: "Déplacement",
  forfait: "Forfait",
  autre: "Autre",
};

export const PRICING_LABELS: Record<ServicePricing, string> = {
  unitaire: "Prix unitaire × quantité",
  forfait: "Forfait",
};

export const VAT_LABELS: Record<VatTreatment, string> = {
  exoneration_soins: "Exonérée (soins)",
  franchise_en_base: "Franchise en base",
  assujetti: "Assujettie",
  autre: "Autre",
};

/* ==========================================================================
 *  Règles d'affichage
 * ========================================================================== */

/**
 * Une pièce est-elle encore modifiable ?
 *
 * La base le tient par déclencheur ; l'interface le sait pour ne pas proposer
 * un formulaire que l'enregistrement refusera. Les deux disent la même chose,
 * et c'est la base qui a le dernier mot.
 */
export function estModifiable(d: Pick<BillingDocument, "status">): boolean {
  return d.status === "brouillon";
}

/** Une pièce appelle-t-elle un règlement ? Un devis, non. */
export function appelleReglement(
  d: Pick<BillingDocument, "kind" | "status">,
): boolean {
  return d.kind !== "devis" && d.status !== "brouillon";
}

/**
 * Le solde restant dû, en centimes.
 *
 * Le calcul de référence est en base (`public.document_balance_cents`) : elle
 * seule voit toutes les affectations et tous les avoirs. Cette fonction sert
 * aux totaux d'une liste déjà chargée, à partir des mêmes termes.
 */
export function soldeCentimes(
  total: number,
  affecte: number,
  avoirs: number,
): number {
  return total - affecte - avoirs;
}

/**
 * Une pièce entre-t-elle au BRUT dans le chiffre d'affaires ?
 *
 * LA VERSION PRÉCÉDENTE DE CETTE FONCTION ÉTAIT FAUSSE, et d'une façon qui
 * n'était pas visible : elle écartait toute facture portant l'état
 * « annulée par avoir », quel que soit le MONTANT de l'avoir. Une facture de
 * 180 € corrigée par un avoir de 20 € disparaissait donc entièrement du
 * chiffre d'affaires — 180 € de moins au lieu de 20 €.
 *
 * La règle juste est plus simple : le brut compte toute facture émise, et les
 * avoirs se déduisent SÉPARÉMENT. Une facture entièrement annulée retombe
 * ainsi à zéro d'elle-même, sans cas particulier.
 *
 * Une seule pièce reste écartée : celle qui a été REMPLACÉE. La facture de
 * remplacement porte déjà la totalité du montant ; compter les deux facturerait
 * deux fois la même prestation.
 */
export function compteDansLeChiffreDAffaires(
  d: Pick<BillingDocument, "kind" | "status">,
): boolean {
  if (d.kind === "devis") return false;
  if (d.kind === "avoir") return false;
  if (d.status === "brouillon") return false;
  if (d.status === "remplace") return false;
  return true;
}

/**
 * Intitulé affichable d'une pièce.
 *
 * Un brouillon n'a pas de numéro — et ne doit pas en afficher un, même
 * provisoire : un numéro visible avant l'émission serait compris comme
 * attribué.
 */
export function documentTitre(
  d: Pick<BillingDocument, "kind" | "number" | "status">,
): string {
  if (d.status === "brouillon" || !d.number) {
    return `${KIND_LABELS[d.kind]} — brouillon`;
  }
  return `${KIND_LABELS[d.kind]} ${d.number}`;
}

/* ==========================================================================
 *  Charges du cabinet
 * ==========================================================================
 *  DEUX NATURES QU'IL NE FAUT PAS CONFONDRE.
 *
 *  · Une CHARGE est un décaissement constaté : elle a eu lieu, à une date, pour
 *    un montant. Elle entre dans les totaux de la période qui la contient.
 *
 *  · Une RÉCURRENCE est un MODÈLE : elle dit ce qui est dû, à partir de quand et
 *    jusqu'à quand. Elle n'est pas un décaissement. La version précédente les
 *    confondait — les récurrences vivaient dans un JSON sans dates, si bien que
 *    modifier un loyer réécrivait rétroactivement toutes les années passées.
 * ========================================================================== */

export type CategorieCharge =
  | "loyer"
  | "retrocession"
  | "cotisations"
  | "assurance"
  | "materiel"
  | "formation"
  | "deplacement"
  | "logiciel"
  | "honoraires"
  | "autre";

export const CATEGORIE_LABELS: Record<CategorieCharge, string> = {
  loyer: "Loyer",
  retrocession: "Rétrocession",
  cotisations: "Cotisations",
  assurance: "Assurance",
  materiel: "Matériel",
  formation: "Formation",
  deplacement: "Déplacement",
  logiciel: "Logiciel",
  honoraires: "Honoraires",
  autre: "Autre",
};

export interface Charge {
  id: string;
  practice_id: string;
  category: CategorieCharge;
  label: string | null;
  amount_cents: number;
  spent_on: string;
  period_start: string | null;
  period_end: string | null;
  recurrence_id: string | null;
  note: string | null;
}

export interface Recurrence {
  id: string;
  practice_id: string;
  category: CategorieCharge;
  label: string;
  amount_cents: number;
  period: "mensuel" | "annuel";
  starts_on: string;
  ends_on: string | null;
  active: boolean;
}

export interface ResumeCharges {
  total_cents: number;
  parCategorie: { categorie: CategorieCharge; total_cents: number }[];
  detail: string;
}

/**
 * Totalise les charges constatées d'une période.
 *
 * Seules les charges CONSTATÉES y entrent. Les récurrences sont présentées à
 * part : les additionner ici ferait passer une projection pour un décaissement.
 */
export function resumeCharges(charges: Charge[]): ResumeCharges {
  const parCategorie = new Map<CategorieCharge, number>();
  let total = 0;
  for (const c of charges) {
    total += c.amount_cents;
    parCategorie.set(c.category, (parCategorie.get(c.category) ?? 0) + c.amount_cents);
  }

  const classees = [...parCategorie.entries()]
    .map(([categorie, total_cents]) => ({ categorie, total_cents }))
    .sort((a, b) => b.total_cents - a.total_cents);

  const premiere = classees[0];
  return {
    total_cents: total,
    parCategorie: classees,
    detail:
      charges.length === 0
        ? "Aucune charge saisie"
        : premiere
          ? `dont ${CATEGORIE_LABELS[premiere.categorie].toLowerCase()} ${formatCents(premiere.total_cents)}`
          : `${charges.length} charge(s)`,
  };
}

/**
 * Ce qu'une récurrence représenterait sur une période, si elle était payée.
 *
 * C'EST UNE PROJECTION, et l'appelant doit la présenter comme telle. Elle ne
 * remplace aucune charge constatée et ne s'additionne jamais avec elles sans
 * que l'écran le dise.
 */
export function projeterRecurrence(
  r: Recurrence,
  du: string,
  au: string,
): number {
  if (!r.active) return 0;
  const debut = r.starts_on > du ? r.starts_on : du;
  const fin = r.ends_on && r.ends_on < au ? r.ends_on : au;
  if (debut > fin) return 0;

  const [ad, md] = [Number(debut.slice(0, 4)), Number(debut.slice(5, 7))];
  const [af, mf] = [Number(fin.slice(0, 4)), Number(fin.slice(5, 7))];
  const mois = (af - ad) * 12 + (mf - md) + 1;

  return r.period === "mensuel"
    ? r.amount_cents * mois
    : Math.round((r.amount_cents * mois) / 12);
}
