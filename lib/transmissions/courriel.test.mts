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

/* LA DONNÉE D'ESSAI PORTE LE MOT QU'ON S'INTERDIT D'ÉCRIRE.
 *
 * Elle s'appelait « Cabinet des Trois Ballons ». Les contrôles ci-dessous
 * exigeaient qu'aucune nature d'acte n'apparaisse — et c'était vrai de cette
 * fixture, pas du code : `messageLien` insère le nom du cabinet tel quel, et un
 * cabinet s'appelle très souvent « Cabinet de psychomotricité … ». Le contrôle
 * vérifiait sa propre mise en scène.
 *
 * Le nom porte donc désormais le mot, pour que les contrôles portent sur ce que
 * le produit écrit LUI-MÊME, et pour que la réserve soit visible d'ici. */
const CAS = {
  cabinet: "Cabinet de psychomotricité du Pré Fictif",
  lien: "https://exemple-fictif.test/document/JETONFICTIF0123456789",
  expireLe: "2026-03-31",
  indice: "aB3z",
};

/** Le message amputé du nom du cabinet : ce que le produit écrit de son cru. */
function motsDuProduit(m: { sujet: string; texte: string }): string {
  return `${m.sujet}\n${m.texte}`.split(CAS.cabinet).join("").toLowerCase();
}

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
  const tout = motsDuProduit(m);
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

test("le nom du cabinet, lui, passe — et c'est la réserve assumée", () => {
  /* Ce contrôle ne protège rien : il CONSIGNE. Si la praticienne tranche pour
   * un nom d'expéditeur distinct (T-01), c'est lui qui devra changer, et son
   * échec dira alors que la décision a été appliquée. Sans lui, la réserve
   * vivrait seulement dans un commentaire. */
  const m = messageLien(CAS);
  assert.ok(m.texte.includes(CAS.cabinet));
  assert.ok(m.texte.toLowerCase().includes("psychomotric"));
  // Le SUJET, lui, ne le porte pas : c'est lui qui s'affiche en notification.
  assert.ok(!m.sujet.toLowerCase().includes("psychomotric"));
});

test("l'indice permet une vérification hors du courriel", () => {
  /* Quatre caractères que la praticienne peut annoncer de vive voix. Aucune
   * contrefaçon ne peut les deviner — c'est le seul élément vérifiable dont
   * dispose un destinataire qui n'attendait rien. */
  const m = messageLien(CAS);
  assert.ok(m.texte.includes("aB3z"));
  // Il ne suffit pas qu'ils soient là : le message doit dire ce qu'on en fait.
  assert.match(m.texte, /se termine par « aB3z »/);
  assert.match(m.texte, /peut vous le confirmer/);

  // Et sans indice, le message reste correct : pas de phrase orpheline.
  for (const rien of [null, undefined, "", "   "]) {
    const sans = messageLien({ ...CAS, indice: rien });
    assert.ok(!sans.texte.includes("se termine par"), String(rien));
    assert.ok(sans.texte.includes(CAS.lien));
  }
});

test("le jeton entier ne peut pas se glisser dans le message par l'indice", () => {
  /* Le site d'appel a le jeton complet sous la main. Une frappe — passer le
   * jeton au lieu de son indice — écrirait la clé une seconde fois, hors de
   * l'URL, là où aucun en-tête ne la protège. */
  const jeton = "JETONFICTIF0123456789abcdefghijklmnopqrs";
  const m = messageLien({ ...CAS, indice: jeton });
  assert.ok(!m.texte.includes(jeton), "le jeton complet ne doit pas être écrit");
  assert.ok(m.texte.includes("JETONFIC"), "l'indice tronqué reste affiché");
  // Huit caractères au plus, jamais davantage.
  const affiche = /se termine par « ([^»]*) »/.exec(m.texte)?.[1] ?? "";
  assert.ok(affiche.length <= 8, `indice affiché : ${affiche.length} caractères`);
});

test("le message n'invite pas à répondre à l'adresse d'envoi", () => {
  /* Il se contredisait : « signalez-le à l'expéditeur », puis « il ne sert à
   * rien d'y répondre ». Et répondre est le mauvais réflexe — si le message
   * est une contrefaçon, cette adresse est celle du contrefacteur. */
  const m = messageLien(CAS);
  assert.ok(!m.texte.includes("signalez-le à l'expéditeur"));
  assert.match(m.texte, /coordonnées que vous connaissez déjà/);
});

test("le message reste le même à chaque composition", () => {
  // Aucune horloge, aucun aléa : deux appels identiques rendent le même texte.
  assert.deepEqual(messageLien(CAS), messageLien(CAS));
});

test("il invite à ne pas suivre un lien qu'on n'attendait pas", () => {
  const m = messageLien(CAS);
  assert.match(m.texte, /ne suivez pas le lien/);
});
