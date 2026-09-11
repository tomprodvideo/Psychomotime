import assert from "node:assert/strict";
import test from "node:test";
import {
  classer,
  comparateur,
  lireValeur,
  verifierTrancheAge,
  type Band,
  type BandSet,
  type Scale,
} from "@/lib/scales";

/* ==========================================================================
 *  Jeu d'essai
 *
 *  Un découpage volontairement proche de celui qui posait problème, pour que
 *  les tests portent sur les valeurs qui divergeaient réellement : 4, 7 et 17.
 *  Les bornes et les mots sont ceux d'un praticien fictif — le produit n'en
 *  livre aucun.
 * ========================================================================== */

function bande(
  position: number,
  lower: number | null,
  upper: number | null,
  key: string,
  colour: string | null,
  opts: { lowerInclusive?: boolean; upperInclusive?: boolean } = {},
): Band {
  return {
    id: `b${position}`,
    position,
    lower_bound: lower,
    lower_inclusive: opts.lowerInclusive ?? true,
    upper_bound: upper,
    upper_inclusive: opts.upperInclusive ?? false,
    label_key: key,
    colour,
  };
}

const ECHELLE: Scale = {
  id: "s1",
  name: "Note standard d'essai",
  result_type: "note_standard",
  mean: 10,
  sd: 3,
  min_value: 1,
  max_value: 19,
  decimals: 0,
  direction: "croissant_favorable",
};

/** Découpage continu, sans trou ni chevauchement : 1–5, 5–8, 8–14, 14–19. */
const JEU: BandSet = {
  id: "js1",
  version: "v1",
  source: "Convention du cabinet, arrêtée le 11/09/2026.",
  active: true,
  vocabulary_usage: "document_remis",
  vocabulary_validated: true,
  labels: {
    b1: "Très en deçà",
    b2: "En deçà",
    b3: "Dans la moyenne",
    b4: "Au-dessus",
  },
  bands: [
    bande(1, 1, 5, "b1", "#c0504d"),
    bande(2, 5, 8, "b2", "#d99b2b"),
    bande(3, 8, 14, "b3", "#4e7d2f"),
    bande(4, 14, 19, "b4", "#7ba653", { upperInclusive: true }),
  ],
};

/* ==========================================================================
 *  T-00 — Le défaut historique ne peut plus se reproduire
 * ========================================================================== */

test("une valeur appartient à UNE bande et une seule", () => {
  // C'est le défaut d'origine : la note 7 était « moyenne » dans la légende et
  // « fragilité » dans le tableau, parce que deux bandes la contenaient.
  for (let v = 1; v <= 19; v++) {
    const correspondantes = JEU.bands.filter((b) => {
      const apresBas =
        b.lower_bound === null || (b.lower_inclusive ? v >= b.lower_bound : v > b.lower_bound);
      const avantHaut =
        b.upper_bound === null || (b.upper_inclusive ? v <= b.upper_bound : v < b.upper_bound);
      return apresBas && avantHaut;
    });
    assert.equal(
      correspondantes.length,
      1,
      `La valeur ${v} devrait tomber dans exactement une bande, pas ${correspondantes.length}.`,
    );
  }
});

test("les quatre surfaces rendent la MÊME couleur et le MÊME libellé", () => {
  // L'invariant central de la refonte : c'est ce test qui échouait avant, aux
  // valeurs 4, 7 et 17.
  for (const v of [1, 4, 5, 7, 8, 13, 14, 17, 19]) {
    const surfaces = (["editeur", "tableau", "graphique", "document"] as const).map(
      (s) => classer(ECHELLE, JEU, v, s),
    );
    const couleurs = new Set(
      surfaces.map((c) => (c.statut === "classe" ? c.couleur : "∅")),
    );
    const libelles = new Set(
      surfaces.map((c) => (c.statut === "classe" ? c.libelle : "∅")),
    );
    assert.equal(couleurs.size, 1, `Quatre couleurs différentes pour ${v}.`);
    assert.equal(libelles.size, 1, `Quatre libellés différents pour ${v}.`);
  }
});

/* ==========================================================================
 *  T-01 — Comportement exact aux bornes
 * ========================================================================== */

