import { test } from "node:test";
import assert from "node:assert/strict";
import { calculerTotaux, type DocumentListItem } from "@/lib/compta/totaux";

/**
 * Ces additions sont ce qu'une praticienne recopie sur une déclaration. Chaque
 * cas ci-dessous correspond à une pièce que la version précédente comptait mal,
 * ou pas du tout.
 */

function piece(p: Partial<DocumentListItem>): DocumentListItem {
  return {
    id: p.id ?? crypto.randomUUID(),
    kind: p.kind ?? "facture",
    status: p.status ?? "emis",
    number: p.number ?? "2026-001",
    issued_on: p.issued_on ?? "2026-03-01",
    period_start: null,
    total_cents: p.total_cents ?? 0,
    patient_id: null,
    patient_nom: null,
    patient_detache: false,
    encaisse_cents: p.encaisse_cents ?? 0,
    avoirs_cents: p.avoirs_cents ?? 0,
    solde_cents:
      p.solde_cents ??
      (p.total_cents ?? 0) - (p.encaisse_cents ?? 0) - (p.avoirs_cents ?? 0),
    rectifies_id: p.rectifies_id ?? null,
    repris_de_v1: false,
  };
}

test("une facture émise et réglée compte en facturé et en encaissé", () => {
  const t = calculerTotaux([
    piece({ total_cents: 13000, encaisse_cents: 13000 }),
  ]);
  assert.equal(t.emis_cents, 13000);
  assert.equal(t.encaisse_cents, 13000);
  assert.equal(t.reste_du_cents, 0);
});

test("un règlement partiel laisse un reste dû", () => {
  const t = calculerTotaux([
    piece({ total_cents: 9000, encaisse_cents: 4500 }),
  ]);
  assert.equal(t.emis_cents, 9000);
  assert.equal(t.encaisse_cents, 4500);
  assert.equal(t.reste_du_cents, 4500);
});

test("un devis n'entre dans aucun total : il n'engage rien", () => {
  const t = calculerTotaux([piece({ kind: "devis", total_cents: 50000 })]);
  assert.equal(t.emis_cents, 0);
  assert.equal(t.reste_du_cents, 0);
  assert.equal(t.pieces, 1);
});

test("un brouillon est compté comme brouillon, jamais comme facturé", () => {
  const t = calculerTotaux([
    piece({ status: "brouillon", number: null, total_cents: 20000 }),
  ]);
  assert.equal(t.emis_cents, 0);
  assert.equal(t.brouillons, 1);
});

test("une facture annulée par avoir sort du chiffre d'affaires", () => {
  // Le défaut inverse — la compter encore — facture deux fois la même
  // prestation, ce que l'avoir sert précisément à défaire.
  const t = calculerTotaux([
    piece({ status: "annule_par_avoir", total_cents: 6000 }),
    piece({ kind: "avoir", total_cents: 6000 }),
  ]);
  assert.equal(t.emis_cents, 0);
  assert.equal(t.avoirs_cents, 6000);
});

test("une facture remplacée ne compte plus, la remplaçante oui", () => {
  const t = calculerTotaux([
    piece({ status: "remplace", total_cents: 6000 }),
    piece({ kind: "facture_de_remplacement", total_cents: 7000, encaisse_cents: 7000 }),
  ]);
  assert.equal(t.emis_cents, 7000);
  assert.equal(t.encaisse_cents, 7000);
});

test("un trop-perçu ne creuse pas un reste dû négatif", () => {
  // La v1 laissait apparaître un « reste dû » négatif, qui se soustrayait du
  // total de la période et en faussait la somme.
  const t = calculerTotaux([
    piece({ total_cents: 6000, encaisse_cents: 8000, solde_cents: -2000 }),
  ]);
  assert.equal(t.reste_du_cents, 0);
  assert.equal(t.encaisse_cents, 8000);
});

test("les montants restent des entiers de centimes", () => {
  const t = calculerTotaux([
    piece({ total_cents: 3230, encaisse_cents: 1077 }),
    piece({ total_cents: 4500, encaisse_cents: 1500 }),
  ]);
  assert.equal(t.emis_cents, 7730);
  assert.equal(t.encaisse_cents, 2577);
  assert.ok(Number.isInteger(t.emis_cents));
  assert.ok(Number.isInteger(t.reste_du_cents));
});

test("un ensemble vide donne des totaux nuls, pas NaN", () => {
  const t = calculerTotaux([]);
  assert.equal(t.emis_cents, 0);
  assert.equal(t.encaisse_cents, 0);
  assert.equal(t.pieces, 0);
});
