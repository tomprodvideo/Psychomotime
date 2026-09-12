import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mentionProvenance,
  repriseEnMain,
  sectionsGenereesNonRetouchees,
  type Provenance,
} from "@/lib/bilans/provenance";

/**
 * CE QUE CES CONTRÔLES GARDENT. La règle absolue n° 5 du dépôt : « toute
 * synthèse clinique générée doit indiquer sa provenance ». Le texte reformulé
 * remplaçait le champ sans aucune marque ; après enregistrement, plus rien ne
 * disait qu'un modèle l'avait écrit, et le texte sortait sous la signature de
 * la praticienne.
 */

const P: Provenance = {
  le: "2026-03-31T10:15:00.000Z",
  modele: "modele-fictif-1",
  avant: "L'enfant se tient debout sans appui.",
  apres: "Se maintient debout sans appui.",
};

test("la mention nomme l'assistant et la date", () => {
  const m = mentionProvenance(P, P.apres);
  assert.match(m, /assistant/);
  assert.match(m, /31\/03\/2026/);
});

test("elle distingue un texte repris en main d'un texte intact", () => {
  assert.match(mentionProvenance(P, P.apres), /non modifié depuis/);
  assert.match(
    mentionProvenance(P, "Se maintient debout sans appui, avec vigilance."),
    /puis modifié/,
  );
});

test("elle n'affirme jamais que le texte a été relu ni validé", () => {
  /* Le produit sait qu'un modèle a écrit, pas qu'un humain a jugé. Écrire
   * « relu » ou « validé » serait exactement l'affirmation que la règle 4
   * interdit : présenter un résultat généré comme une décision du
   * psychomotricien. */
  for (const courant of [P.apres, "tout autre texte"]) {
    const m = mentionProvenance(P, courant).toLowerCase();
    for (const interdit of ["relu", "validé", "vérifié", "approuvé", "conforme"]) {
      assert.ok(!m.includes(interdit), `la mention ne doit pas dire « ${interdit} » : ${m}`);
    }
  }
});

test("un espace de plus ne compte pas comme une reprise en main", () => {
  // Sinon la mention basculerait sur un retour à la ligne involontaire.
  assert.equal(repriseEnMain(P, `  ${P.apres}\n`), false);
  assert.equal(repriseEnMain(P, `${P.apres} et davantage`), true);
});

test("la liste à reconnaître ne retient que le texte intact et non vide", () => {
  const provenances = {
    anamnese: { ...P, apres: "Texte A" },
    conclusion: { ...P, apres: "Texte B" },
    videe: { ...P, apres: "Texte C" },
    absente: { ...P, apres: "Texte D" },
  };
  const contenu = {
    anamnese: "Texte A", // intact → à reconnaître
    conclusion: "Texte B, revu par la praticienne", // retouché → non listé
    videe: "   ", // vidée → plus rien à relire
    // `absente` n'a pas de contenu du tout.
  };
  assert.deepEqual(
    sectionsGenereesNonRetouchees(provenances, contenu).sort(),
    ["anamnese"],
  );
});

test("sans reformulation, il n'y a rien à reconnaître", () => {
  // Sinon la question se poserait sur tous les bilans, et cesserait d'être lue.
  assert.deepEqual(sectionsGenereesNonRetouchees({}, { anamnese: "écrit à la main" }), []);
});
