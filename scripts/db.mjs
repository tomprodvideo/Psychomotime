#!/usr/bin/env node
/**
 * Outillage de base de données locale.
 *
 * La machine de développement n'a ni Docker ni la CLI Supabase (voir
 * docs/refonte/adr/ADR-001). On applique donc les migrations sur un
 * PostgreSQL local, précédées d'un stub qui recrée le schéma `auth`, les
 * rôles PostgREST et `auth.uid()`. Les politiques RLS s'exécutent alors dans
 * le rôle réel d'un utilisateur connecté, ce qui rend les tests négatifs
 * d'isolation sincères.
 *
 * Commandes
 *   node scripts/db.mjs reset    recrée la base, applique stub + migrations + seeds
 *   node scripts/db.mjs migrate  applique les migrations sur la base courante
 *   node scripts/db.mjs seed     recharge les seeds
 *   node scripts/db.mjs test     exécute les tests SQL de supabase/tests/
 *   node scripts/db.mjs cutover  rejoue la bascule v1 -> cible sur une base
 *                                jetable, puis vérifie le résultat
 *   node scripts/db.mjs concurrence  émet des pièces EN PARALLÈLE et vérifie
 *                                    que la numérotation ne se répète pas
 *   node scripts/db.mjs psql     ouvre une session psql sur la base locale
 *
 * Variables d'environnement
 *   LOCAL_DB_NAME  (défaut: psychomotime_dev)
 *   LOCAL_DB_HOST  (défaut: localhost)
 *   LOCAL_DB_PORT  (défaut: 5432)
 *   LOCAL_DB_USER  (défaut: utilisateur courant)
 */

import { spawn, spawnSync } from "node:child_process";
import { readdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const DB_NAME = process.env.LOCAL_DB_NAME || "psychomotime_dev";
const DB_HOST = process.env.LOCAL_DB_HOST || "localhost";
const DB_PORT = process.env.LOCAL_DB_PORT || "5432";
const DB_USER = process.env.LOCAL_DB_USER || process.env.USER || "postgres";

const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");
const LOCAL_DIR = join(ROOT, "supabase", "local");
const SEED_DIR = join(ROOT, "supabase", "seed");
const TESTS_DIR = join(ROOT, "supabase", "tests");
const V1_DIR = join(ROOT, "supabase", "schema-v1");
const CUTOVER_DIR = join(ROOT, "supabase", "cutover");
const PERF_DIR = join(ROOT, "supabase", "perf");

const ESC = "\u001b[";
const C = {
  reset: `${ESC}0m`,
  dim: `${ESC}2m`,
  red: `${ESC}31m`,
  green: `${ESC}32m`,
  yellow: `${ESC}33m`,
  bold: `${ESC}1m`,
};

function baseArgs(db) {
  return ["-h", DB_HOST, "-p", DB_PORT, "-U", DB_USER, "-d", db];
}

/** Exécute psql et renvoie { code, stdout, stderr }. */
function psql(db, args, { quiet = false } = {}) {
  const res = spawnSync(
    "psql",
    [...baseArgs(db), "-v", "ON_ERROR_STOP=1", "--no-psqlrc", ...args],
    { encoding: "utf8" },
  );
  if (!quiet && res.stdout?.trim()) process.stdout.write(res.stdout);
  if (res.status !== 0 && !quiet && res.stderr?.trim()) {
    process.stderr.write(C.red + res.stderr + C.reset);
  }
  return {
    code: res.status ?? 1,
    stdout: res.stdout ?? "",
    stderr: res.stderr ?? "",
  };
}

function runFile(db, file, { quiet = true } = {}) {
  const res = psql(db, ["-f", file], { quiet });
  if (res.code !== 0) {
    console.error(`${C.red}✗ ${basename(file)}${C.reset}`);
    if (quiet && res.stderr.trim()) process.stderr.write(res.stderr);
    process.exit(1);
  }
  return res;
}

function sqlFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => join(dir, f));
}

function adminPsql(sql) {
  const res = spawnSync(
    "psql",
    [
      ...baseArgs("postgres"),
      "-v",
      "ON_ERROR_STOP=1",
      "--no-psqlrc",
      "-c",
      sql,
    ],
    { encoding: "utf8" },
  );
  if (res.status !== 0) {
    process.stderr.write(C.red + (res.stderr || "") + C.reset);
    process.exit(1);
  }
}

function dropAndCreate() {
  console.log(`${C.dim}· suppression et recréation de ${DB_NAME}${C.reset}`);
  adminPsql(`drop database if exists ${DB_NAME} with (force);`);
  adminPsql(`create database ${DB_NAME};`);
}

function applyDir(dir, label) {
  const files = sqlFiles(dir);
  for (const f of files) {
    console.log(`${C.dim}· ${label} ${basename(f)}${C.reset}`);
    runFile(DB_NAME, f);
  }
  return files.length;
}

