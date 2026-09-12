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
  /** Chiffre d'affaires émis : factures, hors devis, hors pièces annulées. */
  emis_cents: number;
  encaisse_cents: number;
  avoirs_cents: number;
  reste_du_cents: number;
  brouillons: number;
}

export function totauxVides(): Totaux {
  return {
    pieces: 0,
    emis_cents: 0,
    encaisse_cents: 0,
    avoirs_cents: 0,
    reste_du_cents: 0,
    brouillons: 0,
  };
}

/**
 * Les totaux d'un ensemble de pièces.
 *
 * Un devis n'entre dans aucun total : il n'engage rien. Une pièce annulée ou
 * remplacée non plus — la compter reviendrait à facturer deux fois la même
 * prestation, ce qui est exactement ce que l'avoir sert à défaire.
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
    t.reste_du_cents += Math.max(0, d.solde_cents);
  }
  return t;
}