test("les bornes se comportent selon leur inclusivité déclarée", () => {
  const attendu: [number, string][] = [
    [1, "Très en deçà"], // borne basse incluse
    [4, "Très en deçà"],
    [5, "En deçà"], // bascule exactement à 5
    [7, "En deçà"], // la valeur qui divergeait
    [8, "Dans la moyenne"], // bascule exactement à 8
    [13, "Dans la moyenne"],
    [14, "Au-dessus"], // bascule exactement à 14
    [17, "Au-dessus"], // la valeur qui divergeait
    [19, "Au-dessus"], // borne haute incluse
  ];
  for (const [v, libelle] of attendu) {
    const c = classer(ECHELLE, JEU, v);
    assert.equal(c.statut, "classe", `${v} devrait être classable`);
    if (c.statut === "classe") {
      assert.equal(c.libelle, libelle, `Mauvaise bande pour ${v}`);
    }
  }
});

test("une valeur décimale se classe sans arrondi caché", () => {
  const a = classer(ECHELLE, JEU, 4.999);
  const b = classer(ECHELLE, JEU, 5.001);
  assert.equal(a.statut === "classe" && a.libelle, "Très en deçà");
  assert.equal(b.statut === "classe" && b.libelle, "En deçà");
});

/* ==========================================================================
 *  T-03 — Aucun trou dans la couverture
 * ========================================================================== */

test("aucune valeur de l'échelle ne reste sans bande", () => {
  for (let v = 1; v <= 19; v += 0.25) {
    const c = classer(ECHELLE, JEU, v);
    assert.equal(
      c.statut,
      "classe",
      `La valeur ${v} n'est couverte par aucune bande.`,
    );
  }
});

/* ==========================================================================
 *  T-06 — Une valeur non chiffrée reste telle quelle
 * ========================================================================== */

test("une valeur non chiffrée n'est ni convertie, ni colorée, ni perdue", () => {
  // Ces saisies disent quelque chose que la praticienne a voulu dire. Les
  // transformer en zéro, ou les faire disparaître, serait pire que de ne rien
  // afficher.
  for (const brut of ["< 1", "NC", "7 ?", "non passé", "—", "n/a"]) {
    const c = classer(ECHELLE, JEU, brut);
    assert.equal(c.statut, "non_classable");
    if (c.statut === "non_classable") {
      assert.equal(c.motif, "valeur_non_numerique");
      // La saisie est conservée : l'affichage la rendra telle quelle.
      assert.equal(c.saisie, brut);
    }
  }
});

test("un champ vide n'est pas zéro", () => {
  for (const brut of ["", "   ", null, undefined]) {
    const c = classer(ECHELLE, JEU, brut);
    assert.equal(c.statut, "non_classable");
    if (c.statut === "non_classable") {
      assert.equal(c.motif, "resultat_non_saisi");
    }
  }
});

test("lireValeur accepte la virgule décimale française", () => {
  assert.equal(lireValeur("7,5"), 7.5);
  assert.equal(lireValeur("7.5"), 7.5);
  assert.equal(lireValeur("-1,5"), -1.5);
  assert.equal(lireValeur("  12  "), 12);
  assert.equal(lireValeur("12 ans"), null);
  assert.equal(lireValeur(Number.NaN), null);
  assert.equal(lireValeur(Number.POSITIVE_INFINITY), null);
});

/* ==========================================================================
 *  T-07 — Une échelle sans direction ne colore rien
 * ========================================================================== */

test("une échelle sans direction déclarée n'interprète rien", () => {
  // Sans direction, rien ne dit de quel côté se trouve « mieux ». Le chiffre
  // s'affiche nu plutôt que d'être coloré au hasard.
  const brute: Scale = { ...ECHELLE, direction: "non_oriente" };
  const c = classer(brute, JEU, 7);
  assert.equal(c.statut, "non_classable");
  if (c.statut === "non_classable") assert.equal(c.motif, "echelle_non_orientee");
});

test("sans échelle, aucune interprétation", () => {
  const c = classer(null, JEU, 7);
  assert.equal(c.statut, "non_classable");
});

/* ==========================================================================
 *  Bornes de l'échelle et absence de découpage
 * ========================================================================== */

test("une valeur hors des bornes de l'échelle est signalée, pas classée", () => {
  for (const v of [0, 20, -3, 100]) {
    const c = classer(ECHELLE, JEU, v);
    assert.equal(c.statut, "non_classable");
    if (c.statut === "non_classable") assert.equal(c.motif, "hors_bornes_echelle");
  }
});

