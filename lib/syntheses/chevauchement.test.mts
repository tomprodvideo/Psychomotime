import assert from "node:assert/strict";
import test from "node:test";
import { chevauchements } from "@/lib/syntheses/types";

/* Toutes les dates de ce fichier sont fictives. */

const s = (
  id: string,
  status: "brouillon" | "emis" | "annule",
  period_start: string,
  period_end: string,
) => ({ id, status, period_start, period_end });

test("deux périodes qui se recouvrent sont signalées", () => {
  const existantes = [s("a", "emis", "2026-01-01", "2026-06-30")];
  assert.deepEqual(
    chevauchements(existantes, "2026-06-01", "2026-12-31").map((x) => x.id),
    ["a"],
  );
  // Un seul jour commun suffit : c'est une séance recomptée.
  assert.equal(chevauchements(existantes, "2026-06-30", "2026-12-31").length, 1);
});

test("deux périodes qui se touchent sans se recouvrir ne le sont pas", () => {
  const existantes = [s("a", "emis", "2026-01-01", "2026-06-30")];
  assert.equal(chevauchements(existantes, "2026-07-01", "2026-12-31").length, 0);
  assert.equal(chevauchements(existantes, "2025-01-01", "2025-12-31").length, 0);
});

test("un brouillon ne chevauche rien : il n'est parti nulle part", () => {
  const existantes = [s("a", "brouillon", "2026-01-01", "2026-06-30")];
  assert.equal(chevauchements(existantes, "2026-01-01", "2026-06-30").length, 0);
});

test("une synthèse annulée chevauche encore : son destinataire en a une copie", () => {
  // C'est le point : l'annulation prévient, elle ne reprend pas le papier.
  const existantes = [s("a", "annule", "2026-01-01", "2026-06-30")];
  assert.equal(chevauchements(existantes, "2026-01-01", "2026-06-30").length, 1);
});

test("une synthèse ne se chevauche pas elle-même quand on la modifie", () => {
  const existantes = [s("a", "emis", "2026-01-01", "2026-06-30")];
  assert.equal(chevauchements(existantes, "2026-01-01", "2026-06-30", "a").length, 0);
  // Le contre-contrôle : sans l'exclusion, elle se signalerait.
  assert.equal(chevauchements(existantes, "2026-01-01", "2026-06-30").length, 1);
});

test("une période vide ne signale rien plutôt que de tout signaler", () => {
  const existantes = [s("a", "emis", "2026-01-01", "2026-06-30")];
  assert.equal(chevauchements(existantes, "", "2026-06-30").length, 0);
  assert.equal(chevauchements(existantes, "2026-01-01", "").length, 0);
});
