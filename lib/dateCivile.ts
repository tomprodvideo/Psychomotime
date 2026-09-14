/**
 * LA DATE DU JOUR, TELLE QU'ON LA LIT AU CABINET.
 *
 * ── LE DÉFAUT QU'ELLE CORRIGE ─────────────────────────────────────────────
 *
 * La date « d'aujourd'hui » était obtenue ainsi, en vingt et un endroits :
 *
 *     new Date().toISOString().slice(0, 10)
 *
 * `toISOString()` rend TOUJOURS l'heure UTC, quel que soit le fuseau de la
 * machine. Pour un cabinet à Paris, entre minuit et une heure du matin l'hiver
 * — deux heures l'été — c'est donc la date de la VEILLE. Mesuré : à 00 h 30 le
 * 13 mars 2026 à Paris, l'expression rend « 2026-03-12 ». La fiche patient
 * imprimée à cette heure-là portait la veille en en-tête et dans le rappel de
 * chaque page.
 *
 * UNE DATE CIVILE NE SE CALCULE PAS À CÔTÉ D'UN ÂGE : ELLE LE NOURRIT. Le
 * premier usage de ce module rendait la date juste sans l'âge, encore calculé
 * sur l'instant — donc dans le fuseau du processus. Sur un serveur UTC, il
 * imprimait « Éditée le 14/09 » à côté de l'âge du 13/09, le jour même d'un
 * anniversaire : la contradiction même qu'il prétendait corriger. Pour un
 * document daté, passer par `editionEtAge` (`lib/age.ts`).
 *
 * ── LE FUSEAU N'EST PAS UNE HYPOTHÈSE ─────────────────────────────────────
 *
 * Le cabinet en porte un en base : `practices.timezone`, `'Europe/Paris'` par
 * défaut (migration `0001`). C'est lui qui fait foi, et c'est ce qui rend ce
 * module juste pour un cabinet à La Réunion ou en Guyane, où le jour civil
 * bascule à une autre heure qu'à Paris.
 *
 * MODULE PUR : l'instant et le fuseau sont des paramètres, jamais lus en
 * douce. Le résultat ne dépend pas du fuseau du processus — contrôlé en
 * rejouant les contrôles sous `TZ=UTC` et `TZ=Europe/Paris`.
 */

/** Le défaut de `practices.timezone` (migration `0001`), et rien de plus. */
export const FUSEAU_PAR_DEFAUT = "Europe/Paris";

/**
 * Un fuseau utilisable. La colonne n'a AUCUNE contrainte de validité : une
 * valeur illisible y est possible. Plutôt que de faire échouer l'impression
 * d'une fiche, on retombe sur le défaut que la base aurait posé elle-même.
 */
export function fuseauUtilisable(fuseau: string | null | undefined): string {
  if (!fuseau?.trim()) return FUSEAU_PAR_DEFAUT;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: fuseau.trim() });
    return fuseau.trim();
  } catch {
    return FUSEAU_PAR_DEFAUT;
  }
}

/**
 * La date civile — « AAAA-MM-JJ » — d'un instant, dans un fuseau.
 *
 * `formatToParts` plutôt qu'une chaîne formatée : l'ordre jour/mois/année
 * dépend de la langue, les parties nommées non.
 */
