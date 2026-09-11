import { MONTHS } from "./constants";
import type { Expense, Invoice } from "./types";

/* ============================================================
 *  PÉRIODES (mois / année / fourchette) — helpers partagés
 * ============================================================ */

export const MONTHS_SHORT = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];

export type PeriodMode = "month" | "year" | "range" | "all";

export interface Period {
  mode: PeriodMode;
  year: number;
  month: number; // 0-11
  from: string; // "YYYY-MM"
  to: string; // "YYYY-MM"
}

/** Une période élémentaire : une année + un mois (0-11). */
export interface YM {
  y: number;
  m: number;
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const MONTHS_NORM = MONTHS.map(norm);

/** "février" | "fevrier" | "02" -> 1. Renvoie null si non reconnu. */
export function monthIndex(name: string | null | undefined): number | null {
  if (name == null || name === "") return null;
  const raw = String(name).trim();
  if (/^\d{1,2}$/.test(raw)) {
    const n = parseInt(raw, 10);
    return n >= 1 && n <= 12 ? n - 1 : null;
  }
  const n = norm(raw);
  let i = MONTHS_NORM.indexOf(n);
  if (i < 0 && n.length >= 3)
    i = MONTHS_NORM.findIndex((m) => m.startsWith(n));
  return i < 0 ? null : i;
}

function parseDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Période comptable d'une ligne : on privilégie la période saisie
 * (mois / année de facturation), puis on retombe sur les dates
 * disponibles (paiement, émission, création).
 */
export function resolvePeriod(
  year: number | null | undefined,
  month: string | null | undefined,
  ...dates: (string | null | undefined)[]
): YM {
  const mi = monthIndex(month);
  let d: Date | null = null;
  for (const iso of dates) {
    d = parseDate(iso);
    if (d) break;
  }
  return {
    y: year ?? d?.getFullYear() ?? new Date().getFullYear(),
    m: mi ?? d?.getMonth() ?? 0,
  };
}

export function invoicePeriod(inv: Invoice): YM {
  return resolvePeriod(
    inv.billing_year,
    inv.billing_month,
    inv.payment_date,
    inv.issue_date,
    inv.created_at,
  );
}

export function expensePeriod(e: Expense): YM {
  return resolvePeriod(
    e.period_year,
    e.period_month,
    e.expense_date,
    e.created_at,
  );
}

/** Index absolu du mois, pour comparer / trier facilement. */
export const ymKey = (ym: YM): number => ym.y * 12 + ym.m;
export const fromKey = (k: number): YM => ({
  y: Math.floor(k / 12),
  m: ((k % 12) + 12) % 12,
});

/** "2026-09" <-> { y: 2026, m: 8 } (format des <input type="month">) */
export function toMonthInput(ym: YM): string {
  return `${ym.y}-${String(ym.m + 1).padStart(2, "0")}`;
}
export function parseMonthInput(v: string | null | undefined): YM | null {
  const m = /^(\d{4})-(\d{2})$/.exec(String(v ?? ""));
  if (!m) return null;
  const mm = parseInt(m[2], 10);
  if (mm < 1 || mm > 12) return null;
  return { y: parseInt(m[1], 10), m: mm - 1 };
}

/** Bornes (clés absolues) d'une fourchette, toujours dans l'ordre. */
export function rangeKeys(p: Period): [number, number] {
  const a = parseMonthInput(p.from) ?? { y: p.year, m: 0 };
  const b = parseMonthInput(p.to) ?? { y: p.year, m: 11 };
  const ka = ymKey(a);
  const kb = ymKey(b);
  return ka <= kb ? [ka, kb] : [kb, ka];
}

export function inPeriod(p: Period, ym: YM): boolean {
  switch (p.mode) {
    case "all":
      return true;
    case "month":
      return ym.y === p.year && ym.m === p.month;
    case "year":
      return ym.y === p.year;
    case "range": {
      const [a, b] = rangeKeys(p);
      const k = ymKey(ym);
      return k >= a && k <= b;
    }
  }
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Libellé affiché dans le sélecteur de période. */
export function periodLabel(p: Period): string {
  switch (p.mode) {
    case "month":
      return `${cap(MONTHS[p.month])} ${p.year}`;
    case "year":
      return `Année ${p.year}`;
    case "range": {
      const [a, b] = rangeKeys(p).map(fromKey);
      if (a.y === b.y && a.m === b.m) return `${cap(MONTHS[a.m])} ${a.y}`;
      // Même année : on ne répète pas l'année (« mai → sept. 2026 »).
      if (a.y === b.y)
        return `${MONTHS_SHORT[a.m]} → ${MONTHS_SHORT[b.m]} ${b.y}`;
      return `${MONTHS_SHORT[a.m]} ${a.y} → ${MONTHS_SHORT[b.m]} ${b.y}`;
    }
    case "all":
      return "Toutes les périodes";
  }
}

/** Suffixe de nom de fichier pour l'export CSV. */
export function periodSlug(p: Period): string {
  switch (p.mode) {
    case "month":
      return toMonthInput({ y: p.year, m: p.month });
    case "year":
      return String(p.year);
    case "range": {
      const [a, b] = rangeKeys(p).map(fromKey);
      return `${toMonthInput(a)}_${toMonthInput(b)}`;
    }
    case "all":
      return "tout";
  }
}

/** Nombre de mois couverts par la sélection (0 = illimité). */
export function periodSpan(p: Period): number {
  switch (p.mode) {
    case "month":
      return 1;
    case "year":
      return 12;
    case "range": {
      const [a, b] = rangeKeys(p);
      return b - a + 1;
    }
    case "all":
      return 0;
  }
}

/** Flèche précédent / suivant : décale la sélection d'un « cran ». */
export function shiftPeriod(p: Period, dir: 1 | -1): Period {
  switch (p.mode) {
    case "month": {
      const k = ymKey({ y: p.year, m: p.month }) + dir;
      const ym = fromKey(k);
      return { ...p, year: ym.y, month: ym.m };
    }
    case "year":
      return { ...p, year: p.year + dir };
    case "range": {
      const [a, b] = rangeKeys(p);
      const span = b - a + 1;
      return {
        ...p,
        from: toMonthInput(fromKey(a + dir * span)),
        to: toMonthInput(fromKey(b + dir * span)),
      };
    }
    case "all":
      return p;
  }
}

/** Période précédente équivalente (pour la comparaison « vs période précédente »). */
export function previousPeriod(p: Period): Period | null {
  return p.mode === "all" ? null : shiftPeriod(p, -1);
}

/** Tous les mois d'une fourchette de clés (borné, pour l'affichage). */
export function monthsBetween(a: number, b: number, max = 36): YM[] {
  const out: YM[] = [];
  for (let k = a; k <= b && out.length < max; k++) out.push(fromKey(k));
  return out;
}

export interface Bucket {
  key: string;
  label: string;
  y: number;
  m: number | null; // null = agrégat annuel
}

/**
 * Découpage de l'axe du graphique selon la sélection :
 * - mois / année : les 12 mois de l'année (contexte + clic direct) ;
 * - fourchette : mois de la fourchette, ou années si > 36 mois ;
 * - tout : une barre par année présente dans les données.
 */
export function chartBuckets(p: Period, years: number[]): Bucket[] {
  const monthBuckets = (list: YM[]): Bucket[] =>
    list.map((ym) => ({
      key: toMonthInput(ym),
      label: MONTHS_SHORT[ym.m],
      y: ym.y,
      m: ym.m,
    }));

  if (p.mode === "month" || p.mode === "year") {
    const y = p.year;
    return monthBuckets(Array.from({ length: 12 }, (_, m) => ({ y, m })));
  }

  if (p.mode === "range") {
    const [a, b] = rangeKeys(p);
    if (b - a + 1 <= 36) {
      const list = monthsBetween(a, b);
      const multiYear = fromKey(a).y !== fromKey(b).y;
      return monthBuckets(list).map((bk) =>
        multiYear && bk.m === 0
          ? { ...bk, label: `${MONTHS_SHORT[bk.m]} ${String(bk.y).slice(2)}` }
          : bk,
      );
    }
    const ya = fromKey(a).y;
    const yb = fromKey(b).y;
    return Array.from({ length: yb - ya + 1 }, (_, i) => ({
      key: String(ya + i),
      label: String(ya + i),
      y: ya + i,
      m: null,
    }));
  }

  // mode "all"
  const ys = [...years].sort((a, b) => a - b);
  if (ys.length <= 1) {
    const y = ys[0] ?? new Date().getFullYear();
    return monthBuckets(Array.from({ length: 12 }, (_, m) => ({ y, m })));
  }
  return ys.map((y) => ({ key: String(y), label: String(y), y, m: null }));
}

/* ---------- Sérialisation dans l'URL (partage / rechargement) ---------- */

export function periodToParams(p: Period): string {
  const q = new URLSearchParams();
  q.set("mode", p.mode);
  if (p.mode === "month") {
    q.set("month", toMonthInput({ y: p.year, m: p.month }));
  } else if (p.mode === "year") {
    q.set("year", String(p.year));
  } else if (p.mode === "range") {
    q.set("from", p.from);
    q.set("to", p.to);
  }
  return q.toString();
}

export function periodFromParams(
  params: {
    mode?: string;
    month?: string;
    year?: string;
    from?: string;
    to?: string;
  },
  fallbackYear: number,
  fallbackMonth: number,
): Period {
  const base: Period = {
    mode: "month",
    year: fallbackYear,
    month: fallbackMonth,
    from: toMonthInput({ y: fallbackYear, m: 0 }),
    to: toMonthInput({ y: fallbackYear, m: fallbackMonth }),
  };

  const mode = params.mode;
  const ym = parseMonthInput(params.month);
  const from = parseMonthInput(params.from);
  const to = parseMonthInput(params.to);
  const year =
    params.year && /^\d{4}$/.test(params.year)
      ? parseInt(params.year, 10)
      : null;

  if (mode === "range" && from && to)
    return { ...base, mode: "range", from: params.from!, to: params.to! };
  if (mode === "all") return { ...base, mode: "all" };
  if (mode === "year" || (!mode && year))
    return { ...base, mode: "year", year: year ?? fallbackYear };
  if (mode === "month" && ym)
    return { ...base, mode: "month", year: ym.y, month: ym.m };
  // Ancien lien ?year=all
  if (params.year === "all") return { ...base, mode: "all" };
  return base;
}
