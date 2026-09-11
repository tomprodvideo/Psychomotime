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
 *   node scripts/db.mjs psql     ouvre une session psql sur la base locale
 *
 * Variables d'environnement
 *   LOCAL_DB_NAME  (défaut: psychomotime_dev)
 *   LOCAL_DB_HOST  (défaut: localhost)
 *   LOCAL_DB_PORT  (défaut: 5432)
 *   LOCAL_DB_USER  (défaut: utilisateur courant)
 */

import { spawnSync } from "node:child_process";
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
    process.exit(runTests());
    break;
  case "psql":
    spawnSync("psql", baseArgs(DB_NAME), { stdio: "inherit" });
    break;
  default:
    console.log(
      "Commandes : reset | migrate | seed | test | psql\n" +
        "Voir l'en-tête de scripts/db.mjs pour les variables d'environnement.",
    );
    process.exit(cmd ? 1 : 0);
}
