import { centsToEuros } from "@/lib/money";
import type { DocumentListItem, Totaux } from "./queries";
import { CATEGORIE_LABELS, KIND_LABELS, STATUS_LABELS } from "./types";
import type { Charge } from "./types";

/**
 * Export de la période, au format lisible par un tableur français.
 *
 * MODULE PUR : ni React, ni accès base, ni horloge. La date d'export est un
 * paramètre — un export doit pouvoir être reproduit à l'identique, ce qu'une
 * lecture de `new Date()` interdirait.
 *
 * TROIS CHOIX DE FOND.
 *
 * 1. **Point-virgule et BOM.** Un tableur français ouvre ainsi le fichier
 *    directement, sans passer par un assistant d'importation.
 *
 * 2. **Les montants sortent en EUROS avec deux décimales et une virgule.** Le
 *    stockage est en centimes entiers ; la conversion n'a lieu qu'ici, au
 *    dernier moment. Un tableur qui lirait « 4500 » comprendrait 4 500 €.
 *
 * 3. **Aucun contenu clinique.** Cet export part chez un tiers — un
 *    expert-comptable le plus souvent. Il ne porte donc que ce qu'une
 *    comptabilité exige : nature, numéro, date, patient, montants. Aucune note
 *    interne, aucun motif, aucun élément de dossier n'y entre.
 */

type Cellule = string | number | null | undefined;

/** Deux décimales, virgule décimale. Jamais de séparateur de milliers. */
export function euroCsv(centimes: number): string {
  return centsToEuros(centimes).toFixed(2).replace(".", ",");
}

/**
 * Caractères par lesquels un tableur reconnaît une FORMULE.
 *
 * Excel et LibreOffice évaluent toute cellule commençant par l'un d'eux, y
 * compris entre guillemets. Un libellé de charge saisi `=HYPERLINK(...)`
 * s'exécuterait donc sur le poste de l'expert-comptable — hors du périmètre de
 * sécurité du logiciel, sur une machine qui ne nous appartient pas.
 *
 * Dans le modèle d'acteurs actuel, seul un membre du cabinet écrit ces champs :
 * ce n'est pas une faille démontrée contre le cabinet lui-même. C'est une
 * défense qui doit exister AVANT qu'un second rôle écrive dans le cabinet — et
 * ces rôles existent déjà.
 */
const DEBUT_DE_FORMULE = /^[=+\-@\t\r]/;

/**
 * Un nombre écrit à la française : « -20,00 », « 383,33 », « 12 ».
 *
 * LE PIÈGE DE CETTE PROTECTION : un montant négatif commence par un tiret.
 * Le préfixer d'une apostrophe en ferait du TEXTE, et les sommes du tableur
 * cesseraient de tomber juste — un avoir n'entrerait plus dans aucun total.
 * Le correctif contre les formules ne doit donc jamais toucher un nombre.
 */
const NOMBRE = /^-?\d+(,\d+)?$/;

function echapper(v: Cellule): string {
  let s = String(v ?? "");
  // L'apostrophe de tête est la convention reconnue : le tableur affiche le
  // texte tel quel et ne l'évalue pas.
  if (DEBUT_DE_FORMULE.test(s) && !NOMBRE.test(s)) s = "'" + s;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function ligne(cellules: Cellule[]): string {
  return cellules.map(echapper).join(";");
}

export interface ExportCompta {
  libellePeriode: string;
  exporteLe: string;
  pieces: DocumentListItem[];
  totaux: Totaux;
  charges: Charge[];
  /** Vrai si la période dépassait le plafond de chargement. */
  tronque?: boolean;
}

export function construireCsv(e: ExportCompta): string {
  const lignes: string[] = [];

  lignes.push(ligne([`COMPTABILITÉ — ${e.libellePeriode}`]));
  lignes.push(ligne(["Exporté le", e.exporteLe]));
  if (e.tronque) {
    lignes.push(
      ligne([
        "ATTENTION",
        "La période dépasse le plafond de chargement : cet export est INCOMPLET.",
      ]),
    );
  }
  lignes.push("");

  lignes.push(ligne(["RÉCAPITULATIF", "Montant (€)"]));
  lignes.push(ligne(["Pièces émises", e.totaux.pieces - e.totaux.brouillons]));
  lignes.push(ligne(["Facturé (brut)", euroCsv(e.totaux.emis_cents)]));
  lignes.push(ligne(["Avoirs", euroCsv(e.totaux.avoirs_cents)]));
  lignes.push(ligne(["Facturé net des avoirs", euroCsv(e.totaux.net_cents)]));
  lignes.push(ligne(["Encaissé", euroCsv(e.totaux.encaisse_cents)]));
  lignes.push(ligne(["Reste dû", euroCsv(e.totaux.reste_du_cents)]));
  const charges = e.charges.reduce((s, c) => s + c.amount_cents, 0);
  lignes.push(ligne(["Charges constatées", euroCsv(charges)]));
  lignes.push(
    ligne(["Net encaissé", euroCsv(e.totaux.encaisse_cents - charges)]),
  );
  lignes.push("");

  lignes.push(
    ligne([
      "PIÈCES",
      "Nature",
      "Numéro",
      "Date d'émission",
      "Patient",
      "Montant (€)",
      "Encaissé (€)",
      "Reste dû (€)",
      "État",
    ]),
  );
  for (const p of e.pieces) {
    if (p.status === "brouillon") continue; // un brouillon n'est pas une pièce
    lignes.push(
      ligne([
        "",
        KIND_LABELS[p.kind],
        p.number ?? "",
        p.issued_on ?? "",
        p.patient_nom ?? "",
        euroCsv(p.kind === "avoir" ? -p.total_cents : p.total_cents),
        euroCsv(p.encaisse_cents),
        euroCsv(p.solde_cents),
        STATUS_LABELS[p.status],
      ]),
    );
  }
  lignes.push("");

  lignes.push(
    ligne(["CHARGES", "Catégorie", "Libellé", "Date", "Montant (€)"]),
  );
  for (const c of e.charges) {
    lignes.push(
      ligne([
        "",
        CATEGORIE_LABELS[c.category],
        c.label ?? "",
        c.spent_on,
        euroCsv(c.amount_cents),
      ]),
    );
  }

  // Le BOM fait ouvrir le fichier en UTF-8 par un tableur français.
  return "﻿" + lignes.join("\r\n") + "\r\n";
}

/** Nom de fichier sans espace ni accent, sûr pour tous les systèmes. */
export function nomFichierCsv(libellePeriode: string): string {
  const base = libellePeriode
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `comptabilite-${base || "periode"}.csv`;
}
