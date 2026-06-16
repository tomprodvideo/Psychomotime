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
