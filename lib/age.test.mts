import assert from "node:assert/strict";
import test from "node:test";
import { ageAt, formatAge, formatAgeAt } from "@/lib/age";

/* Toutes les dates de ce fichier sont fictives. */

test("l'âge se calcule à la date demandée, pas à celle du jour", () => {
  // C'est le défaut corrigé : un bilan passé en février et relu en septembre
  // affichait sept mois de trop.
  const naissance = "2018-04-12";
  assert.equal(formatAgeAt(naissance, "2026-02-20"), "7 ans 10 mois");
  assert.equal(formatAgeAt(naissance, "2026-09-11"), "8 ans 4 mois");

  // Le même appel à deux moments différents ne rend pas la même chose — et
  // c'est précisément pourquoi la date doit être passée, jamais devinée.
  assert.notEqual(
    formatAgeAt(naissance, "2026-02-20"),
    formatAgeAt(naissance, "2026-09-11"),
  );
});

test("la veille de l'anniversaire, l'année n'est pas encore acquise", () => {
  assert.deepEqual(ageAt("2018-04-12", "2026-04-11"), {
    years: 7,
    months: 11,
    days: 30,
    totalMonths: 95,
  });
  assert.deepEqual(ageAt("2018-04-12", "2026-04-12"), {
    years: 8,
    months: 0,
    days: 0,
    totalMonths: 96,
  });
});

test("le 29 février est traité sans faire disparaître un jour", () => {
  const a = ageAt("2024-02-29", "2026-02-28");
  assert.equal(a?.years, 1);
  assert.equal(a?.months, 11);
  const b = ageAt("2024-02-29", "2026-03-01");
  assert.equal(b?.years, 2);
});

test("sous un an, l'âge se dit en mois", () => {
  assert.equal(formatAgeAt("2026-01-15", "2026-07-20"), "6 mois");
  assert.equal(formatAgeAt("2026-08-01", "2026-08-15"), "14 jours");
  assert.equal(formatAgeAt("2026-08-01", "2026-08-02"), "1 jour");
});

test("l'accord en nombre est correct", () => {
  assert.equal(formatAgeAt("2025-06-01", "2026-06-01"), "1 an");
  assert.equal(formatAgeAt("2024-06-01", "2026-06-01"), "2 ans");
  assert.equal(formatAgeAt("2025-06-01", "2026-07-01"), "1 an 1 mois");
});

test("une date de référence antérieure à la naissance ne rend pas un âge", () => {
  // Mieux vaut ne rien afficher qu'afficher un nombre trompeur.
  assert.equal(ageAt("2026-05-01", "2026-01-01"), null);
  assert.equal(formatAgeAt("2026-05-01", "2026-01-01"), "");
});

test("une date manquante ne rend pas un âge", () => {
  assert.equal(ageAt(null, "2026-01-01"), null);
  assert.equal(ageAt(undefined, "2026-01-01"), null);
  assert.equal(ageAt("", "2026-01-01"), null);
  assert.equal(ageAt("pas une date", "2026-01-01"), null);
  assert.equal(formatAge(null), "");
});

test("totalMonths sert à vérifier une tranche d'âge annoncée", () => {
  // Un instrument étalonné de 3 à 6 ans : 36 à 83 mois révolus.
  const age = ageAt("2021-09-30", "2026-02-18");
  assert.equal(age?.totalMonths, 52);
  assert.ok(age!.totalMonths >= 36 && age!.totalMonths <= 83);

  const trop_age = ageAt("2016-07-19", "2026-02-18");
  assert.equal(trop_age?.totalMonths, 114); // 9 ans 6 mois révolus
  assert.ok(trop_age!.totalMonths > 83);
});
