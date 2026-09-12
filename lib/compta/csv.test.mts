import { test } from "node:test";
import assert from "node:assert/strict";
import { construireCsv, euroCsv, nomFichierCsv } from "@/lib/compta/csv";
import type { DocumentListItem, Totaux } from "@/lib/compta/totaux";
import type { Charge } from "@/lib/compta/types";

/**
 * Cet export part chez un tiers. Deux choses s'y vérifient : que les nombres
 * arrivent lisibles dans un tableur français, et qu'aucun contenu clinique n'y
 * entre.
 */

const totaux: Totaux = {
  pieces: 2,
  emis_cents: 13000,
  net_cents: 13000,
  encaisse_cents: 9000,
  avoirs_cents: 0,
  reste_du_cents: 4000,
  brouillons: 1,
};

const pieces: DocumentListItem[] = [
  {
    id: "1", kind: "facture", status: "emis", number: "2026-001",
    issued_on: "2026-03-25", period_start: null, total_cents: 13000,
    patient_id: null, patient_nom: "Marceline Cabriole", patient_detache: false,
    encaisse_cents: 9000, avoirs_cents: 0, solde_cents: 4000,
    rectifies_id: null, repris_de_v1: false,
  },
  {
    id: "2", kind: "facture", status: "brouillon", number: null,
    issued_on: null, period_start: null, total_cents: 5000,
    patient_id: null, patient_nom: null, patient_detache: false,
    encaisse_cents: 0, avoirs_cents: 0, solde_cents: 5000,
    rectifies_id: null, repris_de_v1: false,
  },
];

const charges: Charge[] = [
  {
    id: "c1", practice_id: "p", category: "loyer",
    label: "Loyer du cabinet", amount_cents: 38333, spent_on: "2026-03-05",
    period_start: null, period_end: null, recurrence_id: null,
    note: "Note interne à ne pas exporter",
  },
];

test("les montants sortent en euros, virgule décimale, deux décimales", () => {
  // Un tableur qui lirait « 4500 » comprendrait 4 500 €, pas 45,00 €.
  assert.equal(euroCsv(4500), "45,00");
  assert.equal(euroCsv(38333), "383,33");
  assert.equal(euroCsv(0), "0,00");
  assert.equal(euroCsv(-2000), "-20,00");
});

test("le fichier commence par un BOM et sépare au point-virgule", () => {
  const csv = construireCsv({
    libellePeriode: "mars 2026", exporteLe: "25/03/2026",
    pieces, totaux, charges,
  });
  assert.ok(csv.startsWith("﻿"));
  assert.ok(csv.includes(";"));
});

test("un brouillon n'entre pas dans l'export : ce n'est pas une pièce", () => {
  const csv = construireCsv({
    libellePeriode: "mars 2026", exporteLe: "25/03/2026",
    pieces, totaux, charges,
  });
  assert.ok(csv.includes("2026-001"));
  assert.equal(csv.split("\r\n").filter((l) => l.includes("Facture")).length, 1);
});

test("aucune note interne ne quitte le logiciel", () => {
  const csv = construireCsv({
    libellePeriode: "mars 2026", exporteLe: "25/03/2026",
    pieces, totaux, charges,
  });
  assert.ok(!csv.includes("Note interne"));
  assert.ok(csv.includes("Loyer du cabinet"));
});

test("un export tronqué le dit, au lieu de se faire passer pour complet", () => {
  const csv = construireCsv({
    libellePeriode: "2026", exporteLe: "25/03/2026",
    pieces, totaux, charges, tronque: true,
  });
  assert.ok(csv.includes("INCOMPLET"));
});

test("un point-virgule dans un libellé ne casse pas la colonne suivante", () => {
  const csv = construireCsv({
    libellePeriode: "mars 2026", exporteLe: "25/03/2026",
    pieces, totaux,
    charges: [{ ...charges[0]!, label: 'Loyer; mars "2026"' }],
  });
  assert.ok(csv.includes('"Loyer; mars ""2026"""'));
});

test("le nom de fichier ne porte ni accent ni espace", () => {
  assert.equal(nomFichierCsv("février 2026"), "comptabilite-fevrier-2026.csv");
  assert.equal(nomFichierCsv("Depuis le début"), "comptabilite-depuis-le-debut.csv");
});

test("une cellule qui ressemble à une formule ne s'exécute pas chez le tiers", () => {
  // Excel et LibreOffice évaluent toute cellule commençant par = + - @ ou une
  // tabulation, guillemets compris. Le fichier part sur une machine qui ne nous
  // appartient pas : il ne doit rien y déclencher.
  const csv = construireCsv({
    libellePeriode: "mars 2026", exporteLe: "25/03/2026",
    pieces, totaux,
    charges: [{ ...charges[0]!, label: '=HYPERLINK("http://exemple-fictif.test")' }],
  });
  assert.ok(csv.includes("'=HYPERLINK"), "l'apostrophe de tête doit neutraliser la formule");
  assert.ok(!/;=HYPERLINK/.test(csv), "aucune cellule ne doit commencer par =");
});

test("un montant négatif reste un nombre, pas une formule", () => {
  // LE PIÈGE de la protection précédente : « -20,00 » commence par un tiret.
  // Le préfixer en ferait du TEXTE, et l'avoir cesserait d'entrer dans les
  // sommes du tableur. Le cas doit donc porter un avoir RÉEL.
  assert.equal(euroCsv(-2000), "-20,00");
  const avoir: DocumentListItem = {
    ...pieces[0]!, id: "3", kind: "avoir", number: "A2026-001",
    total_cents: 2000, encaisse_cents: 0, solde_cents: 2000,
  };
  const csv = construireCsv({
    libellePeriode: "mars 2026", exporteLe: "25/03/2026",
    pieces: [...pieces, avoir],
    totaux: { ...totaux, avoirs_cents: 2000, net_cents: 11000 },
    charges: [],
  });
  assert.ok(csv.includes(";-20,00;"), "le montant de l'avoir sort en négatif");
  assert.ok(!csv.includes("'-"), "et il n'est jamais préfixé d'une apostrophe");
});
