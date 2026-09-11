/**
 * Arithmétique monétaire — centimes entiers.
 *
 * POURQUOI CE MODULE EXISTE.
 * L'arrondi précédent, `Math.round((n + Number.EPSILON) * 100) / 100`, est faux
 * sur des montants ordinaires, et il est faux de façon incohérente :
 *
 *     round2(1.005)  → 1.01   (arrondi au supérieur)
 *     round2(8.165)  → 8.16   (arrondi à l'inférieur)
 *
 * `Number.EPSILON` vaut 2,22e-16 : il ne corrige la représentation binaire qu'aux
 * alentours de l'ordre de grandeur 1. Au-delà, il ne compense plus rien. Sur une
 * séance à 32,30 € avec 25 % de rétrocession, `32.30 * 0.25` vaut en binaire un
 * nombre très légèrement inférieur à 8,075, et l'arrondi rend **8,07 €** là où le
 * calcul commercial rend **8,08 €**. Un centime, sur chaque ligne concernée,
 * pendant toute une année d'exercice.
 *
 * La seule correction possible est de ne jamais représenter un montant par un
 * flottant. Ici, un montant est un ENTIER DE CENTIMES, et un taux est un ENTIER
 * DE POINTS DE BASE (1 bp = 0,01 % ; 25 % = 2500 bp). Les deux vivent aussi dans
 * la base — `bigint` et `integer` — de sorte qu'aucune conversion ne se glisse
 * entre le calcul et le stockage.
 *
 * RÈGLE D'ARRONDI. Arrondi commercial au centime le plus proche, le demi-centime
 * s'éloignant de zéro (« half away from zero »). Elle s'applique UNE SEULE FOIS,
 * au moment où un taux produit une fraction de centime — jamais en cascade sur
 * des résultats déjà arrondis.
 *
 * [VALIDATION HUMAINE] La règle d'arrondi applicable aux pièces comptables reste
 * à confirmer par un expert-comptable. Voir docs/refonte/recherche/03-comptabilite-fiscalite-fr.md.
 */

/** Montant en centimes. Toujours un entier, jamais un flottant. */
export type Cents = number;

/** Taux en points de base. 1 bp = 0,01 %. 25 % = 2500 bp. 100 % = 10000 bp. */
export type BasisPoints = number;

export const BP_SCALE = 10_000;

/** Vrai si la valeur est un montant en centimes exploitable. */
export function isCents(value: unknown): value is Cents {
  return typeof value === "number" && Number.isSafeInteger(value);
}

/**
 * Convertit un nombre d'euros en centimes.
 *
 * N'utiliser QUE sur une valeur dont on sait qu'elle vient d'un affichage ou
 * d'un ancien enregistrement. Pour une saisie utilisateur, préférer
 * `parseAmountToCents`, qui lit la chaîne sans passer par un flottant décimal.
 */
export function eurosToCents(euros: number): Cents {
  if (!Number.isFinite(euros)) return 0;
  return Math.round(euros * 100);
}

/** Convertit des centimes en euros. À n'employer que pour afficher ou exporter. */
export function centsToEuros(cents: Cents): number {
  return cents / 100;
}

/**
 * Lit une saisie utilisateur et rend des centimes, sans jamais construire de
 * flottant décimal intermédiaire.
 *
 * Accepte « 32,30 », « 32.30 », « 1 234,56 », « 1.234,56 €», « -12 », « .5 ».
 * Rend `null` si la chaîne ne désigne pas un montant — un champ vide n'est pas
 * zéro, et le distinguer est le fondement de « une donnée absente n'est pas une
 * donnée nulle ».
 */
