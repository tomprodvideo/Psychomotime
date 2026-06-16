import type { Invoice, Settings } from "./types";

export interface InvoiceCalc {
  retrocession: number;
  afterRetro: number;
  urssaf: number;
  net: number;
}

/**
 * Calcule rétrocession / URSSAF / net à partir du revenu brut,
 * selon les paramètres en vigueur. Utilisé en aperçu dans le
 * formulaire avant enregistrement.
 */
export function computeInvoice(
  revenueGross: number,
  settings: Pick<
    Settings,
    "retrocession_rate" | "urssaf_rate" | "charge_mode"
  >,
  overrides?: { retrocession?: number; urssaf?: number },
): InvoiceCalc {
  const gross = revenueGross || 0;

  const retrocession =
    overrides?.retrocession ??
    (settings.charge_mode === "loyer"
      ? 0
      : round2(gross * settings.retrocession_rate));

  const afterRetro = round2(gross - retrocession);

  const urssaf =
    overrides?.urssaf ?? round2(afterRetro * settings.urssaf_rate);

  const net = round2(afterRetro - urssaf);

  return { retrocession, afterRetro, urssaf, net };
}

export interface Totals {
  brut: number;
  brutPaye: number;
  retrocession: number;
  brutMoinsRetro: number;
  urssaf: number;
  net: number;
  count: number;
}

export function sumTotals(invoices: Invoice[]): Totals {
  return invoices.reduce<Totals>(
    (acc, inv) => {
      acc.brut += inv.revenue_gross || 0;
      acc.brutPaye += inv.revenue_gross_paid || 0;
      acc.retrocession += inv.retrocession_amount || 0;
      acc.brutMoinsRetro += inv.after_retro || 0;
      acc.urssaf += inv.urssaf_amount || 0;
      acc.net += inv.net_revenue || 0;
      acc.count += 1;
      return acc;
    },
    {
      brut: 0,
      brutPaye: 0,
      retrocession: 0,
      brutMoinsRetro: 0,
      urssaf: 0,
      net: 0,
      count: 0,
    },
  );
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
