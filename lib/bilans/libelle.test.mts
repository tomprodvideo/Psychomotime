import assert from "node:assert/strict";
import test from "node:test";
import { bilanLabel, bilanHeading } from "@/lib/constants";

test("l'enveloppe nomme le bilan dont il s'agit", () => {
  /* LE DÉFAUT CORRIGÉ : l'objet et le corps du courriel annonçaient « Bilan
   * psychomoteur » quel que soit le type. Un bilan sensoriel partait sous un
   * intitulé faux — la seule ligne du produit qui écrivait une fausseté dans
   * un courriel sortant. */
  assert.equal(bilanLabel("psychomoteur"), "Bilan psychomoteur");
  assert.equal(bilanLabel("sensoriel"), "Bilan sensoriel");
  assert.notEqual(bilanLabel("sensoriel"), bilanLabel("psychomoteur"));
});

test("le titre du document et le nom dans une phrase sont deux choses", () => {
  // `bilanHeading` est en capitales, pour le haut d'une page. Il ne se glisse
  // pas dans « veuillez trouver le compte rendu du … ».
  assert.equal(bilanHeading("sensoriel"), bilanHeading("sensoriel").toUpperCase());
  assert.notEqual(bilanLabel("sensoriel"), bilanHeading("sensoriel"));
});

test("un type inconnu retombe sur le bilan psychomoteur, pas sur du vide", () => {
  // `content.__type__` n'est contraint par rien en base : toute valeur
  // inattendue doit produire un libellé lisible, jamais « undefined ».
  assert.equal(
    bilanLabel("inattendu" as Parameters<typeof bilanLabel>[0]),
    "Bilan psychomoteur",
  );
});
