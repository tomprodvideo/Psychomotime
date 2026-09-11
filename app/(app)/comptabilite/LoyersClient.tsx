"use client";

import { useState, useTransition } from "react";
import { House, Plus, Trash2, X } from "lucide-react";
import type { Expense } from "@/lib/types";
import { euro, frDate } from "@/lib/format";
import { MONTHS } from "@/lib/constants";
import { expensePeriod, ymKey, MONTHS_SHORT } from "@/lib/period";
import { saveExpense, deleteExpense } from "./actions";

export default function LoyersClient({
  expenses,
  defaultYear,
  defaultMonth,
  periodLabel,
}: {
  expenses: Expense[];
  defaultYear: number;
  defaultMonth: number;
  periodLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const total = expenses.reduce((s, e) => s + (e.amount || 0), 0);

  const sorted = [...expenses].sort(
    (a, b) => ymKey(expensePeriod(b)) - ymKey(expensePeriod(a)),
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      await saveExpense(fd);
      setOpen(false);
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <span className="h-9 w-9 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
            <House className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-semibold text-slate-800">Loyers &amp; charges</h2>
            <p className="text-xs text-slate-500">
              {periodLabel} · total{" "}
              <strong className="text-violet-600">{euro(total)}</strong>
            </p>
          </div>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50 px-3 py-1.5 rounded-lg"
        >
          <Plus className="h-4 w-4" />
          Ajouter
        </button>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-slate-400 px-5 py-6 text-center">
          Aucun loyer ou charge enregistré sur cette période.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {sorted.map((e) => {
            const p = expensePeriod(e);
            return (
              <li
                key={e.id}
                className="flex items-center justify-between px-5 py-3 text-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="shrink-0 text-[11px] font-medium text-violet-600 bg-violet-50 rounded-md px-2 py-1 tabular-nums">
                    {MONTHS_SHORT[p.m]} {String(p.y).slice(2)}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-700 first-letter:uppercase truncate">
                      {e.label || e.type}
                    </p>
                    <p className="text-xs text-slate-400">
                      {e.expense_date ? frDate(e.expense_date) : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-semibold text-violet-600 tabular-nums">
                    {euro(e.amount)}
                  </span>
                  <button
                    onClick={() => {
                      if (!confirm("Supprimer ?")) return;
                      const fd = new FormData();
                      fd.set("id", e.id);
                      start(() => deleteExpense(fd));
                    }}
                    disabled={pending}
                    className="p-1 text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Loyer / charge</h3>
              <button onClick={() => setOpen(false)}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <Label>Intitulé</Label>
                <input
                  name="label"
                  defaultValue="Loyer cabinet"
                  className={inputCls}
                />
                <input type="hidden" name="type" value="loyer" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Montant (€)</Label>
                  <input
                    name="amount"
                    type="number"
                    step="0.01"
                    required
                    className={inputCls}
                  />
                </div>
                <div>
                  <Label>Date</Label>
                  <input name="expense_date" type="date" className={inputCls} />
                </div>
                <div>
                  <Label>Mois</Label>
                  <select
                    name="period_month"
                    defaultValue={MONTHS[defaultMonth]}
                    className={inputCls}
                  >
                    <option value="">—</option>
                    {MONTHS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Année</Label>
                  <input
                    name="period_year"
                    type="number"
                    defaultValue={defaultYear}
                    className={inputCls}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="px-5 py-2 text-sm text-white bg-brand-600 hover:bg-brand-700 rounded-lg disabled:opacity-60"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition";

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-slate-500 mb-1">
      {children}
    </label>
  );
}
