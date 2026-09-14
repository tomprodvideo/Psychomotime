import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * GARDE-FOU STRUCTUREL — une date ne se lit ni en UTC, ni dans le fuseau du
 * processus.
 *
 * LE DÉFAUT D'ORIGINE : `new Date().toISOString().slice(0, 10)` rend la date
 * UTC. Pour un cabinet à Paris, entre minuit et une heure du matin l'hiver —
 * deux heures l'été —, c'est la VEILLE. Rien ne le voyait sur une machine
 * réglée sur Paris, ni dans `npm run verify`, qui y tourne.
 *
 * CE GARDE-FOU N'EN SURVEILLAIT QU'UNE FORME, et la dette a été déclarée soldée
 * alors que les autres restaient : `getFullYear` pour l'année comptable en
 * cours, `setHours(0, 0, 0, 0)` pour la journée de l'accueil, `setMonth` pour
 * la période d'une synthèse, des heures de rendez-vous formatées sans fuseau,
 * `x_at.slice(0, 10)` pour le jour d'une séance — jusque dans les dates de
 * prestation d'une facture. Le 2026-09-14, toutes ont été corrigées, et chacune
 * est désormais interdite ici.
 *
 * LA RÈGLE, EN TROIS PHRASES :
 *  · un JOUR « d'aujourd'hui » se calcule dans le fuseau du cabinet —
 *    `dateCivile(instant, practice.timezone)` ;
 *  · un INSTANT s'affiche dans le fuseau du cabinet — `frJourDe`, ou un
 *    formateur qui porte `timeZone` ;
 *  · un JOUR CIVIL ne passe par aucun fuseau — `frDate`, `ajouterJours`,
 *    `ajouterMois`, et l'arithmétique UTC de `lib/dateCivile.ts`.
 *
 * CE QU'IL NE VOIT PAS, ET QUI RESTE À LA RELECTURE : des options de formateur
 * passées par une variable, un instant rangé sous un nom qui ne finit pas par
 * `_at`, un jour sous un nom qui ne finit ni par `_on` ni par `_date`. Côté
 * base, c'est `supabase/tests/160` qui interdit `current_date` et les fuseaux
 * figés.
 *
 * LA LISTE DE DETTE DOIT RÉTRÉCIR, JAMAIS S'ALLONGER. Elle est vide : toute
 * entrée future devra y être écrite, avec sa raison, et un contrôle oblige à
 * l'en retirer dès que le fichier est corrigé.
 */

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");

/* LA DETTE EST SOLDÉE — le 2026-09-14, pour les sept formes surveillées. */
const DETTE_Q507: Record<string, string> = {};

