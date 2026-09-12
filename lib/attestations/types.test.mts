import { test } from "node:test";
import assert from "node:assert/strict";
import { formulePresence, libelleActe } from "@/lib/attestations/types";

/**
 * Le modèle enregistre la NATURE d'un rendez-vous, pas qui y était présent.
 * `entretien` couvre l'entretien parental, `restitution` la remise d'un compte
 * rendu : l'enfant n'y est pas toujours. Le document ne doit pas affirmer sa
 * présence dans ces cas-là.
 */

test("des séances et des bilans : la présence du patient est affirmée", () => {
  const f = formulePresence(["seance", "seance", "bilan"]);
  assert.match(f.phrase, /a été reçu\(e\) en séance/);
  assert.equal(f.forcerNature, false);
});

test("un entretien parental dans l'ensemble : la formule cesse d'affirmer une présence", () => {
  // Écrire « a été reçu(e) en séance » pour une date où seuls les parents sont
  // venus transformerait leur présence en présence attestée de l'enfant.
  const f = formulePresence(["seance", "entretien"]);
  assert.doesNotMatch(f.phrase, /a été reçu\(e\)/);
  assert.match(f.phrase, /a bénéficié des temps/);
});

test("et la nature est alors imprimée, même sans demande de détail", () => {
  // Taire la nature reviendrait ici à affirmer faux : le défaut « le moins
  // disant » cède devant la vérité.
  const f = formulePresence(["seance", "restitution"]);
  assert.equal(f.forcerNature, true);
});

test("un ensemble vide n'affirme aucune présence particulière", () => {
  const f = formulePresence([]);
  assert.equal(f.forcerNature, false);
});

test("sans détail demandé, tout acte s'imprime comme une séance", () => {
  assert.equal(libelleActe("bilan", false), "Séance de psychomotricité");
  assert.equal(libelleActe("entretien", false), "Séance de psychomotricité");
});

test("avec le détail, chaque acte porte son nom", () => {
  assert.equal(libelleActe("bilan", true), "Bilan psychomoteur");
  assert.equal(libelleActe("restitution", true), "Restitution de bilan");
  // Une nature inconnue retombe sur le libellé neutre plutôt que d'imprimer
  // une valeur technique sur un document remis.
  assert.equal(libelleActe("inconnue", true), "Séance de psychomotricité");
});
