"use client";

import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import type { Expense, Invoice, PatientContact, Settings } from "@/lib/types";
import {
  expensePeriod,
  inPeriod,
  periodFromParams,
  periodLabel,
  periodToParams,
  invoicePeriod,
  previousPeriod,
  type Bucket,
  type Period,
} from "@/lib/period";
import { PageHeader } from "@/components/ui";
import PeriodPicker from "./PeriodPicker";
import SummaryCards from "./SummaryCards";
import PeriodChart from "./PeriodChart";
import ComptaClient, { type PayFilter } from "./ComptaClient";
import LoyersClient from "./LoyersClient";
import { summarize } from "./summary";
import { buildCsv, downloadCsv } from "./csv";

type PatientLite = PatientContact;

export default function ComptabiliteView({
  invoices,
  expenses,
  patients,
  settings,
  initialParams,
}: {
  invoices: Invoice[];
  expenses: Expense[];
  patients: PatientLite[];
  settings: Pick<Settings, "retrocession_rate" | "urssaf_rate" | "charge_mode">;
  initialParams: {
    mode?: string;
    month?: string;
    year?: string;
    from?: string;
    to?: string;
  };
}) {
  const now = new Date();
  const [period, setPeriod] = useState<Period>(() =>
    periodFromParams(initialParams, now.getFullYear(), now.getMonth()),
  );
  const [payFilter, setPayFilter] = useState<PayFilter>("all");

  // On garde la sélection dans l'URL (rechargement / partage) sans
  // relancer de navigation : la page reste instantanée au clic de flèche.
  useEffect(() => {
    const qs = periodToParams(period);
    window.history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
  }, [period]);

  const showRetro = settings.charge_mode !== "loyer";

  /* ---- Périodes précalculées (évite de recalculer à chaque rendu) ---- */
  const invWithPeriod = useMemo(
    () => invoices.map((i) => ({ inv: i, p: invoicePeriod(i) })),
    [invoices],
  );
  const expWithPeriod = useMemo(
    () => expenses.map((e) => ({ exp: e, p: expensePeriod(e) })),
    [expenses],
  );

  const years = useMemo(() => {
    const set = new Set<number>([now.getFullYear()]);
    for (const { p } of invWithPeriod) set.add(p.y);
    for (const { p } of expWithPeriod) set.add(p.y);
    return [...set].sort((a, b) => a - b);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invWithPeriod, expWithPeriod]);

  const selInvoices = useMemo(
    () => invWithPeriod.filter((x) => inPeriod(period, x.p)).map((x) => x.inv),
    [invWithPeriod, period],
  );
  const selExpenses = useMemo(
    () => expWithPeriod.filter((x) => inPeriod(period, x.p)).map((x) => x.exp),
    [expWithPeriod, period],
  );

  const summary = useMemo(
    () => summarize(selInvoices, selExpenses),
    [selInvoices, selExpenses],
  );

  const prevSummary = useMemo(() => {
    const prev = previousPeriod(period);
    if (!prev) return null;
    return summarize(
      invWithPeriod.filter((x) => inPeriod(prev, x.p)).map((x) => x.inv),
      expWithPeriod.filter((x) => inPeriod(prev, x.p)).map((x) => x.exp),
    );
  }, [period, invWithPeriod, expWithPeriod]);

  /* ---- Clic sur une barre du graphique ---- */
  function pickBucket(b: Bucket) {
    if (b.m == null) {
      setPeriod((p) => ({ ...p, mode: "year", year: b.y }));
    } else {
      setPeriod((p) => ({ ...p, mode: "month", year: b.y, month: b.m! }));
    }
  }

  function handleExport() {
    downloadCsv(
      period,
      buildCsv({
        period,
        invoices: selInvoices,
        expenses: selExpenses,
        showRetro,
      }),
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Comptabilité"
        subtitle={`${periodLabel(period)} · ${
          showRetro ? "rétrocession" : "loyer"
        } / URSSAF / net calculés automatiquement`}
      >
        <button
          onClick={handleExport}
          disabled={selInvoices.length === 0 && selExpenses.length === 0}
          title="Exporter toute la sélection au format CSV"
          className="inline-flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          Exporter la sélection
        </button>
      </PageHeader>

      <PeriodPicker
        period={period}
        onChange={(p) => setPeriod(p)}
        invoiceCount={selInvoices.length}
      />

      <SummaryCards
        summary={summary}
        previous={prevSummary}
        chargeMode={settings.charge_mode}
        onShowUnpaid={() => setPayFilter("unpaid")}
      />

      <div className="mb-5">
        <PeriodChart
          period={period}
          invoices={invoices}
          expenses={expenses}
          years={years}
          showRetro={showRetro}
          onPick={pickBucket}
        />
      </div>

      <ComptaClient
        invoices={selInvoices}
        patients={patients}
        settings={settings}
        defaultYear={period.mode === "all" ? now.getFullYear() : period.year}
        defaultMonth={period.mode === "month" ? period.month : now.getMonth()}
        payFilter={payFilter}
        onPayFilter={setPayFilter}
      />

      <div className="mt-5 max-w-2xl">
        <LoyersClient
          expenses={selExpenses}
          defaultYear={period.mode === "all" ? now.getFullYear() : period.year}
          defaultMonth={period.mode === "month" ? period.month : now.getMonth()}
          periodLabel={periodLabel(period)}
        />
      </div>

      <p className="mt-4 text-xs text-slate-400">
        Période analysée :{" "}
        <strong className="text-slate-500">{periodLabel(period)}</strong>{" "}
        ·
        l&apos;export CSV reprend exactement cette sélection (récapitulatif,
        factures, loyers &amp; charges et totaux par mois).
      </p>
    </div>
  );
}