/** Toutes les façons connues d'extraire la date UTC d'un instant. */
const DATE_UTC =
  /\.to(?:ISOString|JSON)\(\)\s*\.\s*(?:(?:slice|substring|substr)\(\s*0\s*,\s*10\s*\)|split\(\s*["'`]T["'`]\s*\)\s*\[\s*0\s*\])/;

/** La même extraction, sur un horodatage déjà sérialisé (`starts_at`, `archived_at`…). */
const INSTANT_TRONQUE =
  /_at\b[!?]?\s*(?:\?\.|\.)\s*(?:(?:slice|substring|substr)\(\s*0\s*,\s*10\s*\)|split\(\s*["'`]T["'`]\s*\))/;

/** Un horodatage confié à `frDate`, qui n'écrit que des jours. */
const FRDATE_INSTANT = /frDate\(\s*[\w.?!]*_at\b!?\s*\)/;

/** Les accesseurs et modificateurs LOCAUX : ils lisent le fuseau du processus. */
const HORLOGE_LOCALE =
  /\.(?:getFullYear|getMonth|getDate|getDay|getHours|getMinutes|getSeconds|setHours|setDate|setMonth|setFullYear|setMinutes|setSeconds)\(/;

/** Un jour civil lu comme un instant : `new Date("AAAA-MM-JJ")` est minuit UTC. */
const JOUR_LU_EN_INSTANT = /new Date\(\s*[\w.?!]*(?:_on|_date)\b!?\s*\)/;

/**
 * Les arguments de chaque appel reconnu par `ouverture`, relus parenthèses
 * équilibrées et chaînes sautées. Un motif régulier s'arrête au premier `)`
 * d'un appel imbriqué : `new Date(ref.getUTCFullYear(), …)` lui échappait.
 * Rend, pour chaque appel, les arguments et la présence d'une virgule au
 * premier niveau.
 */
function appels(code: string, ouverture: RegExp): { args: string; plusieurs: boolean }[] {
  const out: { args: string; plusieurs: boolean }[] = [];
  const motif = new RegExp(ouverture.source, "g");
  for (let m = motif.exec(code); m; m = motif.exec(code)) {
    let profondeur = 1;
    let plusieurs = false;
    let i = m.index + m[0].length;
    const debut = i;
    while (i < code.length && profondeur > 0) {
      const c = code[i];
      if (c === '"' || c === "'" || c === "`") {
        const fin = code.indexOf(c, i + 1);
        i = fin === -1 ? code.length : fin + 1;
        continue;
      }
      if (c === "(" || c === "[" || c === "{") profondeur += 1;
      else if (c === ")" || c === "]" || c === "}") profondeur -= 1;
      else if (c === "," && profondeur === 1) plusieurs = true;
      i += 1;
    }
    out.push({ args: code.slice(debut, i - 1), plusieurs });
  }
  return out;
}

/** `new Date(année, mois, jour)` : un instant construit dans le fuseau du processus. */
function constructeurLocal(code: string): boolean {
  return appels(code, /new Date\(/).some((a) => a.plusieurs);
}

/** Un formateur de date sans `timeZone` : il écrit dans le fuseau du processus. */
function formateurSansFuseau(code: string): boolean {
  return appels(code, /(?:Intl\.DateTimeFormat|\.toLocaleDateString|\.toLocaleTimeString)\(/).some(
    (a) => !a.args.includes("timeZone"),
  );
}

const DETECTEURS: { nom: string; trouve: (code: string) => boolean }[] = [
  { nom: "date UTC tronquée", trouve: (c) => DATE_UTC.test(c) },
  { nom: "horodatage tronqué", trouve: (c) => INSTANT_TRONQUE.test(c) },
  { nom: "horodatage confié à frDate", trouve: (c) => FRDATE_INSTANT.test(c) },
  { nom: "accesseur local", trouve: (c) => HORLOGE_LOCALE.test(c) },
  { nom: "jour lu comme un instant", trouve: (c) => JOUR_LU_EN_INSTANT.test(c) },
  { nom: "instant construit en heure locale", trouve: constructeurLocal },
  { nom: "formateur sans fuseau", trouve: formateurSansFuseau },
];

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

function formesTrouvees(code: string): string[] {
  return DETECTEURS.filter((d) => d.trouve(code)).map((d) => d.nom);
}

const SOURCES = DOSSIERS.flatMap(fichiersSource).map((f) => relative(ROOT, f).replace(/\\/g, "/"));

test("le corpus analysé n'est pas vide, et chaque détecteur reconnaît ce qu'il doit — et seulement cela", () => {
  /* Un test de recherche qui ne regarde rien, ou qui ne reconnaît rien, passe
   * toujours. Il faut d'abord prouver les deux. Et un détecteur qui prend tout
   * serait contourné par une liste d'exceptions : il faut prouver aussi ce
   * qu'il laisse passer. */
  assert.ok(SOURCES.length > 30, `Seulement ${SOURCES.length} fichiers analysés.`);
  assert.ok(SOURCES.includes("lib/dateCivile.ts"));

  const doitTrouver: [string, string][] = [
    ["date UTC tronquée", "new Date().toISOString().slice(0, 10)"],
    ["date UTC tronquée", "d.toISOString().slice(0,10)"],
    ["date UTC tronquée", "d.toISOString().substring(0, 10)"],
    ["date UTC tronquée", 'd.toISOString().split("T")[0]'],
    ["date UTC tronquée", "d.toISOString().split('T')[0]"],
    ["date UTC tronquée", "d.toJSON().slice(0, 10)"],
    ["date UTC tronquée", "d\n      .toISOString()\n      .slice(0, 10)"],
    ["horodatage tronqué", "rdv.starts_at.slice(0, 10)"],
    ["horodatage tronqué", "l.expires_at?.slice(0,10)"],
    ["horodatage tronqué", "p.archived_at!.substring(0, 10)"],
    ["horodatage tronqué", 'x.created_at.split("T")'],
    ["horodatage confié à frDate", "frDate(s.created_at)"],
    ["horodatage confié à frDate", "frDate(l.last_accessed_at!)"],
    ["accesseur local", "maintenant.getFullYear()"],
    ["accesseur local", "debut.setHours(0, 0, 0, 0)"],
    ["accesseur local", "du.setMonth(du.getMonth() - 6)"],
    ["jour lu comme un instant", "new Date(i.licence_expires_on)"],
    ["jour lu comme un instant", "new Date(p.birth_date)"],
    ["instant construit en heure locale", "new Date(annee, mois, 0)"],
    ["instant construit en heure locale", "new Date(ref.getUTCFullYear(), ref.getUTCMonth(), 0)"],
    ["formateur sans fuseau", 'new Intl.DateTimeFormat("fr-FR").format(d)'],
    ["formateur sans fuseau", 'new Intl.DateTimeFormat("fr-FR", {\n  hour: "2-digit",\n  minute: "2-digit",\n})'],
    ["formateur sans fuseau", 'maintenant.toLocaleDateString("fr-FR")'],
  ];
  for (const [nom, variante] of doitTrouver) {
    assert.ok(formesTrouvees(variante).includes(nom), `« ${nom} » non reconnu : ${variante}`);
  }

  const doitLaisserPasser = [
    "dateCivile(new Date(), practice.timezone)",
    "expires_at.toISOString()",
    "periode.du.slice(0, 4)",
    "jour.slice(0, 10)",
    "frDate(a.issued_on)",
    "frJourDe(s.created_at, fuseau)",
    "d.getUTCFullYear() + d.getUTCMonth() + d.getUTCDate()",
    "debut.getTime() < maintenant.getTime()",
    "new Date(rdv.starts_at)",
    "new Date(`${jour}T12:00:00Z`)",
    "new Date(Date.UTC(annee, mois, 0))",
    "new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 0))",
    'new Date(`${jour}T12:00:00Z`.replace(",", ""))',
    "new Date(depuis.getTime() + jours * 86_400_000)",
    'new Intl.DateTimeFormat("fr-FR", { timeZone: fuseau, hour: "2-digit" })',
    'new Intl.DateTimeFormat("fr-FR", {\n  timeZone: "UTC",\n  weekday: "long",\n})',
    'new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" })',
  ];
  for (const variante of doitLaisserPasser) {
    assert.deepEqual(formesTrouvees(variante), [], `faux positif : ${variante}`);
  }
});

test("aucune lecture de date en UTC ou dans le fuseau du processus, hors de la dette nommée", () => {
  const coupables: string[] = [];
  for (const fichier of SOURCES) {
    if (fichier in DETTE_Q507) continue;
    const formes = formesTrouvees(codeSeul(readFileSync(join(ROOT, fichier), "utf8")));
    if (formes.length > 0) coupables.push(`${fichier} — ${formes.join(", ")}`);
  }
  assert.deepEqual(
    coupables,
    [],
    "Date lue hors du fuseau du cabinet. Un jour : dateCivile(instant, practice.timezone) ; " +
      `un instant affiché : frJourDe, ou un formateur avec timeZone :\n  ${coupables.join("\n  ")}`,
  );
});

test("la dette rétrécit : un fichier corrigé doit quitter la liste", () => {
  /* Sans ce contrôle, une ligne resterait après correction, et le fichier
   * pourrait ensuite réintroduire le défaut sans rien faire échouer. */
  const perimees = Object.keys(DETTE_Q507).filter(
    (fichier) =>
      !SOURCES.includes(fichier) ||
      formesTrouvees(codeSeul(readFileSync(join(ROOT, fichier), "utf8"))).length === 0,
  );
  assert.deepEqual(perimees, [], `Retirer de DETTE_Q507 :\n  ${perimees.join("\n  ")}`);
});
