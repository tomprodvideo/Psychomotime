#!/usr/bin/env node
/**
 * FALSIFIER — désarmer chaque garde, et exiger qu'un contrôle tombe.
 *
 * Une suite de contrôles verte ne prouve rien tant qu'on n'a pas montré ce qui
 * la fait rougir. Ce dépôt a trouvé, à répétition, des contrôles qui validaient
 * leur propre mise en scène : une assertion sur un nombre d'objectifs qui
 * rendait le même verdict avec ou sans filtre par parcours, une garde
 * d'immuabilité dont six clauses ne faisaient échouer aucun contrôle, un
 * instantané que rien ne protégeait sur trois documents.
 *
 * Cet outil rejoue cette discipline, et il CONSIGNE ce qui a été falsifié : la
 * liste des mutations est versionnée à côté des migrations, donc relisible et
 * rejouable. Un plan de falsification est une preuve, pas un brouillon.
 *
 * TROIS PIÈGES QU'IL FERME, ET QUE MON ÉCRITURE À LA MAIN N'AVAIT PAS FERMÉS :
 *
 *  1. UNE MUTATION QUI NE MUTE RIEN NE PROUVE RIEN. Un motif qui ne correspond
 *     plus — une ligne reformulée, une espace de plus — laisse le fichier
 *     intact, les contrôles passent, et l'on conclurait « contrôle vain » sur
 *     une garde parfaitement contrôlée. C'est arrivé. Chaque mutation est donc
 *     vérifiée comme ayant réellement changé le fichier.
 *
 *  2. LA BASE RESTE SUR LA DERNIÈRE MUTATION. Restaurer le fichier ne restaure
 *     pas le schéma déjà appliqué. J'ai comparé une production correcte à une
 *     base locale encore mutée, et cru un instant à une erreur de
 *     transcription. La base est donc reconstruite à la fin, toujours.
 *
 *  3. UNE INTERRUPTION LAISSAIT LE DÉPÔT MUTÉ. Le fichier est restauré même en
 *     cas d'erreur.
 *
 * Usage :
 *   node scripts/falsifier.mjs supabase/falsifications/0023.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const ESC = String.fromCharCode(27) + "[";
const C = {
  reset: ESC + "0m",
  dim: ESC + "2m",
  red: ESC + "31m",
  green: ESC + "32m",
  yellow: ESC + "33m",
  bold: ESC + "1m",
};

const plan = process.argv[2];
if (!plan) {
  console.error("Usage : node scripts/falsifier.mjs <plan.json>");
  process.exit(2);
}

const { cible, mutations, commande } = JSON.parse(
  readFileSync(join(ROOT, plan), "utf8"),
);
/* QUELLE SUITE REJOUER. La plupart des plans visent une migration, donc la
 * base de contrôle courante. Mais `public.bilans` n'existe QUE dans la base de
 * bascule — elle naît du schéma v1, que seule cette voie applique. Un plan peut
 * donc nommer la commande qui l'éprouve. */
const SUITE = commande === "cutover" ? "cutover" : "test";
const chemin = join(ROOT, cible);
const origine = readFileSync(chemin, "utf8");

/** Rejoue la suite SQL. Rend `true` quand elle ÉCHOUE, ce qu'on attend ici. */
function laSuiteTombe() {
  const r = spawnSync("node", [join(ROOT, "scripts", "db.mjs"), SUITE], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return r.status !== 0;
}

/**
 * Applique une mutation au texte. Rend `null` si le motif est introuvable.
 *
 * `occurrence` retire la n-ième occurrence d'un motif répété — utile quand la
 * même ligne protège trois documents dans une seule migration, et qu'il faut
 * démontrer les trois séparément.
 */
function muter(texte, m) {
  if (m.occurrence) {
    const parts = texte.split(m.avant);
    if (parts.length <= m.occurrence) return null;
    return (
      parts.slice(0, m.occurrence).join(m.avant) +
      parts.slice(m.occurrence).join(m.avant)
    );
  }
  if (!texte.includes(m.avant)) return null;
  return texte.replace(m.avant, m.apres ?? "");
}

const vains = [];
let code = 0;
try {
  console.log(C.bold + "Falsification de " + cible + C.reset);
  for (const m of mutations) {
    const mute = muter(origine, m);
    if (mute === null || mute === origine) {
      console.log("  " + C.yellow + "⚠ SANS EFFET" + C.reset + "  " + m.nom);
      vains.push(m.nom + " — la mutation n'a rien changé, elle ne prouve rien");
      continue;
    }
    writeFileSync(chemin, mute);
    const detecte = laSuiteTombe();
    console.log(
      detecte
        ? "  " + C.green + "détecté" + C.reset + "      " + m.nom
        : "  " + C.red + "✗ VAIN" + C.reset + "       " + m.nom,
    );
    if (!detecte) vains.push(m.nom);
  }
} finally {
  // Le fichier d'abord, la base ensuite — et dans tous les cas.
  writeFileSync(chemin, origine);
  const r = spawnSync("node", [join(ROOT, "scripts", "db.mjs"), "reset"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (r.status !== 0) {
    console.error(
      C.red +
        "La base locale n'a pas pu être reconstruite : elle porte peut-être " +
        "encore une mutation." +
        C.reset,
    );
    code = 3;
  }
}

console.log();
if (vains.length > 0) {
  console.log(
    C.red + C.bold + vains.length + " contrôle(s) sans preuve :" + C.reset,
  );
  for (const v of vains) console.log("  " + C.red + "· " + v + C.reset);
  process.exit(code || 1);
}
console.log(
  C.green + C.bold + mutations.length + " garde(s) démontrée(s)" + C.reset +
    " " + C.dim + "désarmer chacune fait tomber un contrôle" + C.reset,
);
process.exit(code);
