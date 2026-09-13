import assert from "node:assert/strict";
import test from "node:test";
import { dateCivile, fuseauUtilisable, FUSEAU_PAR_DEFAUT } from "@/lib/dateCivile";

/* Instants fictifs, choisis autour des bascules de jour. */

test("à 00 h 30 à Paris, c'est déjà le lendemain — l'hiver (UTC+1)", () => {
  /* LE DÉFAUT CORRIGÉ. `toISOString().slice(0, 10)` rendait « 2026-03-12 ». */
  const instant = new Date("2026-03-12T23:30:00Z");
  assert.equal(instant.toISOString().slice(0, 10), "2026-03-12", "la mesure du défaut a changé");
  assert.equal(dateCivile(instant, "Europe/Paris"), "2026-03-13");
});

test("à 00 h 30 à Paris, c'est déjà le lendemain — l'été (UTC+2)", () => {
  assert.equal(dateCivile(new Date("2026-07-12T22:30:00Z"), "Europe/Paris"), "2026-07-13");
});

test("à 23 h 59 à Paris, c'est encore le même jour", () => {
  assert.equal(dateCivile(new Date("2026-07-12T21:59:00Z"), "Europe/Paris"), "2026-07-12");
});

test("la nuit du passage à l'heure d'été ne fait ni sauter ni doubler un jour", () => {
  /* 29 mars 2026 : à Paris, 02:00 devient 03:00. */
  assert.equal(dateCivile(new Date("2026-03-28T23:30:00Z"), "Europe/Paris"), "2026-03-29");
  assert.equal(dateCivile(new Date("2026-03-29T01:30:00Z"), "Europe/Paris"), "2026-03-29");
});

test("le fuseau DU CABINET fait foi : le jour ne bascule pas à la même heure outre-mer", () => {
  const instant = new Date("2026-03-12T21:30:00Z");
  assert.equal(dateCivile(instant, "Europe/Paris"), "2026-03-12"); // 22 h 30
  assert.equal(dateCivile(instant, "Indian/Reunion"), "2026-03-13"); // 01 h 30
  assert.equal(dateCivile(new Date("2026-03-13T02:00:00Z"), "America/Cayenne"), "2026-03-12"); // 23 h 00
});

test("un fuseau vide ou illisible retombe sur le défaut de la base, sans faire échouer", () => {
  assert.equal(fuseauUtilisable(null), FUSEAU_PAR_DEFAUT);
  assert.equal(fuseauUtilisable("   "), FUSEAU_PAR_DEFAUT);
  assert.equal(fuseauUtilisable("Mars/Olympus"), FUSEAU_PAR_DEFAUT);
  assert.equal(fuseauUtilisable(" Indian/Reunion "), "Indian/Reunion");
  assert.equal(dateCivile(new Date("2026-03-12T23:30:00Z"), "Mars/Olympus"), "2026-03-13");
});

test("le format est toujours « AAAA-MM-JJ », zéros compris", () => {
  assert.equal(dateCivile(new Date("2026-01-05T10:00:00Z"), "Europe/Paris"), "2026-01-05");
});
