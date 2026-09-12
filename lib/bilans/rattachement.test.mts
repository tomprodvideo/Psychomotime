import { test } from "node:test";
import assert from "node:assert/strict";
import { estUneRetouche } from "@/lib/bilans/rattachement";

/**
 * LE RISQUE QUE CETTE RÈGLE GARDE. Le champ du nom effaçait l'identifiant du
 * dossier à chaque frappe : choisir un patient dans la liste puis corriger une
 * coquille rompait le lien, et le bilan devenait orphelin sans que rien ne le
 * dise. C'est l'attribution au mauvais dossier — le premier risque listé par
 * la sécurité clinique — atteignable en deux frappes.
 */

test("corriger une coquille ne détache pas le dossier", () => {
  assert.equal(estUneRetouche("Zéphyr Pirouette", "Zephyr Pirouette"), true);
  assert.equal(estUneRetouche("Zephyr Pirouette", "Zéphyr Pirouette"), true);
  assert.equal(estUneRetouche("zéphyr pirouette", "Zéphyr Pirouette"), true);
  assert.equal(estUneRetouche("Zéphyr  Pirouette ", "Zéphyr Pirouette"), true);
  assert.equal(estUneRetouche("Jean-Luc Cabriole", "Jean Luc Cabriole"), true);
});

test("compléter un nom ne détache pas non plus", () => {
  // On tape le nom du dossier, puis on ajoute un second prénom.
  assert.equal(estUneRetouche("Zéphyr Pirouette Marin", "Zéphyr Pirouette"), true);
  // Ou l'inverse : on efface la fin pendant qu'on corrige.
  assert.equal(estUneRetouche("Zéphyr Pir", "Zéphyr Pirouette"), true);
});

test("un nom vraiment différent rompt le lien", () => {
  /* C'est l'autre moitié de la règle, et elle compte autant : un bilan peut
   * légitimement concerner quelqu'un qui n'a pas encore de dossier. Forcer le
   * rattachement serait aussi faux que de le rompre en silence. */
  assert.equal(estUneRetouche("Marceline Cabriole", "Zéphyr Pirouette"), false);
  assert.equal(estUneRetouche("Pirouette Zéphyr", "Zéphyr Pirouette"), false);
});

test("une saisie vide ne rattache rien", () => {
  // Effacer entièrement le champ, c'est repartir de zéro — pas confirmer.
  assert.equal(estUneRetouche("", "Zéphyr Pirouette"), false);
  assert.equal(estUneRetouche("   ", "Zéphyr Pirouette"), false);
  assert.equal(estUneRetouche("Zéphyr Pirouette", ""), false);
  // Une saisie qui ne garde que de la ponctuation n'est pas un nom.
  assert.equal(estUneRetouche("---", "Zéphyr Pirouette"), false);
});