export function parseAmountToCents(input: string | number | null | undefined): Cents | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") {
    return Number.isFinite(input) ? eurosToCents(input) : null;
  }

  // On retire espaces (y compris insécables), symboles monétaires et séparateurs
  // de milliers, puis on ramène la virgule décimale française au point.
  let s = input.trim();
  if (!s) return null;
  s = s.replace(/[\s  ]/g, "").replace(/[€$£]/g, "");

  const negative = /^-/.test(s) || /^\(.*\)$/.test(s);
  s = s.replace(/^[-+]/, "").replace(/^\((.*)\)$/, "$1");

  // Le dernier séparateur rencontré est le séparateur décimal ; les autres sont
  // des séparateurs de milliers.
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  const decimalAt = Math.max(lastComma, lastDot);

  let whole: string;
  let frac: string;
  if (decimalAt === -1) {
    whole = s;
    frac = "";
  } else {
    whole = s.slice(0, decimalAt);
    frac = s.slice(decimalAt + 1);
  }
  whole = whole.replace(/[.,]/g, "");
  if (!/^\d*$/.test(whole) || !/^\d*$/.test(frac)) return null;
  if (whole === "" && frac === "") return null;

  // Au-delà de deux décimales, on arrondit au centime le plus proche.
  const units = whole === "" ? 0 : Number(whole);
  let cents: number;
  if (frac.length <= 2) {
    cents = units * 100 + Number((frac + "00").slice(0, 2));
  } else {
    const twoFirst = Number(frac.slice(0, 2));
    const next = Number(frac[2]);
    cents = units * 100 + twoFirst + (next >= 5 ? 1 : 0);
  }
  if (!Number.isSafeInteger(cents)) return null;
  return negative ? -cents : cents;
}

/**
 * Applique un taux exprimé en points de base à un montant en centimes.
 *
 * Tout le calcul est entier : `cents * bp` puis division par 10 000 avec
 * arrondi commercial. Aucun flottant n'intervient, donc aucune représentation
 * binaire ne peut déplacer le résultat d'un centime.
 *
 *     applyRate(3230, 2500) === 808     // 32,30 € à 25 % → 8,08 €
 */
export function applyRate(cents: Cents, bp: BasisPoints): Cents {
  const numerator = cents * bp;
  const quotient = Math.trunc(numerator / BP_SCALE);
  const remainder = Math.abs(numerator % BP_SCALE);
  if (remainder * 2 < BP_SCALE) return quotient;
  return quotient + (numerator < 0 ? -1 : 1);
}

/** Somme de montants. Exacte : additionner des entiers ne perd rien. */
export function sumCents(values: readonly Cents[]): Cents {
  let total = 0;
  for (const v of values) total += v;
  return total;
}

/**
 * Répartit un montant en `parts` parts aussi égales que possible, sans perdre
 * ni créer un centime. Les premiers reçoivent le centime supplémentaire.
 *
 * Sert notamment à étaler une dépense annuelle sur douze mois : douze fois
 * `Math.round(montant / 12)` ne retombe pas sur le montant de départ.
 */
export function splitCents(cents: Cents, parts: number): Cents[] {
  if (!Number.isInteger(parts) || parts <= 0) return [];
  const sign = cents < 0 ? -1 : 1;
  const abs = Math.abs(cents);
  const base = Math.floor(abs / parts);
  const remainder = abs - base * parts;
  return Array.from({ length: parts }, (_, i) =>
    sign * (base + (i < remainder ? 1 : 0)),
  );
}

const EURO_FORMAT = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

/** Affiche un montant en centimes au format français. */
export function formatCents(cents: Cents | null | undefined): string {
  return EURO_FORMAT.format(centsToEuros(cents ?? 0));
}

const PERCENT_FORMAT = new Intl.NumberFormat("fr-FR", {
  style: "percent",
  maximumFractionDigits: 2,
});

/** Affiche un taux en points de base au format français. 2500 → « 25 % ». */
export function formatBasisPoints(bp: BasisPoints | null | undefined): string {
  return PERCENT_FORMAT.format((bp ?? 0) / BP_SCALE);
}

/** Convertit un taux décimal historique (0,25) en points de base (2500). */
export function rateToBasisPoints(rate: number): BasisPoints {
  if (!Number.isFinite(rate)) return 0;
  return Math.round(rate * BP_SCALE);
}
