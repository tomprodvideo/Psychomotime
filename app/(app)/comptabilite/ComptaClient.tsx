"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import type { Invoice, Patient, Settings } from "@/lib/types";
import { euro } from "@/lib/format";
import { computeInvoice } from "@/lib/calc";
import { MONTHS, PAYMENT_METHODS } from "@/lib/constants";
import { saveInvoice, deleteInvoice } from "./actions";

type PatientLite = Pick<Patient, "id" | "first_name" | "last_name">;

export default function ComptaClient({
  invoices,
  patients,
  settings,
  defaultYear,
}: {
  invoices: Invoice[];
  patients: PatientLite[];
  settings: Pick<Settings, "retrocession_rate" | "urssaf_rate" | "charge_mode">;
  defaultYear: number;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (inv: Invoice) => {
    setEditing(inv);
    setOpen(true);
  };

  return (
    <>
      <div className="flex justify-end mb-4">
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Nouvelle facture
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[920px]">
          <thead>
            <tr className="bg-brand-600 text-white text-left">
              <Th>Prénom / Nom</Th>
              <Th>N° facture</Th>
              <Th>Mois</Th>
              <Th className="text-center">PCO</Th>
              <Th className="text-right">Brut</Th>
              <Th className="text-right">Brut payé</Th>
              <Th>Paiement</Th>
              <Th className="text-right">Rétrocession</Th>
              <Th className="text-right">Après rétro</Th>
              <Th className="text-right">URSSAF</Th>
              <Th className="text-right">Net</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 && (
              <tr>
                <td
                  colSpan={12}
                  className="text-center text-slate-400 py-10 text-sm"
                >
                  Aucune facture pour le moment. Cliquez sur « Nouvelle facture ».
                </td>
              </tr>
            )}
            {invoices.map((inv, i) => (
              <tr
                key={inv.id}
                className={`border-t border-slate-100 ${
                  i % 2 ? "bg-slate-50/50" : ""
                } hover:bg-brand-50/40`}
              >
                <Td className="font-medium text-slate-700">
                  {inv.patient_name || "—"}
                </Td>
                <Td className="text-slate-500">{inv.invoice_number || "—"}</Td>
                <Td className="text-slate-500 capitalize">
                  {inv.billing_month || "—"}
                  {inv.billing_year ? ` ${inv.billing_year}` : ""}
                </Td>
                <Td className="text-center">
                  {inv.has_pco ? (
                    <Check className="h-4 w-4 text-brand-600 inline" />
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </Td>
                <Td className="text-right">{euro(inv.revenue_gross)}</Td>
                <Td className="text-right">{euro(inv.revenue_gross_paid)}</Td>
                <Td className="text-slate-500 whitespace-nowrap">
                  {inv.payment_method || "—"}
                  {inv.payment_date
                    ? ` ${new Date(inv.payment_date + "T00:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}`
                    : ""}
                </Td>
                <Td className="text-right text-rose-600">
                  {euro(inv.retrocession_amount)}
                </Td>
                <Td className="text-right">{euro(inv.after_retro)}</Td>
                <Td className="text-right text-amber-600">
                  {euro(inv.urssaf_amount)}
                </Td>
                <Td className="text-right font-semibold text-brand-700">
                  {euro(inv.net_revenue)}
                </Td>
                <Td className="text-right whitespace-nowrap">
                  <button
                    onClick={() => openEdit(inv)}
                    className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded"
                    aria-label="Modifier"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <DeleteButton id={inv.id} />
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <InvoiceDialog
          invoice={editing}
          patients={patients}
          settings={settings}
          defaultYear={defaultYear}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function DeleteButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => {
        if (!confirm("Supprimer cette facture ?")) return;
        const fd = new FormData();
        fd.set("id", id);
        start(() => deleteInvoice(fd));
      }}
      disabled={pending}
      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded disabled:opacity-50"
      aria-label="Supprimer"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}

function InvoiceDialog({
  invoice,
  patients,
  settings,
  defaultYear,
  onClose,
}: {
  invoice: Invoice | null;
  patients: PatientLite[];
  settings: Pick<Settings, "retrocession_rate" | "urssaf_rate" | "charge_mode">;
  defaultYear: number;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();

  const [patientName, setPatientName] = useState(invoice?.patient_name ?? "");
  const [patientId, setPatientId] = useState(invoice?.patient_id ?? "");
  const [gross, setGross] = useState<number>(invoice?.revenue_gross ?? 0);
  const [paid, setPaid] = useState<number>(
    invoice?.revenue_gross_paid ?? invoice?.revenue_gross ?? 0,
  );
  const [retro, setRetro] = useState<number>(invoice?.retrocession_amount ?? 0);
  const [urssaf, setUrssaf] = useState<number>(invoice?.urssaf_amount ?? 0);
  // En création : auto-calcul. En édition : on respecte les valeurs existantes.
  const [retroAuto, setRetroAuto] = useState(!invoice);
  const [urssafAuto, setUrssafAuto] = useState(!invoice);

  // Recalcule rétrocession + URSSAF tant que l'utilisateur n'a pas saisi manuellement.
  useEffect(() => {
    const c = computeInvoice(gross, settings, {
      retrocession: retroAuto ? undefined : retro,
      urssaf: urssafAuto ? undefined : urssaf,
    });
    if (retroAuto) setRetro(c.retrocession);
    if (urssafAuto) {
      const after = gross - (retroAuto ? c.retrocession : retro);
      setUrssaf(Math.round(after * settings.urssaf_rate * 100) / 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gross, retro, retroAuto, urssafAuto]);

  const afterRetro = Math.round((gross - retro) * 100) / 100;
  const net = Math.round((afterRetro - urssaf) * 100) / 100;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      await saveInvoice(fd);
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-slate-900/40 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">
            {invoice ? "Modifier la facture" : "Nouvelle facture"}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {invoice && <input type="hidden" name="id" value={invoice.id} />}
          <input type="hidden" name="patient_id" value={patientId} />

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label>Patient (prénom / nom)</Label>
              <input
                name="patient_name"
                required
                value={patientName}
                onChange={(e) => {
                  setPatientName(e.target.value);
                  setPatientId("");
                }}
                list="patients-list"
                className={inputCls}
                placeholder="Ex. Léa Martin"
              />
              <datalist id="patients-list">
                {patients.map((p) => (
                  <option
                    key={p.id}
                    value={`${p.first_name} ${p.last_name}`.trim()}
                    onClick={() => setPatientId(p.id)}
                  />
                ))}
              </datalist>
              {patients.length > 0 && (
                <select
                  className={`${inputCls} mt-2 text-slate-500`}
                  value={patientId}
                  onChange={(e) => {
                    const p = patients.find((x) => x.id === e.target.value);
                    setPatientId(e.target.value);
                    if (p)
                      setPatientName(`${p.first_name} ${p.last_name}`.trim());
                  }}
                >
                  <option value="">— Lier à un patient existant (option) —</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.first_name} {p.last_name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <Label>N° de facture</Label>
              <input
                name="invoice_number"
                defaultValue={invoice?.invoice_number ?? ""}
                className={inputCls}
                placeholder="Ex. 202665"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Mois</Label>
                <select
                  name="billing_month"
                  defaultValue={invoice?.billing_month ?? ""}
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
                  name="billing_year"
                  type="number"
                  defaultValue={invoice?.billing_year ?? defaultYear}
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <Label>Revenu brut (€)</Label>
              <input
                name="revenue_gross"
                type="number"
                step="0.01"
                value={gross || ""}
                onChange={(e) => {
                  const v = parseFloat(e.target.value) || 0;
                  setGross(v);
                  if (paid === gross) setPaid(v);
                }}
                className={inputCls}
                required
              />
            </div>
            <div>
              <Label>Revenu brut payé (€)</Label>
              <input
                name="revenue_gross_paid"
                type="number"
                step="0.01"
                value={paid || ""}
                onChange={(e) => setPaid(parseFloat(e.target.value) || 0)}
                className={inputCls}
              />
            </div>

            <div>
              <Label>Moyen de paiement</Label>
              <select
                name="payment_method"
                defaultValue={invoice?.payment_method ?? "Virement"}
                className={inputCls}
              >
                <option value="">—</option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Date de paiement</Label>
              <input
                name="payment_date"
                type="date"
                defaultValue={invoice?.payment_date ?? ""}
                className={inputCls}
              />
            </div>

            <div className="flex items-center gap-2 sm:col-span-2">
              <input
                id="has_pco"
                name="has_pco"
                type="checkbox"
                defaultChecked={invoice?.has_pco ?? false}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-400"
              />
              <label htmlFor="has_pco" className="text-sm text-slate-600">
                PCO (Plateforme de Coordination et d&apos;Orientation)
              </label>
            </div>
          </div>

          {/* Bloc calculs */}
          <div className="bg-slate-50 rounded-xl p-4 grid sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between">
                <Label>Rétrocession (€)</Label>
                <ToggleAuto
                  auto={retroAuto}
                  onToggle={() => setRetroAuto((a) => !a)}
                />
              </div>
              <input
                name="retrocession_amount"
                type="number"
                step="0.01"
                value={retro || ""}
                onChange={(e) => {
                  setRetro(parseFloat(e.target.value) || 0);
                  setRetroAuto(false);
                }}
                className={inputCls}
              />
              <p className="text-xs text-slate-400 mt-1">
                {settings.charge_mode === "loyer"
                  ? "Mode loyer : 0 par défaut (loyer géré à part)."
                  : `Auto : ${Math.round(settings.retrocession_rate * 100)} % du brut.`}
              </p>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label>URSSAF (€)</Label>
                <ToggleAuto
                  auto={urssafAuto}
                  onToggle={() => setUrssafAuto((a) => !a)}
                />
              </div>
              <input
                name="urssaf_amount"
                type="number"
                step="0.01"
                value={urssaf || ""}
                onChange={(e) => {
                  setUrssaf(parseFloat(e.target.value) || 0);
                  setUrssafAuto(false);
                }}
                className={inputCls}
              />
              <p className="text-xs text-slate-400 mt-1">
                Auto : {(settings.urssaf_rate * 100).toFixed(2)} % de l&apos;après-rétro.
              </p>
            </div>
            <div className="sm:col-span-2 flex flex-wrap gap-x-6 gap-y-1 text-sm pt-1">
              <span className="text-slate-500">
                Après rétro :{" "}
                <strong className="text-slate-700">{euro(afterRetro)}</strong>
              </span>
              <span className="text-slate-500">
                Revenu net :{" "}
                <strong className="text-brand-700">{euro(net)}</strong>
              </span>
            </div>
          </div>

          <div>
            <Label>Notes (optionnel)</Label>
            <input
              name="notes"
              defaultValue={invoice?.notes ?? ""}
              className={inputCls}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={pending}
              className="px-5 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg disabled:opacity-60"
            >
              {pending ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ToggleAuto({
  auto,
  onToggle,
}: {
  auto: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`text-xs px-2 py-0.5 rounded-full transition ${
        auto
          ? "bg-brand-100 text-brand-700"
          : "bg-slate-200 text-slate-500"
      }`}
    >
      {auto ? "Auto" : "Manuel"}
    </button>
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

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th className={`px-3 py-2.5 font-semibold whitespace-nowrap ${className}`}>
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-3 py-2.5 ${className}`}>{children}</td>;
}
