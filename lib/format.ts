import { dateCivile } from "@/lib/dateCivile";

export function euro(n: number | null | undefined): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(n ?? 0);
}

export function pct(rate: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "percent",
    maximumFractionDigits: 2,
  }).format(rate ?? 0);
}

/**
 * Un jour civil « AAAA-MM-JJ » → « 12/06/2026 ».
 *
 * UN JOUR, JAMAIS UN INSTANT. Cette fonction acceptait aussi un horodatage, et
 * le formatait dans le fuseau du PROCESSUS : l'heure d'expiration d'un lien, la
 * date d'ajout d'un document, s'affichaient au jour du serveur. Une chaîne
 * horodatée ne rend désormais RIEN — une date absente se voit, une date fausse
 * passe inaperçue, comme pour l'âge (`lib/age.ts`). Pour un instant :
 * `frJourDe(instant, fuseau du cabinet)`.
 *
 * Le jour est recomposé tel quel, sans `Date` ni `Intl` : aucun fuseau ne peut
 * le déplacer.
 */
export function frDate(iso: string | null | undefined): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [annee, mois, jour] = iso.split("-");
  return `${jour}/${mois}/${annee}`;
}

/**
 * Le jour d'un INSTANT, dans le fuseau du cabinet → « 12/06/2026 ».
 *
 * `frDate(x_at.slice(0, 10))` rendait le jour UTC : entre minuit et deux heures
 * du matin à Paris, la veille. Un instant illisible ne rend rien.
 */
export function frJourDe(
  instant: string | Date | null | undefined,
  fuseau: string | null | undefined,
): string {
  if (!instant) return "";
  const d = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(d.getTime())) return "";
  return frDate(dateCivile(d, fuseau));
}
