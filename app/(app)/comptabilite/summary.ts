import type { Expense, Invoice } from "@/lib/types";
import { round2 } from "@/lib/calc";

/* ============================================================
 *  Agrégats d'une sélection (période choisie)
 * ============================================================ */

export interface Summary {
  brut: number;
  brutPaye: number;
  restant: number; // brut non encaissé
  retrocession: number;
  brutMoinsRetro: number;
  urssaf: number;
  net: number;
  charges: number; // loyers & charges
  netApresCharges: number;
  count: number;
  countPayees: number;
  countImpayees: number;
}

export function summarize(
  invoices: Invoice[],
  expenses: Expense[],
): Summary {
  const s: Summary = {
    brut: 0,
    brutPaye: 0,
    restant: 0,
    retrocession: 0,
    brutMoinsRetro: 0,
    urssaf: 0,
    net: 0,
    charges: 0,
    netApresCharges: 0,
    count: 0,
    countPayees: 0,
    countImpayees: 0,
  };

  for (const i of invoices) {
    s.brut += i.revenue_gross || 0;
    s.brutPaye += i.revenue_gross_paid || 0;
    s.retrocession += i.retrocession_amount || 0;
    s.brutMoinsRetro += i.after_retro || 0;
    s.urssaf += i.urssaf_amount || 0;
    s.net += i.net_revenue || 0;
    s.count += 1;
    const st = paymentStatus(i);
    if (st === "paid") s.countPayees += 1;
    else s.countImpayees += 1;
  }
  for (const e of expenses) s.charges += e.amount || 0;

  s.brut = round2(s.brut);
  s.brutPaye = round2(s.brutPaye);
  s.retrocession = round2(s.retrocession);
  s.brutMoinsRetro = round2(s.brutMoinsRetro);
  s.urssaf = round2(s.urssaf);
  s.net = round2(s.net);
  s.charges = round2(s.charges);
  s.restant = round2(Math.max(0, s.brut - s.brutPaye));
  s.netApresCharges = round2(s.net - s.charges);
  return s;
}

/* ---------- Statut de paiement d'une facture ---------- */

export type PaymentStatus = "paid" | "partial" | "unpaid";

export function paymentStatus(inv: Invoice): PaymentStatus {
  const gross = inv.revenue_gross || 0;
  const paid = inv.revenue_gross_paid || 0;
  if (gross <= 0) return paid > 0 ? "paid" : "unpaid";
  if (paid >= gross - 0.005) return "paid";
  return paid > 0 ? "partial" : "unpaid";
}

export function amountDue(inv: Invoice): number {
  return round2(
    Math.max(0, (inv.revenue_gross || 0) - (inv.revenue_gross_paid || 0)),
  );
}

export const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  paid: "Payé",
  partial: "Partiel",
  unpaid: "Non payé",
};

/** Classes Tailwind du statut : pastille de couleur + badge texte. */
export const PAYMENT_STYLES: Record<
  PaymentStatus,
  { badge: string; dot: string }
> = {
  paid: { badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  partial: { badge: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  unpaid: { badge: "bg-rose-100 text-rose-700", dot: "bg-rose-500" },
};
