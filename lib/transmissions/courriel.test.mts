import { test } from "node:test";
import assert from "node:assert/strict";
import { messageLien } from "@/lib/transmissions/courriel";

/**
 * CE QU'UN COURRIEL NE CONTIENT PAS est ici plus important que ce qu'il
 * contient. Il voyage en clair, se range dans des boîtes partagées et s'affiche
 * en notification sur un écran verrouillé.
 *
 * Les contrôles ci-dessous emploient des sentinelles : on compose le message
 * dans un contexte où un montant, un nom de patient ou une nature d'acte
 * POURRAIENT se glisser, et on exige qu'aucun ne s'y trouve.
 */

const CAS = {
  cabinet: "Cabinet des Trois Ballons",
  lien: "https://exemple-fictif.test/document/JETONFICTIF0123456789",
  expireLe: "2026-03-31",
};

test("le message dit où prendre le document et jusqu'à quand", () => {
  const m = messageLien(CAS);
  assert.ok(m.texte.includes(CAS.lien));
  assert.ok(m.texte.includes("31/03/2026"));
  assert.ok(m.texte.includes(CAS.cabinet));
});

test("le sujet ne nomme ni le document ni personne", () => {
  // Il s'affiche en notification, parfois devant quelqu'un d'autre.
  const m = messageLien(CAS);
  assert.equal(m.sujet, "Un document vous a été transmis");
  for (const interdit of ["facture", "attestation", "psychomotric", "séance"]) {
    assert.ok(
      !m.sujet.toLowerCase().includes(interdit),
      `le sujet ne doit pas contenir « ${interdit} »`,
    );
  }
});

test("aucun montant, aucun nom de patient, aucune nature d'acte", () => {
  const m = messageLien(CAS);
  const tout = `${m.sujet}\n${m.texte}`.toLowerCase();
  for (const interdit of [
    "€",
    "euro",
    "facture",
    "attestation",
    "séance",
    "bilan",
    "psychomotric",
    "diagnostic",
  ]) {
    assert.ok(
      !tout.includes(interdit),
      `le message ne doit pas contenir « ${interdit} »`,
    );
  }
});

test("le message reste le même à chaque composition", () => {
  // Aucune horloge, aucun aléa : deux appels identiques rendent le même texte.
  assert.deepEqual(messageLien(CAS), messageLien(CAS));
});

test("il invite à ne pas suivre un lien qu'on n'attendait pas", () => {
  const m = messageLien(CAS);
  assert.match(m.texte, /ne suivez pas le lien/);
});
