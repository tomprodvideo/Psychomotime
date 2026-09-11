import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyRate,
  centsToEuros,
  eurosToCents,
  formatBasisPoints,
  formatCents,
  parseAmountToCents,
  rateToBasisPoints,
  splitCents,
  sumCents,
} from "./money";

/**
 * `Intl.NumberFormat("fr-FR")` sépare le nombre du symbole par une espace
 * insécable étroite (U+202F), et non par une espace ordinaire. C'est correct
 * typographiquement ; les comparaisons de ce fichier la normalisent, et un test
 * dédié la vérifie explicitement pour qu'elle ne disparaisse pas par accident.
 */
function normaliserEspaces(s: string): string {
  return s.replace(/[\u202f\u00a0\u2009]/g, " ");
}

/* ==========================================================================
 *  Le défaut que ce module corrige
 * ========================================================================== */

/** L'implémentation précédente, reproduite pour documenter ce qui était faux. */
function round2Ancien(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

test("l'ancien arrondi perdait un centime sur une séance à 32,30 € à 25 %", () => {
  // Preuve du défaut : le flottant rend 8,07 là où le calcul commercial rend 8,08.
  assert.equal(round2Ancien(32.3 * 0.25), 8.07);

  // Le calcul entier rend le bon montant.
  const brut = parseAmountToCents("32,30");
  assert.equal(brut, 3230);
  assert.equal(applyRate(brut!, 2500), 808);
  assert.equal(normaliserEspaces(formatCents(808)), "8,08 €");
});

test("l'ancien arrondi était incohérent d'un montant à l'autre", () => {
  // Même configuration décimale (un demi-centime), deux résultats opposés.
  assert.equal(round2Ancien(1.005), 1.01); // arrondi au supérieur
  assert.equal(round2Ancien(8.165), 8.16); // arrondi à l'inférieur

  // En centimes entiers, la règle s'applique toujours de la même façon, quel
  // que soit l'ordre de grandeur : le demi-centime monte, toujours.
  assert.equal(applyRate(201, 5000), 101); // 100,5 centimes → 101
  assert.equal(applyRate(1633, 5000), 817); // 816,5 centimes → 817
});

/* ==========================================================================
 *  applyRate
 * ========================================================================== */

test("applyRate ne fait jamais intervenir de flottant", () => {
  assert.equal(applyRate(10_000, 2500), 2500); // 100 € à 25 % → 25 €
  assert.equal(applyRate(10_000, 2320), 2320); // 100 € à 23,2 % → 23,20 €
  assert.equal(applyRate(0, 2500), 0);
  assert.equal(applyRate(12_345, 0), 0);
  assert.equal(applyRate(12_345, 10_000), 12_345); // 100 % rend le montant
});

test("applyRate arrondit le demi-centime en s'éloignant de zéro", () => {
  // 5 centimes à 50 % = 2,5 centimes → 3
  assert.equal(applyRate(5, 5000), 3);
  // Symétrique pour un montant négatif (un avoir).
  assert.equal(applyRate(-5, 5000), -3);
  // 15 centimes à 50 % = 7,5 → 8
  assert.equal(applyRate(15, 5000), 8);
});

test("applyRate reste exact sur des montants annuels", () => {
  const annuel = 4_500_000; // 45 000 €
  assert.equal(applyRate(annuel, 2500), 1_125_000); // rétrocession 25 %
  const apresRetro = annuel - applyRate(annuel, 2500);
  assert.equal(apresRetro, 3_375_000); // 33 750 €
  assert.equal(applyRate(apresRetro, 2320), 783_000); // 7 830 € estimés
});

/* ==========================================================================
 *  parseAmountToCents
 * ========================================================================== */

test("parseAmountToCents lit les saisies françaises courantes", () => {
  assert.equal(parseAmountToCents("32,30"), 3230);
  assert.equal(parseAmountToCents("32.30"), 3230);
  assert.equal(parseAmountToCents("1 234,56"), 123_456);
  assert.equal(parseAmountToCents("1 234,56 €"), 123_456);
  assert.equal(parseAmountToCents("1.234,56"), 123_456);
  assert.equal(parseAmountToCents("45"), 4500);
  assert.equal(parseAmountToCents(",5"), 50);
  assert.equal(parseAmountToCents("-12,50"), -1250);
  assert.equal(parseAmountToCents("(12,50)"), -1250);
});

test("parseAmountToCents arrondit au-delà de deux décimales", () => {
  assert.equal(parseAmountToCents("1,005"), 101);
  assert.equal(parseAmountToCents("1,004"), 100);
  assert.equal(parseAmountToCents("8,165"), 817);
});

test("un champ vide n'est pas zéro", () => {
  // Distinguer l'absence de la valeur nulle est le fondement de la règle
  // « une donnée absente n'est jamais convertie en résultat ».
  assert.equal(parseAmountToCents(""), null);
  assert.equal(parseAmountToCents("   "), null);
  assert.equal(parseAmountToCents(null), null);
  assert.equal(parseAmountToCents(undefined), null);
  assert.equal(parseAmountToCents("abc"), null);
  assert.equal(parseAmountToCents("12,3,4x"), null);
  assert.equal(parseAmountToCents(Number.NaN), null);
});

/* ==========================================================================
 *  sumCents et splitCents
 * ========================================================================== */

test("additionner des centimes est exact, là où additionner des euros ne l'est pas", () => {
  // La somme flottante classique qui ne retombe pas juste.
  assert.notEqual(0.1 + 0.2, 0.3);
  assert.equal(sumCents([10, 20]), 30);

  const lignes = [3230, 3230, 3230, 4500, 1250];
  assert.equal(sumCents(lignes), 15_440);
  assert.equal(normaliserEspaces(formatCents(sumCents(lignes))), "154,40 €");
});

test("splitCents répartit sans perdre ni créer un centime", () => {
  // Une dépense annuelle de 100 € étalée sur douze mois.
  const parts = splitCents(10_000, 12);
  assert.equal(parts.length, 12);
  assert.equal(sumCents(parts), 10_000);
  assert.deepEqual(parts.slice(0, 4), [834, 834, 834, 834]);
  assert.deepEqual(parts.slice(-2), [833, 833]);

  // Douze fois Math.round(100/12) donnerait 99,96 € : un manque de 4 centimes.
  assert.notEqual(Math.round((100 / 12) * 100) * 12, 10_000);
});

test("splitCents conserve le signe et refuse un découpage absurde", () => {
  assert.equal(sumCents(splitCents(-10_000, 12)), -10_000);
  assert.deepEqual(splitCents(100, 0), []);
  assert.deepEqual(splitCents(100, -3), []);
  assert.deepEqual(splitCents(100, 1.5), []);
});

/* ==========================================================================
 *  Conversions et affichage
 * ========================================================================== */

test("les conversions euros ↔ centimes sont réciproques", () => {
  for (const euros of [0, 1, 32.3, 45.5, 1234.56, 99_999.99]) {
    assert.equal(centsToEuros(eurosToCents(euros)), euros);
  }
});

test("rateToBasisPoints reprend les taux décimaux hérités", () => {
  assert.equal(rateToBasisPoints(0.25), 2500);
  assert.equal(rateToBasisPoints(0.232), 2320);
  assert.equal(rateToBasisPoints(0), 0);
  assert.equal(rateToBasisPoints(1), 10_000);
  assert.equal(rateToBasisPoints(Number.NaN), 0);
});

test("l'affichage est en français et ne trahit pas le montant", () => {
  assert.equal(normaliserEspaces(formatCents(3230)), "32,30 €");
  assert.equal(normaliserEspaces(formatCents(0)), "0,00 €");
  assert.equal(normaliserEspaces(formatCents(null)), "0,00 €");
  assert.equal(normaliserEspaces(formatCents(-1250)), "-12,50 €");
  assert.equal(normaliserEspaces(formatBasisPoints(2500)), "25 %");
  assert.equal(normaliserEspaces(formatBasisPoints(2320)), "23,2 %");
  assert.equal(normaliserEspaces(formatBasisPoints(null)), "0 %");
});

test("le séparateur avant le symbole est insécable", () => {
  // Ce qui compte, c'est qu'aucun retour à la ligne ne puisse séparer le
  // montant de son symbole à l'impression d'une facture. Le caractère exact
  // dépend de la version d'ICU — insécable étroit (U+202F) ou insécable
  // ordinaire (U+00A0) — et ce test accepte les deux, mais refuse une espace
  // ordinaire, qui elle autoriserait la coupure.
  const separateur = formatCents(3230).codePointAt(5);
  assert.ok(
    separateur === 0x202f || separateur === 0x00a0,
    `Le séparateur avant « € » doit être insécable, obtenu U+${separateur?.toString(16).toUpperCase()}.`,
  );
});