test("sans découpage actif, la valeur reste nue", () => {
  const inactif: BandSet = { ...JEU, active: false };
  const c = classer(ECHELLE, inactif, 7);
  assert.equal(c.statut, "non_classable");
  if (c.statut === "non_classable") assert.equal(c.motif, "aucun_jeu_de_bandes_actif");

  const vide: BandSet = { ...JEU, bands: [] };
  assert.equal(classer(ECHELLE, vide, 7).statut, "non_classable");
  assert.equal(classer(ECHELLE, null, 7).statut, "non_classable");
});

/* ==========================================================================
 *  T-08 — Un vocabulaire non validé ne sort pas du cabinet
 * ========================================================================== */

test("un vocabulaire non validé s'affiche dans l'outil, pas sur le document", () => {
  const brouillon: BandSet = {
    ...JEU,
    vocabulary_usage: "interne",
    vocabulary_validated: false,
  };

  const editeur = classer(ECHELLE, brouillon, 7, "editeur");
  const document = classer(ECHELLE, brouillon, 7, "document");

  assert.equal(editeur.statut, "classe");
  assert.equal(document.statut, "classe");
  if (editeur.statut === "classe" && document.statut === "classe") {
    assert.equal(editeur.libelle, "En deçà", "L'outil de travail affiche le mot.");
    assert.equal(
      document.libelle,
      null,
      "Un mot non validé ne doit pas sortir sur un document remis.",
    );
    // La couleur, elle, reste : elle ne nomme rien.
    assert.equal(document.couleur, editeur.couleur);
  }
});

/* ==========================================================================
 *  Traçabilité du classement
 * ========================================================================== */

test("un classement dit d'où vient son découpage", () => {
  // Un compte rendu doit pouvoir citer la source du découpage employé : sans
  // elle, un chiffre coloré est une affirmation sans fondement.
  const c = classer(ECHELLE, JEU, 7);
  assert.equal(c.statut, "classe");
  if (c.statut === "classe") {
    assert.equal(c.bandSetId, "js1");
    assert.equal(c.bandSetVersion, "v1");
    assert.match(c.source, /Convention du cabinet/);
    assert.equal(c.comparateur, "5 ≤ v < 8");
  }
});

test("le comparateur se lit comme on l'écrirait à la main", () => {
  assert.equal(comparateur(bande(1, 5, 8, "x", null)), "5 ≤ v < 8");
  assert.equal(
    comparateur(bande(1, 5, 8, "x", null, { lowerInclusive: false, upperInclusive: true })),
    "5 < v ≤ 8",
  );
  assert.equal(comparateur(bande(1, null, 5, "x", null)), "v < 5");
  assert.equal(comparateur(bande(1, 14, null, "x", null)), "14 ≤ v");
  assert.equal(comparateur(bande(1, null, null, "x", null)), "toute valeur");
});

/* ==========================================================================
 *  Cohérence âge / plage annoncée
 * ========================================================================== */

test("un âge hors de la plage annoncée est signalé, jamais bloqué", () => {
  const instrument = { age_min_months: 36, age_max_months: 83, name: "Outil d'essai" };

  assert.equal(verifierTrancheAge(52, instrument), null, "Dans la plage : rien à dire.");
  assert.equal(verifierTrancheAge(36, instrument), null, "Borne basse incluse.");
  assert.equal(verifierTrancheAge(83, instrument), null, "Borne haute incluse.");

  const trop_jeune = verifierTrancheAge(30, instrument);
  assert.ok(trop_jeune, "Un âge inférieur doit être signalé.");
  assert.match(trop_jeune!, /inférieur à la plage annoncée/);
  assert.match(trop_jeune!, /2 ans 6 mois/, "L'âge doit être dit en clair.");
  assert.match(trop_jeune!, /doit figurer au compte rendu/);

  const trop_age = verifierTrancheAge(115, instrument);
  assert.ok(trop_age, "Un âge supérieur doit être signalé.");
  assert.match(trop_age!, /dépasse la plage annoncée/);
});

test("sans plage annoncée ni âge connu, aucun avertissement inventé", () => {
  assert.equal(
    verifierTrancheAge(52, { age_min_months: null, age_max_months: null, name: "X" }),
    null,
  );
  assert.equal(
    verifierTrancheAge(null, { age_min_months: 36, age_max_months: 83, name: "X" }),
    null,
  );
});
