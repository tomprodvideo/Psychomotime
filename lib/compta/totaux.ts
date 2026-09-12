import { compteDansLeChiffreDAffaires } from "./types";
import type { DocumentKind, DocumentStatus } from "./types";

/**
 * Totaux d'un ensemble de pièces.
 *
 * MODULE PUR, et c'est délibéré : ces additions sont ce qu'une praticienne
 * recopie sur une déclaration. Elles doivent être vérifiables sans base de
 * données, avec des cas écrits à la main — pièce annulée, avoir, devis,
 * brouillon, trop-perçu.
 *
 * TOUT EST EN CENTIMES ENTIERS. Aucun flottant n'entre ici.
 */

export interface DocumentListItem {
  id: string;
  kind: DocumentKind;
  status: DocumentStatus;
  number: string | null;
  issued_on: string | null;
  period_start: string | null;
  total_cents: number;
  patient_id: string | null;
  /** Nom affichable : le patient lié, sinon celui figé dans l'instantané. */
  patient_nom: string | null;
  /** Le lien vers le dossier a été coupé, mais un nom subsiste. */
  patient_detache: boolean;
  encaisse_cents: number;
  avoirs_cents: number;
  solde_cents: number;
  rectifies_id: string | null;
  repris_de_v1: boolean;
}

export interface Totaux {
  pieces: number;
  /** Brut facturé : toutes les factures émises, avant déduction des avoirs. */
  emis_cents: number;
  /** Brut moins les avoirs. C'est ce chiffre-là qui est le chiffre d'affaires. */
  net_cents: number;
  encaisse_cents: number;
  avoirs_cents: number;
  reste_du_cents: number;
  brouillons: number;
}

export function totauxVides(): Totaux {
  return {
    pieces: 0,
    emis_cents: 0,
    net_cents: 0,
    encaisse_cents: 0,
    avoirs_cents: 0,
    reste_du_cents: 0,
    brouillons: 0,
  };
}

/**
 * Les totaux d'un ensemble de pièces.
 *
 * Un devis n'entre dans aucun total : il n'engage rien. Une facture REMPLACÉE
 * non plus — la remplaçante porte déjà la totalité du montant.
 *
 * Une facture corrigée par un avoir, en revanche, compte pour son montant
 * plein : c'est l'avoir qui vient en déduction, séparément. C'est ce qui rend
 * juste le cas de l'avoir PARTIEL, que la version précédente traitait comme une
 * annulation totale.
 */
export function calculerTotaux(items: DocumentListItem[]): Totaux {
  const t = totauxVides();
  for (const d of items) {
    t.pieces += 1;
    if (d.status === "brouillon") {
      t.brouillons += 1;
      continue;
    }
    if (d.kind === "avoir") {
      t.avoirs_cents += d.total_cents;
      continue;
    }
    if (!compteDansLeChiffreDAffaires(d)) continue;
    t.emis_cents += d.total_cents;
    t.encaisse_cents += d.encaisse_cents;
    // Un trop-perçu ne creuse pas un reste dû négatif : il se soustrairait du
    // total de la période et en fausserait la somme.
    t.reste_du_cents += Math.max(0, d.solde_cents);
  }
  t.net_cents = t.emis_cents - t.avoirs_cents;
  return t;
}
