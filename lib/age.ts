/**
 * Calcul d'âge à une date DONNÉE.
 *
 * POURQUOI CE MODULE EXISTE. `ageFromBirth` lisait l'horloge (`new Date()`) et
 * ne recevait jamais la date de passation. Un bilan passé en février et
 * réimprimé en septembre affichait un âge faussé de sept mois — sur un document
 * dont toute la lecture repose sur des normes par classe d'âge.
 *
 * La date de référence est donc TOUJOURS un paramètre. Il n'y a pas de valeur
 * par défaut : oublier de la passer doit être impossible, pas silencieux.
 */

import { dateCivile } from "@/lib/dateCivile";

export interface Age {
  years: number;
  months: number;
  days: number;
  /** Âge total en mois révolus. Sert aux tranches d'âge des instruments. */
  totalMonths: number;
}

/**
 * Une date CIVILE, « AAAA-MM-JJ ». Jamais un instant.
 *
 * ── POURQUOI CE MODULE N'ACCEPTE PLUS D'INSTANT ───────────────────────────
 *
 * `ageAt` acceptait un `Date`, et le lisait par `getFullYear`, `getMonth` et
 * `getDate` — dans le fuseau du PROCESSUS. Sur un serveur UTC, à 00 h 30 à
 * Paris le jour d'un anniversaire, il rendait l'âge de la VEILLE. Quatre écrans
 * lui passaient un instant : la fiche patient, la liste des dossiers, la page
 * d'un dossier, l'éditeur de bilan. La fiche imprimait ainsi « Éditée le
 * 14/09 » à côté de l'âge du 13/09. Rien ne le voyait sur une machine réglée
 * sur Paris.
 *
 * Le type n'admet donc plus qu'une chaîne : passer un `Date` est une ERREUR DE
 * COMPILATION. Et une chaîne horodatée — `toISOString()` — ne donne plus aucun
 * âge : elle désigne un instant, pas un jour, et un âge absent se voit là où un
 * âge faux passe inaperçu. Pour « aujourd'hui » : `dateCivile(instant, fuseau
 * du cabinet)`, de `lib/dateCivile.ts`.
 */
export type DateCivile = string;

const FORMAT_CIVIL = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Relue à minuit LOCAL, puis rendue par les accesseurs locaux : une date civile
 * retombe sur le même jour quel que soit le fuseau du processus.
 */
function parseDate(civile: DateCivile | null | undefined): Date | null {
  if (!civile || !FORMAT_CIVIL.test(civile)) return null;
  const d = new Date(`${civile}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Âge à la date `at`, en années, mois et jours révolus.
 *
 * Rend `null` si l'une des deux dates manque, ou si la date de référence
 * précède la naissance — un âge négatif n'a pas de sens, et le signaler vaut
 * mieux que de rendre un nombre trompeur.
 */
export function ageAt(
  birthDate: DateCivile | null | undefined,
  at: DateCivile,
): Age | null {
  const birth = parseDate(birthDate);
  const ref = parseDate(at);
  if (!birth || !ref) return null;
  if (ref.getTime() < birth.getTime()) return null;

  let years = ref.getFullYear() - birth.getFullYear();
  let months = ref.getMonth() - birth.getMonth();
  let days = ref.getDate() - birth.getDate();

  if (days < 0) {
    months -= 1;
    // Nombre de jours du mois qui précède la date de référence.
    const moisPrecedent = new Date(ref.getFullYear(), ref.getMonth(), 0).getDate();
    days += moisPrecedent;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  return { years, months, days, totalMonths: years * 12 + months };
}

/**
 * Âge en toutes lettres, dans la forme employée dans les comptes rendus.
 *
 * Sous un an, on parle en mois : c'est la granularité qui fait sens à cet âge,
 * et les étalonnages de la petite enfance sont mensuels.
 */
export function formatAge(age: Age | null): string {
  if (!age) return "";
  if (age.years === 0) {
    if (age.months === 0) return `${age.days} jour${age.days > 1 ? "s" : ""}`;
    return `${age.months} mois`;
  }
  const ans = `${age.years} an${age.years > 1 ? "s" : ""}`;
  return age.months === 0 ? ans : `${ans} ${age.months} mois`;
}

/** Raccourci : âge formaté à une date donnée. */
export function formatAgeAt(
  birthDate: DateCivile | null | undefined,
  at: DateCivile,
): string {
  return formatAge(ageAt(birthDate, at));
}

/**
 * LA DATE D'ÉDITION D'UN DOCUMENT ET L'ÂGE QU'IL IMPRIME — calculés ENSEMBLE.
 *
 * ── LE DÉFAUT QUE CETTE FONCTION REND IMPOSSIBLE ──────────────────────────
 *
 * La fiche patient dérivait ses deux valeurs du même instant, séparément :
 * la date par un calcul de date civile, l'âge par `formatAgeAt(naissance,
 * instant)`. Or un `Date` passé à `ageAt` est lu par `getFullYear`,
 * `getMonth` et `getDate` — dans le fuseau du PROCESSUS serveur. Mesuré, pour
 * un anniversaire (naissance fictive le 14/09/2018) à 00 h 30 le 14/09/2026 à
 * Paris, sous un processus UTC :
 *
 *     en-tête « Éditée le 14/09/2026 »   âge imprimé « 7 ans 11 mois »
 *
 * Avant tout correctif, sur un serveur UTC, la date ET l'âge étaient ceux de la
 * veille : faux, mais cohérents entre eux. Le premier correctif (`88b5fd6`) a
 * rendu la date juste sans l'âge — il a CRÉÉ la contradiction qu'il décrivait.
 * Sur une machine réglée sur Paris, rien ne se voyait. Relevé par une seconde
 * session de travail, puis mesuré ici sous trois fuseaux avant d'être corrigé.
 *
 * La chaîne « AAAA-MM-JJ », elle, est relue à minuit LOCAL par `parseDate`,
 * puis rendue par les mêmes accesseurs : elle retombe sur le même jour civil,
 * quel que soit le fuseau du processus. L'âge est donc calculé sur ELLE.
 */
export function editionEtAge(
  birthDate: string | null | undefined,
  instant: Date,
  fuseau: string | null | undefined,
): { editeLe: string; age: string } {
  const editeLe = dateCivile(instant, fuseau);
  return { editeLe, age: formatAgeAt(birthDate, editeLe) };
}
