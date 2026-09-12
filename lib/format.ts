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

/** Date ISO (yyyy-mm-dd) -> "12/06/2026" */
export function frDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR").format(d);
}

/**
 * @deprecated Cette fonction lit l'HORLOGE. Elle rend donc l'âge du jour où on
 * l'appelle, jamais l'âge à la date qui compte — celle de la passation. Un
 * bilan passé en février et réimprimé en septembre affichait sept mois de trop,
 * sur un document dont toute la lecture repose sur des normes par classe d'âge.
 *
 * Employer `formatAgeAt(naissance, date)` de `lib/age.ts`, qui EXIGE la date de
 * référence : oublier de la passer doit être impossible, pas silencieux.
 *
 * Plus aucun appelant au 2026-09-12. Conservée le temps de vérifier qu'aucun
 * écran de la v1 ne s'y adosse encore.
 */
export function ageFromBirth(iso: string | null | undefined): string {
  if (!iso) return "";
  const birth = new Date(iso + "T00:00:00");
  if (isNaN(birth.getTime())) return "";
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years <= 0) return `${months} mois`;
  return `${years} ans ${months} mois`;
}
