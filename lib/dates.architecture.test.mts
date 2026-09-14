import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * GARDE-FOU STRUCTUREL — « aujourd'hui » ne se calcule plus en UTC.
 *
 * Le défaut : `new Date().toISOString().slice(0, 10)` rend la date UTC. Pour un
 * cabinet à Paris, entre minuit et une heure du matin l'hiver — deux heures
 * l'été —, c'est la VEILLE. La fiche patient imprimait la veille ; la liste des
 * dossiers et le nouveau bilan affichaient l'âge de la veille ; le nouveau bilan
 * proposait la date de la veille. Rien ne le voyait sur une machine réglée sur
 * Paris, ni dans `npm run verify`, qui y tourne.
 *
 * La bonne voie : `dateCivile(instant, practice.timezone)`, de
 * `lib/dateCivile.ts`. Ce test interdit qu'une nouvelle occurrence apparaisse.
 *
 * LA LISTE DE DETTE DOIT RÉTRÉCIR, JAMAIS S'ALLONGER. Chaque ligne est un
 * fichier qui calcule encore une date en UTC, avec ce qu'il en fait. Aucune
 * n'est corrigeable par simple remplacement : la base calcule elle aussi
 * « aujourd'hui » par `current_date`, et cinq fonctions d'émission refusent une
 * date postérieure — passer l'application seule à l'heure du cabinet ferait
 * ÉCHOUER une émission entre minuit et deux heures. Voir `Q-507`. Un troisième
 * contrôle, plus bas, oblige à retirer une ligne dès que son fichier est corrigé.
 */

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");

const DETTE_Q507: Record<string, string> = {
  "app/(app)/agenda/AgendaVue.tsx":
    "Navigation jour par jour, regroupement des rendez-vous par jour, jour proposé par défaut.",
  "app/(app)/comptabilite/[id]/page.tsx":
    "Date proposée pour l'émission d'une pièce et pour la réception d'un règlement.",
  "app/(app)/comptabilite/actions.ts":
    "`received_on` par défaut, écrit en base.",
  "app/(app)/comptabilite/attestations/[id]/page.tsx":
    "Date proposée pour signer une attestation — soumise au refus de `0016` — et drapeau « révolu ».",
  "app/(app)/comptabilite/charges/page.tsx":
    "Date proposée pour une charge du cabinet.",
  "app/(app)/comptabilite/transmissions/actions.ts":
    "Date d'expiration d'un lien, reprise dans le message de transmission et le journal.",
  "app/(app)/parametres/instruments/actions.ts":
    "`validated_on` par défaut, écrit en base.",
  "app/(app)/patients/[id]/ConsentementsSection.tsx":
    "Date proposée pour un consentement accordé.",
  "app/(app)/patients/[id]/NotesSection.tsx":
    "Date proposée pour une note clinique.",
  "app/(app)/patients/actions.ts":
    "`valid_to`, `written_on`, `granted_on` et `withdrawn_on` par défaut, écrits en base.",
};

/** Toutes les façons connues d'extraire la date UTC d'un instant. */
const DATE_UTC =
  /\.to(?:ISOString|JSON)\(\)\s*\.\s*(?:(?:slice|substring|substr)\(\s*0\s*,\s*10\s*\)|split\(\s*["'`]T["'`]\s*\)\s*\[\s*0\s*\])/;

const DOSSIERS = ["lib", "components", "app"];

function fichiersSource(dir: string): string[] {
  const out: string[] = [];
  const explorer = (chemin: string) => {
    for (const entree of readdirSync(chemin)) {
      if (entree === "node_modules" || entree.startsWith(".")) continue;
      const complet = join(chemin, entree);
      if (statSync(complet).isDirectory()) explorer(complet);
      else if ((entree.endsWith(".ts") || entree.endsWith(".tsx")) && !entree.endsWith(".test.mts")) {
        out.push(complet);
      }
    }
  };
  explorer(join(ROOT, dir));
  return out;
}

/** La règle porte sur le CODE : un commentaire qui raconte le défaut doit pouvoir le citer. */
function codeSeul(contenu: string): string {
  return contenu.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
}

const SOURCES = DOSSIERS.flatMap(fichiersSource).map((f) => relative(ROOT, f).replace(/\\/g, "/"));

test("le corpus analysé n'est pas vide, et le détecteur reconnaît chaque variante", () => {
  /* Un test de recherche qui ne regarde rien, ou qui ne reconnaît rien, passe
   * toujours. Il faut d'abord prouver les deux. */
  assert.ok(SOURCES.length > 30, `Seulement ${SOURCES.length} fichiers analysés.`);
  assert.ok(SOURCES.includes("lib/dateCivile.ts"));
  for (const variante of [
    "new Date().toISOString().slice(0, 10)",
    "d.toISOString().slice(0,10)",
    "d.toISOString().substring(0, 10)",
    'd.toISOString().split("T")[0]',
    "d.toISOString().split('T')[0]",
    "d.toJSON().slice(0, 10)",
    "d\n      .toISOString()\n      .slice(0, 10)",
  ]) {
    assert.match(variante, DATE_UTC, `variante non reconnue : ${variante}`);
  }
  assert.doesNotMatch("dateCivile(new Date(), practice.timezone)", DATE_UTC);
  assert.doesNotMatch("expires_at.toISOString()", DATE_UTC, "un instant complet n'est pas une date UTC tronquée");
});

test("aucune date UTC tronquée hors de la dette nommée", () => {
  const coupables: string[] = [];
  for (const fichier of SOURCES) {
    if (fichier in DETTE_Q507) continue;
    if (DATE_UTC.test(codeSeul(readFileSync(join(ROOT, fichier), "utf8")))) coupables.push(fichier);
  }
  assert.deepEqual(
    coupables,
    [],
    `Date calculée en UTC — employer dateCivile(instant, practice.timezone) :\n  ${coupables.join("\n  ")}`,
  );
});

test("la dette rétrécit : un fichier corrigé doit quitter la liste", () => {
  /* Sans ce contrôle, une ligne resterait après correction, et le fichier
   * pourrait ensuite réintroduire le défaut sans rien faire échouer. */
  const perimees = Object.keys(DETTE_Q507).filter(
    (fichier) =>
      !SOURCES.includes(fichier) ||
      !DATE_UTC.test(codeSeul(readFileSync(join(ROOT, fichier), "utf8"))),
  );
  assert.deepEqual(perimees, [], `Retirer de DETTE_Q507 :\n  ${perimees.join("\n  ")}`);
});