function runTests() {
  const files = sqlFiles(TESTS_DIR);
  if (files.length === 0) {
    console.log(`${C.yellow}Aucun test SQL dans supabase/tests/${C.reset}`);
    return 0;
  }
  let failed = 0;
  const started = Date.now();
  for (const f of files) {
    const name = basename(f, ".sql");
    const res = psql(DB_NAME, ["-f", f], { quiet: true });
    if (res.code === 0) {
      console.log(`  ${C.green}✓${C.reset} ${name}`);
    } else {
      failed += 1;
      console.log(`  ${C.red}✗${C.reset} ${name}`);
      const lines = res.stderr
        .split("\n")
        .filter((l) => l.trim())
        .slice(0, 10);
      for (const l of lines) console.log(`    ${C.red}${l}${C.reset}`);
    }
  }
  const ms = Date.now() - started;
  console.log(
    failed === 0
      ? `\n${C.green}${C.bold}${files.length} fichier(s) de test SQL : tous passent${C.reset} ${C.dim}(${ms} ms)${C.reset}`
      : `\n${C.red}${C.bold}${failed}/${files.length} fichier(s) de test SQL en échec${C.reset}`,
  );
  return failed === 0 ? 0 : 1;
}

const cmd = process.argv[2];

switch (cmd) {
  case "reset":
    dropAndCreate();
    applyDir(LOCAL_DIR, "local ");
    applyDir(MIGRATIONS_DIR, "migr. ");
    applyDir(SEED_DIR, "seed  ");
    console.log(`${C.green}Base locale ${DB_NAME} reconstruite.${C.reset}`);
    break;
  case "migrate":
    applyDir(MIGRATIONS_DIR, "migr. ");
    break;
  case "seed":
    applyDir(SEED_DIR, "seed  ");
    break;
  case "test":
    // La base est RECONSTRUITE avant chaque exécution. Sans cela, les tests
    // s'exécutent sur le schéma laissé par la dernière commande : une migration
    // corrigée et non rejouée passe alors inaperçue, et le rapport « tous
    // passent » porte sur du code qui n'est plus celui du dépôt. Le cas s'est
    // produit ici même.
    dropAndCreate();
    applyDir(LOCAL_DIR, "local ");
    applyDir(MIGRATIONS_DIR, "migr. ");
    applyDir(SEED_DIR, "seed  ");
    process.exit(runTests());
    break;
  case "concurrence": {
    // La numérotation ne peut pas se prouver dans une seule session : il faut
    // de VRAIS accès simultanés. On lance donc N processus psql en parallèle,
    // chacun réservant un rang, et on vérifie qu'aucun ne se répète et qu'il
    // n'y a aucun trou. C'est le critère du mandat : cent créations
    // simultanées produisent cent numéros distincts et continus.
    const N = Number(process.env.CONCURRENCE_N || 50);
    const serie = `CONCURRENCE-${Date.now()}`;
    console.log(`${C.dim}· ${N} réservations simultanées sur la série ${serie}${C.reset}`);

    const cabinet = "a1111111-1111-4111-8111-111111111111";

    // `spawn`, et surtout PAS `spawnSync` : enveloppé dans une promesse,
    // `spawnSync` s'exécute quand même de bout en bout avant de rendre la main,
    // et les processus se suivent au lieu de se chevaucher. Le test paraissait
    // alors concurrent sans l'être — il a validé une version délibérément
    // racée avant que cette erreur ne soit vue.
    const reserver = () =>
      new Promise((resolve) => {
        const p = spawn("psql", [
          ...baseArgs(DB_NAME),
          "-v", "ON_ERROR_STOP=1", "--no-psqlrc", "-tAc",
          `select app.next_billing_seq('${cabinet}'::uuid, '${serie}');`,
        ]);
        let sortie = "";
        p.stdout.on("data", (d) => (sortie += d));
        p.on("close", (code) =>
          resolve(code === 0 ? Number(sortie.trim()) : null),
        );
      });

    const resultats = await Promise.all(
      Array.from({ length: N }, () => reserver()),
    );

    const echecs = resultats.filter((r) => r === null).length;
    const valeurs = resultats.filter((r) => r !== null);
    const uniques = new Set(valeurs);
    const attendues = new Set(Array.from({ length: N }, (_, i) => i + 1));

    const problemes = [];
    if (echecs > 0) problemes.push(`${echecs} réservation(s) en échec`);
    if (uniques.size !== valeurs.length) {
      problemes.push(
        `${valeurs.length - uniques.size} numéro(s) attribué(s) deux fois`,
      );
    }
    for (const n of attendues) {
      if (!uniques.has(n)) problemes.push(`trou dans la série : ${n} manquant`);
    }

    if (problemes.length > 0) {
      console.log(`  ${C.red}✗${C.reset} numérotation sous concurrence`);
      for (const p of problemes) console.log(`    ${C.red}${p}${C.reset}`);
      process.exit(1);
    }
    console.log(
      `  ${C.green}✓${C.reset} ${N} numéros distincts et continus, sans trou ni doublon`,
    );
    break;
  }
  case "cutover": {
    // La bascule ne peut être prouvée que sur une base qui porte RÉELLEMENT le
    // modèle v1. On en fabrique une, on rejoue les migrations dans l'ordre, et
    // on vérifie ce qui en sort. Base distincte : la base de développement
    // n'est jamais touchée.
    const scratch = process.env.CUTOVER_DB_NAME || "psychomotime_bascule";
    console.log(`${C.dim}· base jetable ${scratch}${C.reset}`);
    adminPsql(`drop database if exists ${scratch} with (force);`);
    adminPsql(`create database ${scratch};`);

    const applique = (dir, label, filtre = () => true) => {
      for (const f of sqlFiles(dir).filter((x) => filtre(basename(x)))) {
        console.log(`${C.dim}· ${label} ${basename(f)}${C.reset}`);
        const res = psql(scratch, ["-f", f], { quiet: true });
        if (res.code !== 0) {
          console.error(`${C.red}✗ ${basename(f)}${C.reset}`);
          process.stderr.write(res.stderr);
          process.exit(1);
        }
      }
    };

    applique(LOCAL_DIR, "local ");

    // Le schéma v1 tel qu'il est en production. L'ordre compte et n'est PAS
    // l'ordre alphabétique : `schema.sql` pose les tables, les migrations les
    // font évoluer. `migrations_en_attente.sql` est un doublon documentaire,
    // périmé de six migrations — c'est précisément le défaut que la nouvelle
    // arborescence corrige.
    for (const f of ["schema.sql", ...sqlFiles(V1_DIR)
      .map((x) => basename(x))
      .filter((n) => n.startsWith("migration_"))
      .sort()]) {
      console.log(`${C.dim}· v1     ${f}${C.reset}`);
      const r = psql(scratch, ["-f", join(V1_DIR, f)], { quiet: true });
      if (r.code !== 0) {
        console.error(`${C.red}✗ ${f}${C.reset}`);
        process.stderr.write(r.stderr);
        process.exit(1);
      }
    }
    applique(CUTOVER_DIR, "v1-jeu");
    applique(MIGRATIONS_DIR, "migr. ");

    const res = psql(scratch, ["-f", join(CUTOVER_DIR, "verifications.sql.check")], {
      quiet: true,
    });
    if (res.code !== 0) {
      console.log(`  ${C.red}✗ vérifications de bascule${C.reset}`);
      process.stderr.write(res.stderr);
      process.exit(1);
    }
    console.log(`  ${C.green}✓${C.reset} vérifications de bascule`);
    console.log(`\n${C.green}${C.bold}Bascule v1 → cible rejouée et vérifiée.${C.reset}`);
    break;
  }
  case "budget": {
    /* LES BUDGETS SE MESURENT SUR UN VOLUME, PAS SUR UNE DÉMONSTRATION.
     *
     * Le jeu de démonstration compte cinq dossiers. À cette échelle tout est
     * rapide, y compris ce qui ne tiendra pas : un balayage complet de table
     * sur cinq lignes coûte moins qu'un parcours d'index. On fabrique donc une
     * base jetable, on y verse un cabinet fictif de taille réaliste, et on
     * mesure À TRAVERS LA RLS — mesurer en propriétaire de la base donnerait
     * des chiffres flatteurs et faux. */
    const scratch = process.env.BUDGET_DB_NAME || "psychomotime_budget";
    console.log(`${C.dim}· base jetable ${scratch}${C.reset}`);
    adminPsql(`drop database if exists ${scratch} with (force);`);
    adminPsql(`create database ${scratch};`);

    for (const f of [...sqlFiles(LOCAL_DIR), ...sqlFiles(MIGRATIONS_DIR)]) {
      const r = psql(scratch, ["-f", f], { quiet: true });
      if (r.code !== 0) {
        console.error(`${C.red}✗ ${basename(f)}${C.reset}`);
        process.stderr.write(r.stderr);
        process.exit(1);
      }
    }

    const volumetrie = join(PERF_DIR, "0001_volumetrie.sql");
    const dossiers = process.env.BUDGET_DOSSIERS || "400";
    console.log(`${C.dim}· jeu volumineux — ${dossiers} dossiers${C.reset}`);
    const v = psql(
      scratch,
      ["-c", `set budget.dossiers = '${Number(dossiers)}'`, "-f", volumetrie],
      { quiet: true },
    );
    if (v.code !== 0) {
      console.error(`${C.red}✗ volumétrie${C.reset}`);
      process.stderr.write(v.stderr);
      process.exit(1);
    }

    const res = psql(scratch, ["-f", join(PERF_DIR, "0002_budgets.sql")]);
    if (res.code !== 0) {
      console.log(`\n${C.red}${C.bold}Budgets de performance dépassés.${C.reset}`);
      process.exit(1);
    }
    console.log(`\n${C.green}${C.bold}Tous les budgets sont tenus.${C.reset}`);
    break;
  }
  case "psql":
    spawnSync("psql", baseArgs(DB_NAME), { stdio: "inherit" });
    break;
  default:
    console.log(
      "Commandes : reset | migrate | seed | test | concurrence | cutover | budget | psql\n" +
        "Voir l'en-tête de scripts/db.mjs pour les variables d'environnement.",
    );
    process.exit(cmd ? 1 : 0);
}
