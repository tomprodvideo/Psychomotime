import assert from "node:assert/strict";
import test from "node:test";
import { etatDesAccords } from "@/lib/courriers/types";

/* Toutes les dates de ce fichier sont fictives. */

const l = (granted_on: string | null, withdrawn_on: string | null = null) => ({
  granted_on,
  withdrawn_on,
});

test("un accord sans date d'accord n'est pas un accord", () => {
  /* LE DÉFAUT CORRIGÉ. `granted_on` est nullable, et n'était pas lu : une
   * ligne préparée — un formulaire imprimé, un accord attendu — faisait
   * afficher « un accord est enregistré », juste au-dessus du bouton qui remet
   * le document à un tiers. */
  assert.equal(etatDesAccords([l(null)]), "absent");
  assert.equal(etatDesAccords([l("2026-01-10")]), "accorde");
});

test("aucune ligne : rien n'est enregistré", () => {
  assert.equal(etatDesAccords([]), "absent");
});

test("un retrait l'emporte sur un accord, quel que soit l'ordre", () => {
  // C'est la dernière volonté exprimée qui compte, pas la première.
  assert.equal(etatDesAccords([l("2026-01-10"), l("2026-02-01", "2026-06-30")]), "retire");
  assert.equal(etatDesAccords([l("2026-02-01", "2026-06-30"), l("2026-01-10")]), "retire");
});

test("un retrait sur une ligne jamais accordée compte quand même", () => {
  // Le geste de retrait a été posé : le dire est plus prudent que le taire.
  assert.equal(etatDesAccords([l(null, "2026-06-30")]), "retire");
});
