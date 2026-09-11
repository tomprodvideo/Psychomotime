"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { RecurringExpense } from "@/lib/types";
import { euro } from "@/lib/format";
import { monthlyEquivalent, monthlyTotal } from "@/lib/expenses";

/**
 * Liste des dépenses récurrentes. Le contenu part dans le formulaire des
 * paramètres sous forme de JSON, comme les autres réglages composés.
 */
export default function RecurringExpensesEditor({
  initial,
  monthlyRent,
  chargeMode,
}: {
  initial: RecurringExpense[];
  monthlyRent: number;
  chargeMode: "retrocession" | "loyer";
}) {
  const [items, setItems] = useState<RecurringExpense[]>(initial);

  const update = (id: string, patch: Partial<RecurringExpense>) =>
    setItems((l) => l.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const add = (e: Omit<RecurringExpense, "id">) =>
    setItems((l) => [...l, { ...e, id: crypto.randomUUID() }]);

  const total = monthlyTotal(items);
  const hasRent = items.some((e) => /loyer/i.test(e.label));
  const suggestRent = chargeMode === "loyer" && monthlyRent > 0 && !hasRent;

  return (
    <div className="space-y-4">
      <input
        type="hidden"
        name="recurring_expenses"
        value={JSON.stringify(items)}
      />

      {items.length === 0 ? (
        <p className="text-sm text-slate-400 py-4 text-center border border-dashed border-slate-200 rounded-xl">
          Aucune dépense récurrente. Ajoutez-en une pour qu&apos;elle soit
          déduite de votre résultat.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
          {items.map((e) => (
            <li
              key={e.id}
              className={`grid grid-cols-12 gap-2 items-center px-3 py-2.5 ${
                e.active ? "" : "bg-slate-50"
              }`}
            >
              <label
                className="col-span-1 flex justify-center"
                title={
                  e.active
                    ? "Déduite du résultat"
                    : "Enregistrée mais non déduite"
                }
              >
                <input
                  type="checkbox"
                  checked={e.active}
                  onChange={(ev) => update(e.id, { active: ev.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-400"
                />
              </label>

              <input
                value={e.label}
                onChange={(ev) => update(e.id, { label: ev.target.value })}
                placeholder="Ex. Abonnement téléphonique"
                className={`col-span-5 ${inputCls}`}
              />

              <input
                type="number"
                step="0.01"
                value={e.amount || ""}
                onChange={(ev) =>
                  update(e.id, { amount: parseFloat(ev.target.value) || 0 })
                }
                placeholder="0,00"
                className={`col-span-2 ${inputCls} text-right`}
              />

              <select
                value={e.period}
                onChange={(ev) =>
                  update(e.id, {
                    period: ev.target.value as RecurringExpense["period"],
                  })
                }
                className={`col-span-2 ${inputCls}`}
              >
                <option value="mensuel">par mois</option>
                <option value="annuel">par an</option>
              </select>

              <span className="col-span-1 text-xs text-slate-400 text-right tabular-nums">
                {e.active && e.period === "annuel"
                  ? `${euro(monthlyEquivalent(e))}/m`
                  : ""}
              </span>

              <button
                type="button"
                onClick={() => setItems((l) => l.filter((x) => x.id !== e.id))}
                aria-label={`Supprimer ${e.label || "cette dépense"}`}
                className="col-span-1 justify-self-end p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() =>
            add({ label: "", amount: 0, period: "mensuel", active: true })
          }
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50 px-3 py-1.5 rounded-lg border border-brand-200"
        >
          <Plus className="h-4 w-4" />
          Ajouter une dépense
        </button>

        {suggestRent && (
          <button
            type="button"
            onClick={() =>
              add({
                label: "Loyer du cabinet",
                amount: monthlyRent,
                period: "mensuel",
                active: true,
              })
            }
            className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-700 hover:bg-violet-50 px-3 py-1.5 rounded-lg border border-violet-200"
          >
            <Plus className="h-4 w-4" />
            Reprendre le loyer ({euro(monthlyRent)}/mois)
          </button>
        )}

        <div className="flex-1" />

        <p className="text-sm text-slate-500">
          Total mensuel :{" "}
          <strong className="text-slate-800">{euro(total)}</strong>
          <span className="text-slate-400"> · {euro(total * 12)} par an</span>
        </p>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition";