export function dateCivile(instant: Date, fuseau: string | null | undefined): string {
  const parties = new Intl.DateTimeFormat("en-US", {
    timeZone: fuseauUtilisable(fuseau),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const partie = (type: Intl.DateTimeFormatPartTypes) =>
    parties.find((p) => p.type === type)?.value ?? "";
  return `${partie("year")}-${partie("month")}-${partie("day")}`;
}

/* ==========================================================================
 *  Arithmétique des jours civils, et heures du cabinet
 * ==========================================================================
 *
 * L'AGENDA TROUVAIT SON JOUR PAR `setHours(0, 0, 0, 0)` — minuit dans le fuseau
 * du SERVEUR —, puis le relisait en UTC dans le navigateur, et enregistrait un
 * horaire saisi en l'interprétant, lui aussi, dans le fuseau du serveur. Sous un
 * serveur UTC, « 14 h 30 » devenait 16 h 30 à Paris ; sous un serveur réglé sur
 * Paris, « jour suivant » ramenait au même jour. Chaque version n'était
 * cohérente qu'avec UN fuseau de serveur.
 *
 * Tout passe désormais par des jours civils et par le fuseau du cabinet, écrit
 * en toutes lettres. Le résultat ne dépend plus ni du serveur, ni du poste.
 */

const FORMAT_JOUR = /^\d{4}-\d{2}-\d{2}$/;
const FORMAT_HEURE = /^\d{2}:\d{2}$/;

function partiesDuJour(civile: string): [number, number, number] {
  if (!FORMAT_JOUR.test(civile)) throw new RangeError(`Jour civil illisible : ${civile}`);
  const [a, m, j] = civile.split("-").map(Number);
  return [a, m, j];
}

/**
 * Ajoute `n` jours à un jour civil. Arithmétique en UTC PUR : aucun fuseau,
 * donc aucun changement d'heure, ne peut faire sauter ou doubler un jour.
 */
export function ajouterJours(civile: string, n: number): string {
  const [a, m, j] = partiesDuJour(civile);
  const d = new Date(Date.UTC(a, m - 1, j + n));
  /* Composé à la main, pas par `toISOString().slice(0, 10)` : le résultat serait
     juste ici — la date est construite en UTC —, mais c'est le motif que
     `lib/dates.architecture.test.mts` interdit partout, et le module qui fournit
     la bonne voie ne doit pas avoir besoin d'exemption. */
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** Le lundi de la semaine d'un jour civil. */
export function lundiDe(civile: string): string {
  const [a, m, j] = partiesDuJour(civile);
  const jourSemaine = new Date(Date.UTC(a, m - 1, j)).getUTCDay(); // 0 = dimanche
  return ajouterJours(civile, -((jourSemaine + 6) % 7));
}

/** L'écart d'un fuseau à UTC, en millisecondes, à un instant donné. */
function ecartUTC(instant: Date, fuseau: string): number {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: fuseau,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const v = (t: Intl.DateTimeFormatPartTypes) => Number(p.find((x) => x.type === t)?.value);
  const lu = Date.UTC(v("year"), v("month") - 1, v("day"), v("hour"), v("minute"), v("second"));
  return lu - (instant.getTime() - (instant.getTime() % 1000));
}

/**
 * L'instant où il est `heure` le jour civil `civile`, dans le fuseau du cabinet.
 *
 * Deux passes : l'écart au premier essai peut ne pas être celui de l'instant
 * trouvé, la nuit d'un changement d'heure. Une heure qui n'existe pas — 2 h 30
 * le jour du passage à l'heure d'été — avance jusqu'à la première qui existe ;
 * une heure qui existe deux fois — 2 h 30 le jour du retour à l'heure d'hiver —
 * désigne la seconde. Les deux cas sont contrôlés.
 */
export function instantDuCabinet(
  civile: string,
  heure: string,
  fuseau: string | null | undefined,
): Date {
  if (!FORMAT_HEURE.test(heure)) throw new RangeError(`Heure illisible : ${heure}`);
  const tz = fuseauUtilisable(fuseau);
  const [a, m, j] = partiesDuJour(civile);
  const [h, mn] = heure.split(":").map(Number);
  const naif = Date.UTC(a, m - 1, j, h, mn);
  const premier = naif - ecartUTC(new Date(naif), tz);
  return new Date(naif - ecartUTC(new Date(premier), tz));
}

/** Minuit, le jour civil `civile`, dans le fuseau du cabinet. */
export function debutDuJour(civile: string, fuseau: string | null | undefined): Date {
  return instantDuCabinet(civile, "00:00", fuseau);
}

/** L'heure « HH:MM » d'un instant, dans le fuseau du cabinet. */
export function heureDuCabinet(instant: Date, fuseau: string | null | undefined): string {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: fuseauUtilisable(fuseau),
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(instant);
  const v = (t: Intl.DateTimeFormatPartTypes) => p.find((x) => x.type === t)?.value ?? "00";
  return `${v("hour")}:${v("minute")}`;
}
