import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * GARDE-FOU STRUCTUREL — la règle de cotation n'existe qu'à un seul endroit.
 *
 * Le défaut d'origine n'était pas une erreur de calcul : c'était TROIS endroits
 * qui décidaient de la même chose. La couleur du tableau, le texte de la légende
 * et la courbe imprimée divergeaient aux valeurs 4, 7 et 17, et une même teinte
 * y signifiait « très supérieur » d'un côté et « moyenne » de l'autre.
 *
 * Corriger les trois n'aurait servi à rien : ils auraient re-divergé au premier
 * changement. Ce test empêche qu'un quatrième apparaisse.
 *
 * LA LISTE D'EXEMPTIONS DOIT RÉTRÉCIR, JAMAIS S'ALLONGER. Elle ne contient que
 * du code de la v1, encore en service, qui disparaîtra avec le moteur de bilans.
 */

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");

/** Le seul module autorisé à connaître une règle de cotation. */
const MODULE_AUTORISE = "lib/scales.ts";

/**
 * Code de la v1 encore en service, à retirer avec le moteur de bilans.
 * Chaque ligne est une dette nommée, avec ce qu'elle contient.
 */
const DETTE_V1: Record<string, string> = {
  "lib/constants.ts":
    "nsColor() et SCORE_INTERPRETATION : seuils et vocabulaire en dur — les deux autorités concurrentes d'origine.",
  "components/GaussianCurve.tsx":
    "Bandes DS, couleurs et libellés en dur — la troisième autorité.",
  "app/(app)/bilans/[id]/apercu/page.tsx":
    "ZONE_TEXT : couleurs de zone recopiées depuis la courbe.",
};

const DOSSIERS = ["lib", "components", "app"];
const EXTENSIONS = [".ts", ".tsx"];

function fichiersSource(dir: string): string[] {
  const out: string[] = [];
  const explorer = (chemin: string) => {
    for (const entree of readdirSync(chemin)) {
      if (entree === "node_modules" || entree.startsWith(".")) continue;
      const complet = join(chemin, entree);
      if (statSync(complet).isDirectory()) {
        explorer(complet);
      } else if (
        EXTENSIONS.some((e) => entree.endsWith(e)) &&
        !entree.endsWith(".test.mts")
      ) {
        out.push(complet);
      }
    }
  };
  explorer(join(ROOT, dir));
  return out;
}

const SOURCES = DOSSIERS.flatMap(fichiersSource).map((f) =>
  relative(ROOT, f).replace(/\\/g, "/"),
);

/**
 * Retire les commentaires avant l'analyse.
 *
 * La règle porte sur le CODE, pas sur la prose qui l'explique. Un commentaire
 * qui raconte le défaut d'origine — et il en faut — cite forcément les mots et
 * les teintes en cause. Les compter comme des infractions rendrait le garde-fou
 * impossible à documenter.
 */
function codeSeul(contenu: string): string {
  return contenu
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");
}

test("le corpus analysé n'est pas vide", () => {
  // Un test de recherche qui ne trouve aucun fichier passe toujours : il faut
  // d'abord prouver qu'il regarde quelque chose.
  assert.ok(SOURCES.length > 30, `Seulement ${SOURCES.length} fichiers analysés.`);
  assert.ok(SOURCES.includes(MODULE_AUTORISE));
});

test("aucun vocabulaire de bande hors du module de classement", () => {
  // Les mots qui nomment une bande n'ont rien à faire dans un composant : ils
  // sont choisis par la praticienne et vivent en base.
  const motifs = [
    /zone de fragilit/i,
    /zone dite/i,
    /pathologique/i,
    /très\s+faible/i,
    /très\s+supérieur/i,
  ];

  const coupables: string[] = [];
  for (const fichier of SOURCES) {
    if (fichier === MODULE_AUTORISE || fichier in DETTE_V1) continue;
    const contenu = codeSeul(readFileSync(join(ROOT, fichier), "utf8"));
    if (motifs.some((m) => m.test(contenu))) coupables.push(fichier);
  }

  assert.deepEqual(
    coupables,
    [],
    `Vocabulaire de bande trouvé hors du module de classement :\n  ${coupables.join("\n  ")}`,
  );
});

