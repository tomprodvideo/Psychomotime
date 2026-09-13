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
 * chaque page — alors que l'âge, calculé sur l'instant, était juste : la date
 * affichée pouvait contredire l'âge imprimé à côté.
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
