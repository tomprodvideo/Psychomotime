/**
 * Numérotation des factures.
 *
 * Le modèle est un gabarit saisi dans Paramètres › Comptabilité, composé de
 * texte libre et de jetons :
 *   {AAAA} année sur 4 chiffres · {AA} année sur 2 chiffres
 *   {MM}   mois sur 2 chiffres
 *   {NNN}  compteur séquentiel — le nombre de N donne le nombre de chiffres
 *
 * Le compteur repart de 1 à chaque fois que la partie fixe change : un modèle
 * contenant {AAAA} se remet donc naturellement à zéro chaque année, un modèle
 * contenant {MM} chaque mois, et un modèle sans jeton de date reste continu.
 */

export const DEFAULT_INVOICE_FORMAT = "{AAAA}-{NNN}";

export const INVOICE_TOKENS: { token: string; label: string }[] = [
  { token: "{AAAA}", label: "année (2026)" },
  { token: "{AA}", label: "année (26)" },
  { token: "{MM}", label: "mois (03)" },
  { token: "{NNN}", label: "compteur (001)" },
];

export type NumberContext = { year: number; month: number }; // month : 0-11

/** Éclate le modèle autour du compteur, jetons de date déjà remplacés. */
export function splitFormat(
  format: string,
  ctx: NumberContext,
): { prefix: string; suffix: string; pad: number } {
  const fill = (s: string) =>
    s
      .replaceAll("{AAAA}", String(ctx.year))
      .replaceAll("{AA}", String(ctx.year % 100).padStart(2, "0"))
      .replaceAll("{MM}", String(ctx.month + 1).padStart(2, "0"));

  const seq = format.match(/\{N+\}/);
  if (!seq) return { prefix: fill(format), suffix: "", pad: 0 };

  const at = format.indexOf(seq[0]);
  return {
    prefix: fill(format.slice(0, at)),
    suffix: fill(format.slice(at + seq[0].length)),
    pad: seq[0].length - 2,
  };
}

/** Assemble un numéro à partir du modèle et d'un rang. */
export function buildInvoiceNumber(
  format: string,
  ctx: NumberContext,
  seq: number,
): string {
  const { prefix, suffix, pad } = splitFormat(format, ctx);
  if (pad === 0) return `${prefix}${suffix}`;
  return `${prefix}${String(seq).padStart(pad, "0")}${suffix}`;
}

/**
 * Rang suivant pour une partie fixe donnée : on relit les numéros déjà
 * attribués et on repart du plus grand + 1.
 */
export function nextSeq(
  existing: (string | null | undefined)[],
  prefix: string,
  suffix: string,
): number {
  let max = 0;
  for (const raw of existing) {
    const n = (raw ?? "").trim();
    if (!n || !n.startsWith(prefix) || !n.endsWith(suffix)) continue;
    const mid = n.slice(prefix.length, n.length - suffix.length);
    if (!/^\d+$/.test(mid)) continue;
    max = Math.max(max, parseInt(mid, 10));
  }
  return max + 1;
}

/** Numéro qui serait attribué maintenant (aperçu dans les Paramètres). */
export function previewInvoiceNumber(
  format: string,
  ctx: NumberContext,
): string {
  return buildInvoiceNumber(format || DEFAULT_INVOICE_FORMAT, ctx, 1);
}

/**
 * Clé du compteur persistant : le modèle avec sa partie fixe résolue et le
 * compteur laissé en {N} (« 2026-{N} »). Deux périodes qui partagent la même
 * partie fixe partagent donc la même série.
 */
export function counterScope(format: string, ctx: NumberContext): string {
  const { prefix, suffix } = splitFormat(format, ctx);
  return `${prefix}{N}${suffix}`;
}