test("aucune couleur de bande hors du module de classement", () => {
  // Les teintes exactes qui portaient la cotation. Leur réapparition ailleurs
  // signifierait qu'une quatrième autorité est en train de naître.
  const couleursDeCotation = [
    "#c0504d", // rouge de zone
    "#d99b2b", // orange de zone
    "#4e7d2f", // vert de zone
    "#7ba653",
    "#5a8a37",
    "#e8943a",
    "#a9d18e",
  ];

  // Une palette de couleurs de thème n'est pas une autorité de cotation : elle
  // propose une teinte d'accent pour l'en-tête d'un document, sans jamais la
  // rattacher à une valeur. La coïncidence de code hexadécimal est fortuite.
  // Le test de vocabulaire, lui, continue de s'appliquer à ce fichier.
  const PALETTE_DE_THEME = "app/(app)/parametres/ParametresForm.tsx";

  const coupables: string[] = [];
  for (const fichier of SOURCES) {
    if (fichier === MODULE_AUTORISE || fichier in DETTE_V1) continue;
    if (fichier === PALETTE_DE_THEME) continue;
    const contenu = codeSeul(readFileSync(join(ROOT, fichier), "utf8")).toLowerCase();
    if (couleursDeCotation.some((c) => contenu.includes(c))) coupables.push(fichier);
  }

  assert.deepEqual(
    coupables,
    [],
    `Couleur de cotation trouvée hors du module de classement :\n  ${coupables.join("\n  ")}`,
  );
});

test("le module de classement ne contient lui-même aucune borne ni aucun mot de bande", () => {
  // Il applique un découpage, il n'en porte pas. Sans quoi on aurait déplacé le
  // problème au lieu de le résoudre.
  const contenu = codeSeul(readFileSync(join(ROOT, MODULE_AUTORISE), "utf8"));

  // Aucune couleur hexadécimale : les couleurs viennent de la base.
  assert.equal(
    /#[0-9a-fA-F]{6}/.test(contenu),
    false,
    "Une couleur en dur est apparue dans le module de classement.",
  );

  for (const mot of [
    "fragilit",
    "pathologique",
    "très faible",
    "moyenne haute",
    "très supérieur",
  ]) {
    assert.equal(
      contenu.toLowerCase().includes(mot),
      false,
      `Le mot de bande « ${mot} » est apparu dans le module de classement.`,
    );
  }
});

test("la dette v1 est nommée, et son inventaire est exact", () => {
  // Chaque fichier exempté doit exister et contenir réellement ce qu'on lui
  // reproche. Une exemption qui ne correspond plus à rien doit être retirée,
  // pas oubliée.
  for (const [fichier, motif] of Object.entries(DETTE_V1)) {
    assert.ok(
      SOURCES.includes(fichier),
      `L'exemption « ${fichier} » désigne un fichier qui n'existe plus : retirez-la de la liste.`,
    );
    const contenu = codeSeul(readFileSync(join(ROOT, fichier), "utf8"));
    const porteEncoreLaDette =
      /#[0-9a-fA-F]{6}/.test(contenu) ||
      /fragilit|pathologique|très\s+faible|très\s+supérieur/i.test(contenu);
    assert.ok(
      porteEncoreLaDette,
      `« ${fichier} » ne porte plus de règle de cotation (${motif}). Retirez-le de la liste d'exemptions.`,
    );
  }
});

test("la dette v1 ne compte pas plus de trois fichiers", () => {
  // Un plafond explicite : si un quatrième fichier devait être exempté, c'est
  // que la règle est en train de se disperser à nouveau.
  assert.ok(
    Object.keys(DETTE_V1).length <= 3,
    "La liste d'exemptions s'est allongée : la règle de cotation se disperse à nouveau.",
  );
});
