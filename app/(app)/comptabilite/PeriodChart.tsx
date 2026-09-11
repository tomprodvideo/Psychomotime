"use client";

import { ChartColumn } from "lucide-react";
import type { Expense, Invoice } from "@/lib/types";
import { euro } from "@/lib/format";
import { MONTHS } from "@/lib/constants";
import {
  chartBuckets,
  expensePeriod,
  invoicePeriod,
  inPeriod,
  type Bucket,
  type Period,
} from "@/lib/period";
import { summarize, type Summary } from "./summary";

interface Bar extends Bucket {
  summary: Summary;
  selected: boolean;
}

/**
 * Barres empilées (net / URSSAF / rétro / loyers) par mois — ou par année
 * si la sélection est très large. Un clic sur une barre zoome dessus.
 */
export default function PeriodChart({
  period,
  invoices,
  expenses,
  years,
  showRetro,
  onPick,
}: {
  period: Period;
  invoices: Invoice[]; // toutes les factures (non filtrées)
  expenses: Expense[];
  years: number[];
  showRetro: boolean;
  onPick: (b: Bucket) => void;
}) {
  const buckets = chartBuckets(period, years);

  const bars: Bar[] = buckets.map((b) => {
    const inv = invoices.filter((i) => {
      const p = invoicePeriod(i);
      return b.m == null ? p.y === b.y : p.y === b.y && p.m === b.m;
    });
    const exp = expenses.filter((e) => {
      const p = expensePeriod(e);
      return b.m == null ? p.y === b.y : p.y === b.y && p.m === b.m;
    });
    return {
      ...b,
      summary: summarize(inv, exp),
      selected:
        b.m == null
          ? // barre annuelle : sélectionnée si un mois de l'année l'est
            Array.from({ length: 12 }, (_, m) => m).some((m) =>
              inPeriod(period, { y: b.y, m }),
            )
          : inPeriod(period, { y: b.y, m: b.m }),
    };
  });

  const max = Math.max(1, ...bars.map((b) => b.summary.brut));
  const anyData = bars.some((b) => b.summary.brut > 0);
  // Si tout l'axe est dans la sélection, inutile de surligner chaque barre.
  const allSelected = bars.every((b) => b.selected);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-semibold text-slate-800 flex items-center gap-2">
          <ChartColumn className="h-4 w-4 text-brand-600" />
          Évolution
        </h2>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
          <Legend cls="bg-brand-500" label="Net" />
          <Legend cls="bg-amber-300" label="URSSAF" />
          {showRetro && <Legend cls="bg-rose-300" label="Rétro" />}
          <Legend cls="bg-violet-300" label="Loyers" />
        </div>
      </div>
      <p className="text-xs text-slate-400 mb-4">
        Cliquez sur une barre pour filtrer sur cette période.
      </p>

      {!anyData ? (
        <p className="text-sm text-slate-400 text-center py-10">
          Aucune donnée à afficher sur cette période.
        </p>
      ) : (
        <div className="flex items-end gap-1 sm:gap-1.5 h-44">
          {bars.map((b) => {
            const s = b.summary;
            const highlight = b.selected && !allSelected;
            const h = (s.brut / max) * 100;
            const seg = (v: number) => (s.brut > 0 ? (v / s.brut) * 100 : 0);
            const title = `${
              b.m == null ? b.y : `${MONTHS[b.m]} ${b.y}`
            }\nBrut : ${euro(s.brut)}\nURSSAF : ${euro(
              s.urssaf,
            )}\nLoyers : ${euro(s.charges)}\nNet après charges : ${euro(
              s.netApresCharges,
            )}`;

            return (
              <button
                key={b.key}
                onClick={() => onPick(b)}
                title={title}
                className="group flex-1 min-w-0 h-full flex flex-col justify-end items-center gap-1.5"
              >
                <span
                  className={`text-[10px] tabular-nums transition ${
                    highlight
                      ? "text-brand-700 font-semibold"
                      : "text-slate-400 opacity-0 group-hover:opacity-100"
                  }`}
                >
                  {s.brut > 0 ? Math.round(s.netApresCharges) : ""}
                </span>
                <div
                  className={`w-full rounded-t-md overflow-hidden flex flex-col-reverse transition-all ${
                    highlight ? "ring-2 ring-brand-400 ring-offset-1" : ""
                  } ${b.selected ? "" : "opacity-50 group-hover:opacity-100"}`}
                  style={{ height: `${Math.max(h, s.brut > 0 ? 3 : 0)}%` }}
                >
                  <div
                    className="bg-brand-500 w-full"
                    style={{ height: `${seg(Math.max(0, s.net))}%` }}
                  />
                  <div
                    className="bg-amber-300 w-full"
                    style={{ height: `${seg(s.urssaf)}%` }}
                  />
                  {showRetro && (
                    <div
                      className="bg-rose-300 w-full"
                      style={{ height: `${seg(s.retrocession)}%` }}
                    />
                  )}
                  <div
                    className="bg-violet-300 w-full"
                    style={{ height: `${seg(s.charges)}%` }}
                  />
                </div>
                <span
                  className={`text-[10px] truncate w-full text-center ${
                    highlight
                      ? "text-brand-700 font-semibold"
                      : "text-slate-400"
                  }`}
                >
                  {b.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`h-2 w-2 rounded-full ${cls}`} />
      {label}
    </span>
  );
}
