"use client";

import { useState } from "react";
import { AlertTriangle, Check, Mail, Send, X } from "lucide-react";
import type { Invoice, PatientContact } from "@/lib/types";
import { euro } from "@/lib/format";
import { sendInvoiceEmail } from "./actions";

type Target = { invoice: Invoice; email: string };
type Blocked = { invoice: Invoice; reason: string };
type Outcome = { id: string; name: string; ok: boolean; detail: string };

/**
 * Envoi groupé des factures de la sélection. Les envois sont enchaînés depuis
 * le navigateur, un par un : l'avancement reste visible et on ne bute pas sur
 * le délai d'exécution d'une fonction serveur.
 */
export default function SendInvoicesDialog({
  invoices,
  patients,
  onClose,
}: {
  invoices: Invoice[];
  patients: PatientContact[];
  onClose: () => void;
}) {
  const byId = new Map(patients.map((p) => [p.id, p]));

  const targets: Target[] = [];
  const blocked: Blocked[] = [];
  for (const inv of invoices) {
    const email = inv.patient_id
      ? (byId.get(inv.patient_id)?.email ?? "").trim()
      : "";
    if (email) targets.push({ invoice: inv, email });
    else
      blocked.push({
        invoice: inv,
        reason: inv.patient_id
          ? "pas d'adresse e-mail"
          : "aucune fiche patient liée",
      });
  }

  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(0);
  const [results, setResults] = useState<Outcome[] | null>(null);

  async function run() {
    setSending(true);
    setDone(0);
    const out: Outcome[] = [];
    for (const t of targets) {
      const r = await sendInvoiceEmail(t.invoice.id);
      out.push({
        id: t.invoice.id,
        name: t.invoice.patient_name || "—",
        ok: r.ok,
        detail: r.ok ? r.email : r.message,
      });
      setDone(out.length);
      // Resend limite la cadence : on espace légèrement les envois.
      await new Promise((r) => setTimeout(r, 400));
    }
    setResults(out);
    setSending(false);
  }

  const okCount = results?.filter((r) => r.ok).length ?? 0;
  const koCount = results ? results.length - okCount : 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-start sm:items-center justify-center bg-slate-900/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 bg-white flex items-center justify-between px-6 py-4 border-b border-slate-100 rounded-t-2xl">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <Mail className="h-4 w-4 text-brand-600" />
            Envoyer les factures
          </h2>
          <button
            onClick={onClose}
            disabled={sending}
            aria-label="Fermer"
            className="text-slate-400 hover:text-slate-600 disabled:opacity-40"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {!results ? (
            <>
              <p className="text-sm text-slate-600">
                {targets.length === 0
                  ? "Aucune facture de cette sélection ne peut être envoyée."
                  : `${targets.length} facture${targets.length > 1 ? "s" : ""} ${
                      targets.length > 1 ? "seront envoyées" : "sera envoyée"
                    } au patient concerné, avec le PDF en pièce jointe.`}
              </p>

              {targets.length > 0 && (
                <ul className="text-sm divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                  {targets.map((t) => (
                    <li
                      key={t.invoice.id}
                      className="flex items-center justify-between gap-3 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-slate-700 truncate">
                          {t.invoice.patient_name || "—"}
                        </p>
                        <p className="text-xs text-slate-400 truncate">
                          {t.email}
                        </p>
                      </div>
                      <span className="shrink-0 text-slate-500 tabular-nums">
                        {euro(t.invoice.revenue_gross)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {blocked.length > 0 && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                  <p className="text-sm font-medium text-amber-800 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" />
                    {blocked.length} facture{blocked.length > 1 ? "s" : ""} ne
                    {blocked.length > 1 ? " seront" : " sera"} pas envoyée
                    {blocked.length > 1 ? "s" : ""}
                  </p>
                  <ul className="mt-1.5 text-xs text-amber-800 space-y-0.5">
                    {blocked.map((b) => (
                      <li key={b.invoice.id}>
                        {b.invoice.patient_name || "—"} — {b.reason}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-amber-700 mt-2">
                    Complétez leur fiche dans l&apos;onglet Patients, puis
                    relancez l&apos;envoi.
                  </p>
                </div>
              )}

              {sending && (
                <p className="text-sm text-slate-500">
                  Envoi en cours… {done} / {targets.length}
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-sm text-slate-700">
                {okCount} envoi{okCount > 1 ? "s" : ""} réussi
                {okCount > 1 ? "s" : ""}
                {koCount > 0 && ` · ${koCount} en échec`}.
              </p>
              <ul className="text-sm divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                {results.map((r) => (
                  <li key={r.id} className="flex items-start gap-2 px-3 py-2">
                    {r.ok ? (
                      <Check className="h-4 w-4 text-brand-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-slate-700">{r.name}</p>
                      <p
                        className={`text-xs ${
                          r.ok ? "text-slate-400" : "text-rose-600"
                        }`}
                      >
                        {r.detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-40"
          >
            {results ? "Fermer" : "Annuler"}
          </button>
          {!results && (
            <button
              type="button"
              onClick={run}
              disabled={sending || targets.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
              {sending
                ? `Envoi… ${done}/${targets.length}`
                : `Envoyer ${targets.length} facture${targets.length > 1 ? "s" : ""}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
