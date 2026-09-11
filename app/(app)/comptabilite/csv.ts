import type { Expense, Invoice } from "@/lib/types";
import { MONTHS } from "@/lib/constants";
import { frDate } from "@/lib/format";
import {
  invoicePeriod,
  expensePeriod,
  periodLabel,
  periodSlug,
  ymKey,
  type Period,
} from "@/lib/period";
import {
  amountDue,
  paymentStatus,
  summarize,
  PAYMENT_LABELS,
} from "./summary";

type Cell = string | number | null | undefined;

const fmt = (n: number | null | undefined) =>
  (n ?? 0).toFixed(2).replace(".", ",");

const esc = (v: Cell) => {
  const s = String(v ?? "");
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const line = (cells: Cell[]) => cells.map(esc).join(";");

/**
 * Export de TOUTE la sélection : récapitulatif, détail des factures,
 * loyers & charges, et totaux par mois. Séparateur « ; » + BOM pour
 * qu'Excel (FR) ouvre le fichier proprement.
 */
export function buildCsv({
  period,
  invoices,
  expenses,
  extraCharges = 0,
  showRetro,
}: {
  period: Period;
  invoices: Invoice[];
  expenses: Expense[];
  /** Dépenses récurrentes ramenées à la période. */
  extraCharges?: number;
  showRetro: boolean;
}): string {
  const s = summarize(invoices, expenses, extraCharges);
  const rows: string[] = [];

  /* --- Récapitulatif --- */
  rows.push(line(["COMPTABILITÉ — " + periodLabel(period)]));
  rows.push(
    line(["Exporté le", new Date().toLocaleDateString("fr-FR")]),
  );
  rows.push("");
  rows.push(line(["RÉCAPITULATIF", "Montant (€)"]));
  rows.push(line(["Nombre de factures", s.count]));
  rows.push(line(["Factures payées", s.countPayees]));
  rows.push(line(["Factures non payées / partielles", s.countImpayees]));
  rows.push(line(["Total brut", fmt(s.brut)]));
  rows.push(line(["Brut encaissé", fmt(s.brutPaye)]));
  rows.push(line(["Reste à encaisser", fmt(s.restant)]));
  if (showRetro) {
    rows.push(line(["Rétrocession", fmt(s.retrocession)]));
    rows.push(line(["Brut − rétrocession", fmt(s.brutMoinsRetro)]));
  }
  rows.push(line(["URSSAF", fmt(s.urssaf)]));
  rows.push(line(["Revenu net", fmt(s.net)]));
  rows.push(line(["Charges", fmt(s.charges)]));
  rows.push(line(["Net après charges", fmt(s.netApresCharges)]));

  /* --- Détail des factures --- */
  rows.push("");
  rows.push(line(["FACTURES"]));
  rows.push(
    line([
      "Prénom / Nom",
      "N° facture",
      "Mois",
      "Année",
      "Statut paiement",
      "PCO",
      "Brut",
      "Brut payé",
      "Reste dû",
      "Moyen paiement",
      "Date paiement",
      ...(showRetro ? ["Rétrocession", "Après rétro"] : []),
      "URSSAF",
      "Net",
    ]),
  );

  const sorted = [...invoices].sort((a, b) => {
    const d = ymKey(invoicePeriod(a)) - ymKey(invoicePeriod(b));
    if (d !== 0) return d;
    return (a.patient_name ?? "").localeCompare(b.patient_name ?? "", "fr");
  });

  for (const i of sorted) {
    const p = invoicePeriod(i);
    rows.push(
      line([
        i.patient_name ?? "",
        i.invoice_number ?? "",
        i.billing_month ?? MONTHS[p.m],
        i.billing_year ?? p.y,
        PAYMENT_LABELS[paymentStatus(i)],
        i.has_pco ? "oui" : "non",
        fmt(i.revenue_gross),
        fmt(i.revenue_gross_paid),
        fmt(amountDue(i)),
        i.payment_method ?? "",
        frDate(i.payment_date),
        ...(showRetro
          ? [fmt(i.retrocession_amount), fmt(i.after_retro)]
          : []),
        fmt(i.urssaf_amount),
        fmt(i.net_revenue),
      ]),
    );
  }

  rows.push(
    line([
      "TOTAL",
      "",
      "",
      "",
      "",
      "",
      fmt(s.brut),
      fmt(s.brutPaye),
      fmt(s.restant),
      "",
      "",
      ...(showRetro ? [fmt(s.retrocession), fmt(s.brutMoinsRetro)] : []),
      fmt(s.urssaf),
      fmt(s.net),
    ]),
  );

  /* --- Charges --- */
  rows.push("");
  rows.push(line(["LOYERS & CHARGES"]));
  rows.push(line(["Intitulé", "Type", "Mois", "Année", "Date", "Montant"]));
  const sortedExp = [...expenses].sort(
    (a, b) => ymKey(expensePeriod(a)) - ymKey(expensePeriod(b)),
  );
  for (const e of sortedExp) {
    const p = expensePeriod(e);
    rows.push(
      line([
        e.label ?? "",
        e.type ?? "",
        e.period_month ?? MONTHS[p.m],
        e.period_year ?? p.y,
        frDate(e.expense_date),
        fmt(e.amount),
      ]),
    );
  }
  rows.push(line(["TOTAL", "", "", "", "", fmt(s.charges)]));

  /* --- Totaux par mois --- */
  rows.push("");
  rows.push(line(["TOTAUX PAR MOIS"]));
  rows.push(
    line([
      "Mois",
      "Factures",
      "Brut",
      "Brut encaissé",
      ...(showRetro ? ["Rétrocession"] : []),
      "URSSAF",
      "Net",
      "Charges",
      "Net après charges",
    ]),
  );

  const keys = new Set<number>();
  for (const i of invoices) keys.add(ymKey(invoicePeriod(i)));
  for (const e of expenses) keys.add(ymKey(expensePeriod(e)));

  for (const k of [...keys].sort((a, b) => a - b)) {
    const inv = invoices.filter((i) => ymKey(invoicePeriod(i)) === k);
    const exp = expenses.filter((e) => ymKey(expensePeriod(e)) === k);
    const m = summarize(inv, exp);
    const y = Math.floor(k / 12);
    const mi = ((k % 12) + 12) % 12;
    rows.push(
      line([
        `${MONTHS[mi]} ${y}`,
        m.count,
        fmt(m.brut),
        fmt(m.brutPaye),
        ...(showRetro ? [fmt(m.retrocession)] : []),
        fmt(m.urssaf),
        fmt(m.net),
        fmt(m.charges),
        fmt(m.netApresCharges),
      ]),
    );
  }

  return "﻿" + rows.join("\r\n");
}

export function downloadCsv(period: Period, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `comptabilite-${periodSlug(period)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
