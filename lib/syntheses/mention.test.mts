import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { MENTION_COMPTE_SEANCES } from "@/lib/syntheses/types";

/**
 * LA MENTION QUI ENCADRE LES COMPTES EXISTE EN DEUX EXEMPLAIRES.
 *
 * Celui du code sert d'aperçu avant la remise, quand il n'y a pas encore
 * d'instantané à lire. Celui de la base est figé avec le document et fait foi.
 *
 * Deux copies dérivent toujours. Ce contrôle est ce qui les tient ensemble :
 * modifier l'une sans l'autre le fait échouer.
 */
const MIGRATION = readFileSync(
  new URL("../../supabase/migrations/0023_synthese_de_suivi.sql", import.meta.url),
  "utf8",
);

/* La copie SQL est découpée par des `||` et ses apostrophes y sont doublées.
 * Comparer les seules lettres et chiffres efface ces différences d'écriture
 * sans rien effacer du texte lui-même. */
const nu = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

test("la mention imprimée est la même dans le code et dans la base", () => {
  assert.ok(
    nu(MIGRATION).includes(nu(MENTION_COMPTE_SEANCES)),
    "La mention affichée avant la remise a divergé de celle que la base fige " +
      "à la remise. Les deux doivent dire exactement la même chose.",
  );
});

test("le contrôle sait détecter une divergence", () => {
  // Sans ce contre-contrôle, une normalisation trop agressive — ou un
  // `includes` sur une chaîne vide — laisserait le contrôle passer quoi qu'il
  // arrive.
  assert.ok(!nu(MIGRATION).includes(nu("une phrase qui n'y figure pas du tout")));
});
