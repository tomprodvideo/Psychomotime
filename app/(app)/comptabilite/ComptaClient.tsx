"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  Layers,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type { Invoice, PatientContact, Settings } from "@/lib/types";
import { ageFromBirth, euro, frDate } from "@/lib/format";
import { computeInvoice } from "@/lib/calc";
import { MONTHS, PAYMENT_METHODS } from "@/lib/constants";
import { invoicePeriod, ymKey, MONTHS_SHORT } from "@/lib/period";
import {
  amountDue,
  paymentStatus,
  summarize,
  PAYMENT_LABELS,
  PAYMENT_STYLES,
} from "./summary";
import PatientFormDialog from "../patients/PatientFormDialog";
import { saveInvoice, deleteInvoice, nextInvoiceNumber } from "./actions";

type PatientLite = PatientContact;
type SortKey = "period" | "patient" | "number" | "gross" | "paid" | "net";
export type PayFilter = "all" | "paid" | "unpaid";

export default function ComptaClient({
  invoices,
  patients,
  settings,
  defaultYear,
  defaultMonth,
  payFilter,
  onPayFilter,
  defaultCollapsed = false,
}: {
  invoices: Invoice[];
  patients: PatientLite[];
  settings: Pick<Settings, "retrocession_rate" | "urssaf_rate" | "charge_mode">;
  defaultYear: number;
  defaultMonth: number;
  payFilter: PayFilter;
  onPayFilter: (v: PayFilter) => void;
  /** Sélection couvrant plusieurs mois : les groupes démarrent repliés. */
  defaultCollapsed?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("period");
  const [sortAsc, setSortAsc] = useState(false);
  const [grouped, setGrouped] = useState(true);
  // Groupes dont l'utilisateur a inversé l'état par rapport au défaut.
  const [toggled, setToggled] = useState<Set<number>>(new Set());
  const isCollapsedGroup = (k: number) =>
    defaultCollapsed ? !toggled.has(k) : toggled.has(k);

  const showRetro = settings.charge_mode !== "loyer";

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (inv: Invoice) => {
    setEditing(inv);
    setOpen(true);
  };

  /* ---- Filtre par statut de paiement ---- */
  const visible = useMemo(() => {
    if (payFilter === "all") return invoices;
    const wantPaid = payFilter === "paid";
    return invoices.filter((i) => (paymentStatus(i) === "paid") === wantPaid);
  }, [invoices, payFilter]);

  const unpaidCount = useMemo(
    () => invoices.filter((i) => paymentStatus(i) !== "paid").length,
    [invoices],
  );
  const paidCount = invoices.length - unpaidCount;

  /* ---- Tri ---- */
  const sorted = useMemo(() => {
    const dir = sortAsc ? 1 : -1;
    const val = (i: Invoice): number | string => {
      switch (sortKey) {
        case "period":
          return ymKey(invoicePeriod(i));
        case "patient":
          return (i.patient_name ?? "").toLowerCase();
        case "number":
          return (i.invoice_number ?? "").padStart(12, "0");
        case "gross":
          return i.revenue_gross || 0;
        case "paid":
          return i.revenue_gross_paid || 0;
        case "net":
          return i.net_revenue || 0;
      }
    };
    return [...visible].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      if (typeof va === "string" || typeof vb === "string")
        return String(va).localeCompare(String(vb), "fr") * dir;
      return (va - vb) * dir;
    });
  }, [visible, sortKey, sortAsc]);

  /* ---- Regroupement par mois ---- */
  const monthKeys = useMemo(
    () => new Set(invoices.map((i) => ymKey(invoicePeriod(i)))),
    [invoices],
  );
  const canGroup = monthKeys.size > 1;

  const groups = useMemo(() => {
    if (!grouped || !canGroup)
      return [{ key: -1, items: sorted }] as {
        key: number;
        items: Invoice[];
      }[];
    const map = new Map<number, Invoice[]>();
    for (const inv of sorted) {
      const k = ymKey(invoicePeriod(inv));
      const arr = map.get(k);
      if (arr) arr.push(inv);
      else map.set(k, [inv]);
    }
    return [...map.entries()]
      .sort((a, b) => (sortKey === "period" && sortAsc ? a[0] - b[0] : b[0] - a[0]))
      .map(([key, items]) => ({ key, items }));
  }, [sorted, grouped, canGroup, sortKey, sortAsc]);

  function toggleSort(k: SortKey) {
    if (k === sortKey) setSortAsc((a) => !a);
    else {
      setSortKey(k);
      setSortAsc(k === "patient" || k === "number");
    }
  }

  function toggleGroup(k: number) {
    setToggled((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  // Colonnes : bandeau couleur + 12 (ou 14 avec rétrocession) + actions.
  const colCount = showRetro ? 15 : 13;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Barre d'outils du tableau */}
      <div className="flex flex-wrap items-center gap-2 px-4 sm:px-5 py-3 border-b border-slate-100">
        <h2 className="font-semibold text-slate-800 mr-1">Factures</h2>
        <span className="text-xs text-slate-400">
          {visible.length} ligne{visible.length > 1 ? "s" : ""}
        </span>

        <div className="flex-1" />

        {/* Filtre par statut de paiement */}
        <div className="flex items-center gap-1.5">
          <FilterChip
            label="Toutes"
            count={invoices.length}
            active={payFilter === "all"}
            onClick={() => onPayFilter("all")}
          />
          <FilterChip
            label="Payées"
            count={paidCount}
            dot="bg-emerald-500"
            active={payFilter === "paid"}
            onClick={() => onPayFilter(payFilter === "paid" ? "all" : "paid")}
          />
          <FilterChip
            label="Impayées"
            count={unpaidCount}
            dot="bg-rose-500"
            active={payFilter === "unpaid"}
            onClick={() =>
              onPayFilter(payFilter === "unpaid" ? "all" : "unpaid")
            }
          />
        </div>

        {canGroup && (
          <button
            onClick={() => setGrouped((g) => !g)}
            title="Regrouper les factures par mois"
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition ${
              grouped
                ? "bg-brand-50 border-brand-200 text-brand-700"
                : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            Par mois
          </button>
        )}

        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-3.5 py-1.5 rounded-lg transition shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Nouvelle facture
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[1120px]">
          <thead>
            <tr className="bg-brand-600 text-white text-left">
              <Th className="w-1 p-0" />
              <ThSort
                label="Prénom / Nom"
                k="patient"
                active={sortKey}
                asc={sortAsc}
                onSort={toggleSort}
              />
              <ThSort
                label="N° facture"
                k="number"
                active={sortKey}
                asc={sortAsc}
                onSort={toggleSort}
              />
              <ThSort
                label="Mois"
                k="period"
                active={sortKey}
                asc={sortAsc}
                onSort={toggleSort}
              />
              <Th className="text-center">Paiement</Th>
              <Th className="text-center">PCO</Th>
              <ThSort
                label="Brut"
                k="gross"
                active={sortKey}
                asc={sortAsc}
                onSort={toggleSort}
                right
              />
              <ThSort
                label="Brut payé"
                k="paid"
                active={sortKey}
                asc={sortAsc}
                onSort={toggleSort}
                right
              />
              <Th className="text-right">Reste dû</Th>
              <Th>Moyen / date de paiement</Th>
              {showRetro && <Th className="text-right">Rétrocession</Th>}
              {showRetro && <Th className="text-right">Après rétro</Th>}
              <Th className="text-right">URSSAF</Th>
              <ThSort
                label="Net"
                k="net"
                active={sortKey}
                asc={sortAsc}
                onSort={toggleSort}
                right
              />
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>

          {visible.length === 0 && (
            <tbody>
              <tr>
                <td
                  colSpan={colCount}
                  className="text-center text-slate-400 py-12 text-sm"
                >
                  {payFilter === "unpaid"
                    ? "Aucune facture impayée sur cette période 🎉"
                    : payFilter === "paid"
                      ? "Aucune facture payée sur cette période."
                      : "Aucune facture sur cette période. Cliquez sur « Nouvelle facture »."}
                </td>
              </tr>
            </tbody>
          )}

          {groups.map((g) => {
            const isCollapsed = isCollapsedGroup(g.key);
            const gs = summarize(g.items, []);
            return (
              <tbody key={g.key}>
                {g.key >= 0 && (
                  <tr
                    className="bg-slate-50/80 border-t border-slate-100 cursor-pointer hover:bg-slate-100/70"
                    onClick={() => toggleGroup(g.key)}
                  >
                    <td colSpan={4} className="px-3 py-2">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-slate-600">
                        {isCollapsed ? (
                          <ChevronRight className="h-4 w-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        )}
                        <span className="first-letter:uppercase">
                          {MONTHS[((g.key % 12) + 12) % 12]}{" "}
                          {Math.floor(g.key / 12)}
                        </span>
                        <span className="ml-1 text-xs font-normal text-slate-400">
                          · {g.items.length} facture
                          {g.items.length > 1 ? "s" : ""}
                        </span>
                      </span>
                    </td>
                    <td colSpan={2} />
                    <td className="px-3 py-2 text-right font-semibold text-slate-600 tabular-nums">
                      {euro(gs.brut)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-500 tabular-nums">
                      {euro(gs.brutPaye)}
                    </td>
                    <td className="px-3 py-2 text-right text-rose-500 tabular-nums">
                      {gs.restant > 0 ? euro(gs.restant) : "—"}
                    </td>
                    <td colSpan={showRetro ? 3 : 1} />
                    <td className="px-3 py-2 text-right text-amber-600 tabular-nums">
                      {euro(gs.urssaf)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-brand-700 tabular-nums">
                      {euro(gs.net)}
                    </td>
                    <td />
                  </tr>
                )}

                {!isCollapsed &&
                  g.items.map((inv, i) => {
                    const st = paymentStatus(inv);
                    const style = PAYMENT_STYLES[st];
                    const due = amountDue(inv);
                    return (
                      <tr
                        key={inv.id}
                        className={`border-t border-slate-100 ${
                          i % 2 ? "bg-slate-50/40" : ""
                        } hover:bg-brand-50/40`}
                      >
                        <td
                          className={`p-0 w-1 ${style.dot}`}
                          title={PAYMENT_LABELS[st]}
                        />
                        <Td className="font-medium text-slate-700">
                          {inv.patient_name || "—"}
                        </Td>
                        <Td className="text-slate-500">
                          {inv.invoice_number || "—"}
                        </Td>
                        <Td className="text-slate-500 whitespace-nowrap">
                          {MONTHS_SHORT[invoicePeriod(inv).m]}{" "}
                          {invoicePeriod(inv).y}
                        </Td>
                        <Td className="text-center">
                          <span
                            className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${style.badge}`}
                            title={
                              st === "partial"
                                ? `Reste ${euro(due)} à encaisser`
                                : st === "unpaid"
                                  ? `${euro(due)} non encaissé`
                                  : "Facture encaissée"
                            }
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${style.dot}`}
                            />
                            {PAYMENT_LABELS[st]}
                          </span>
                        </Td>
                        <Td className="text-center">
                          {inv.has_pco ? (
                            <Check className="h-4 w-4 text-brand-600 inline" />
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </Td>
                        <Td className="text-right tabular-nums">
                          {euro(inv.revenue_gross)}
                        </Td>
                        <Td className="text-right tabular-nums">
                          {euro(inv.revenue_gross_paid)}
                        </Td>
                        <Td
                          className={`text-right tabular-nums ${
                            due > 0 ? "text-rose-600 font-medium" : "text-slate-300"
                          }`}
                        >
                          {due > 0 ? euro(due) : "—"}
                        </Td>
                        <Td className="text-slate-500 whitespace-nowrap">
                          {inv.payment_method || "—"}
                          {inv.payment_date && (
                            <span className="text-slate-400">
                              {" · "}
                              {frDate(inv.payment_date)}
                            </span>
                          )}
                        </Td>
                        {showRetro && (
                          <Td className="text-right text-rose-600 tabular-nums">
                            {euro(inv.retrocession_amount)}
                          </Td>
                        )}
                        {showRetro && (
                          <Td className="text-right tabular-nums">
                            {euro(inv.after_retro)}
                          </Td>
                        )}
                        <Td className="text-right text-amber-600 tabular-nums">
                          {euro(inv.urssaf_amount)}
                        </Td>
                        <Td className="text-right font-semibold text-brand-700 tabular-nums">
                          {euro(inv.net_revenue)}
                        </Td>
                        <Td className="text-right whitespace-nowrap">
                          <Link
                            href={`/comptabilite/${inv.id}/facture`}
                            className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded inline-block"
                            aria-label="Éditer la facture"
                            title="Éditer / envoyer la facture"
                          >
                            <FileText className="h-4 w-4" />
                          </Link>
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
                    );
                  })}
              </tbody>
            );
          })}

          {visible.length > 0 && <TotalRow invoices={visible} showRetro={showRetro} />}
        </table>
      </div>

      {open && (
        <InvoiceDialog
          invoice={editing}
          patients={patients}
          settings={settings}
          defaultYear={defaultYear}
          defaultMonth={defaultMonth}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function TotalRow({
  invoices,
  showRetro,
}: {
  invoices: Invoice[];
  showRetro: boolean;
}) {
  const s = summarize(invoices, []);
  return (
    <tfoot>
      <tr className="border-t-2 border-brand-100 bg-brand-50/60 font-semibold text-slate-700">
        <td />
        <td className="px-3 py-3" colSpan={3}>
          Total ({s.count} facture{s.count > 1 ? "s" : ""})
        </td>
        <td colSpan={2} />
        <td className="px-3 py-3 text-right tabular-nums">{euro(s.brut)}</td>
        <td className="px-3 py-3 text-right tabular-nums">{euro(s.brutPaye)}</td>
        <td className="px-3 py-3 text-right text-rose-600 tabular-nums">
          {s.restant > 0 ? euro(s.restant) : "—"}
        </td>
        <td />
        {showRetro && (
          <td className="px-3 py-3 text-right text-rose-600 tabular-nums">
            {euro(s.retrocession)}
          </td>
        )}
        {showRetro && (
          <td className="px-3 py-3 text-right tabular-nums">
            {euro(s.brutMoinsRetro)}
          </td>
        )}
        <td className="px-3 py-3 text-right text-amber-600 tabular-nums">
          {euro(s.urssaf)}
        </td>
        <td className="px-3 py-3 text-right text-brand-700 tabular-nums">
          {euro(s.net)}
        </td>
        <td />
      </tr>
    </tfoot>
  );
}

function FilterChip({
  label,
  count,
  dot,
  active,
  onClick,
}: {
  label: string;
  count: number;
  dot?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={`Afficher : ${label.toLowerCase()}`}
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition ${
        active
          ? "bg-slate-800 border-slate-800 text-white"
          : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
      }`}
    >
      {dot && <span className={`h-2 w-2 rounded-full ${dot}`} />}
      {label}
      <span className={active ? "tabular-nums" : "tabular-nums text-slate-400"}>
        {count}
      </span>
    </button>
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
  defaultMonth,
  onClose,
}: {
  invoice: Invoice | null;
  patients: PatientLite[];
  settings: Pick<Settings, "retrocession_rate" | "urssaf_rate" | "charge_mode">;
  defaultYear: number;
  defaultMonth: number;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();

  const [patientId, setPatientId] = useState(invoice?.patient_id ?? "");
  const [newPatientOpen, setNewPatientOpen] = useState(false);
  // Patient tout juste créé : évite d'attendre le rafraîchissement du serveur
  // pour pouvoir l'afficher et le sélectionner.
  const [justCreated, setJustCreated] = useState<PatientLite | null>(null);
  const [gross, setGross] = useState<number>(invoice?.revenue_gross ?? 0);
  const [paid, setPaid] = useState<number>(
    invoice?.revenue_gross_paid ?? invoice?.revenue_gross ?? 0,
  );

  // Le numéro suit la période facturée : il est régénéré si elle change.
  const [billingMonth, setBillingMonth] = useState(
    invoice?.billing_month ?? MONTHS[defaultMonth],
  );
  const [billingYear, setBillingYear] = useState<number>(
    invoice?.billing_year ?? defaultYear,
  );
  // Numéro saisi à la main : une fois renseigné, il l'emporte sur la
  // proposition automatique.
  const [manualNumber, setManualNumber] = useState<string | null>(
    invoice?.invoice_number ?? null,
  );
  // Proposition automatique, mémorisée avec la période qui l'a produite.
  const [generated, setGenerated] = useState<{
    key: string;
    value: string;
  } | null>(null);

  const periodKey = `${billingYear}-${billingMonth}`;
  const fresh = generated?.key === periodKey ? generated.value : null;
  const numberLoading = !invoice && manualNumber === null && fresh === null;
  const number = manualNumber ?? fresh ?? "";

  // Numéro attribué automatiquement à la création, d'après le modèle défini
  // dans Paramètres › Comptabilité. En édition, on ne touche à rien.
  useEffect(() => {
    if (invoice) return;
    let cancelled = false;
    const mi = MONTHS.indexOf(billingMonth);
    nextInvoiceNumber(billingYear, mi < 0 ? 0 : mi).then((n) => {
      if (!cancelled)
        setGenerated({ key: `${billingYear}-${billingMonth}`, value: n });
    });
    return () => {
      cancelled = true;
    };
  }, [invoice, billingMonth, billingYear]);

  const options = useMemo(() => {
    if (!justCreated || patients.some((p) => p.id === justCreated.id))
      return patients;
    return [...patients, justCreated].sort((a, b) =>
      (a.last_name ?? "").localeCompare(b.last_name ?? ""),
    );
  }, [patients, justCreated]);

  const selectedPatient = options.find((p) => p.id === patientId) ?? null;
  // Ancienne facture saisie en texte libre, sans fiche patient rattachée.
  const orphanName = patientId ? "" : (invoice?.patient_name ?? "");

  // Rétrocession et URSSAF sont définies dans Paramètres › Comptabilité et
  // recalculées par le serveur à l'enregistrement : ici on ne fait qu'afficher
  // le montant qui restera.
  const { afterRetro, net } = computeInvoice(gross, settings);
  const due = Math.round(Math.max(0, gross - paid) * 100) / 100;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      await saveInvoice(fd);
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-slate-900/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 z-10 bg-white flex items-center justify-between px-6 py-4 border-b border-slate-100 rounded-t-2xl">
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
          <input
            type="hidden"
            name="patient_name"
            value={
              selectedPatient
                ? `${selectedPatient.first_name} ${selectedPatient.last_name}`.trim()
                : orphanName
            }
          />

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label>Patient</Label>
              <div className="flex gap-2">
                <select
                  value={patientId}
                  required
                  onChange={(e) => setPatientId(e.target.value)}
                  className={`${inputCls} flex-1`}
                >
                  <option value="">— Sélectionner un patient —</option>
                  {options.map((p) => (
                    <option key={p.id} value={p.id}>
                      {`${p.first_name} ${p.last_name}`.trim()}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setNewPatientOpen(true)}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-brand-700 border border-brand-200 hover:bg-brand-50 rounded-lg transition"
                >
                  <Plus className="h-4 w-4" />
                  Nouveau
                </button>
              </div>

              {/* Informations reprises du patient sélectionné. */}
              {selectedPatient ? (
                <div className="mt-2 bg-brand-50 border border-brand-100 rounded-xl p-3 flex items-start gap-3">
                  <div className="h-10 w-10 shrink-0 rounded-full bg-brand-600 text-white flex items-center justify-center font-semibold uppercase">
                    {(selectedPatient.first_name?.[0] ?? "") +
                      (selectedPatient.last_name?.[0] ?? "")}
                  </div>
                  <div className="min-w-0 text-sm">
                    <p className="font-semibold text-slate-800">
                      {`${selectedPatient.first_name} ${selectedPatient.last_name}`.trim()}
                    </p>
                    <p className="text-slate-500">
                      {selectedPatient.birth_date
                        ? `Né(e) le ${frDate(selectedPatient.birth_date)} · ${ageFromBirth(selectedPatient.birth_date)}`
                        : "Date de naissance non renseignée"}
                    </p>
                    {(selectedPatient.phone || selectedPatient.email) && (
                      <p className="text-slate-500 truncate">
                        {[selectedPatient.phone, selectedPatient.email]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                    {selectedPatient.address ? (
                      <p className="text-slate-500 truncate">
                        {selectedPatient.address}
                      </p>
                    ) : (
                      <p className="text-amber-600">
                        Adresse manquante — elle n&apos;apparaîtra pas sur la
                        facture.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                orphanName && (
                  <p className="mt-2 text-xs text-amber-600">
                    Cette facture était rattachée à «&nbsp;{orphanName}&nbsp;»
                    sans fiche patient. Sélectionnez le patient ou créez sa
                    fiche.
                  </p>
                )
              )}
            </div>

            <div>
              <Label>N° de facture</Label>
              <input
                name="invoice_number"
                value={number}
                onChange={(e) => setManualNumber(e.target.value)}
                readOnly={!invoice}
                className={`${inputCls} ${
                  invoice ? "" : "bg-slate-100 text-slate-500"
                }`}
                placeholder={numberLoading ? "Attribution…" : "Ex. 2026-001"}
              />
              {!invoice && (
                <p className="text-xs text-slate-400 mt-1">
                  Réservé à l&apos;enregistrement, jamais réutilisé · modèle
                  réglable dans Paramètres › Comptabilité.
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Mois</Label>
                <select
                  name="billing_month"
                  value={billingMonth}
                  onChange={(e) => setBillingMonth(e.target.value)}
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
                  value={billingYear}
                  onChange={(e) =>
                    setBillingYear(parseInt(e.target.value, 10) || 0)
                  }
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
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setPaid(gross)}
                  className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                >
                  Tout payé
                </button>
                <button
                  type="button"
                  onClick={() => setPaid(0)}
                  className="text-xs px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100"
                >
                  Non payé
                </button>
                {due > 0 && (
                  <span className="text-xs text-rose-600">
                    Reste {euro(due)}
                  </span>
                )}
              </div>
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

            <div>
              <Label>Date de la facture</Label>
              <input
                name="issue_date"
                type="date"
                defaultValue={invoice?.issue_date ?? ""}
                className={inputCls}
              />
            </div>
            <div>
              <Label>Prestation (libellé facture)</Label>
              <input
                name="service_label"
                defaultValue={
                  invoice?.service_label ?? "Séance de psychomotricité"
                }
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

          {/* Récapitulatif en lecture seule. Rétrocession et URSSAF sont
              définies une fois pour toutes dans Paramètres › Comptabilité. */}
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span className="text-slate-500">
                Après rétrocession :{" "}
                <strong className="text-slate-700">{euro(afterRetro)}</strong>
              </span>
              <span className="text-slate-500">
                Revenu net :{" "}
                <strong className="text-brand-700">{euro(net)}</strong>
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1.5">
              {settings.charge_mode === "loyer"
                ? "Mode loyer (le loyer est géré à part)"
                : `Rétrocession ${Math.round(settings.retrocession_rate * 100)} %`}
              {` · URSSAF ${(settings.urssaf_rate * 100).toFixed(2)} % · réglé dans Paramètres › Comptabilité.`}
            </p>
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

      <PatientFormDialog
        hideTrigger
        zClass="z-[60]"
        open={newPatientOpen}
        onOpenChange={setNewPatientOpen}
        onSaved={(p) => {
          setJustCreated(p);
          setPatientId(p.id);
        }}
      />
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

function Th({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th className={`px-3 py-2.5 font-semibold whitespace-nowrap ${className}`}>
      {children}
    </th>
  );
}

function ThSort({
  label,
  k,
  active,
  asc,
  onSort,
  right,
}: {
  label: string;
  k: SortKey;
  active: SortKey;
  asc: boolean;
  onSort: (k: SortKey) => void;
  right?: boolean;
}) {
  const on = active === k;
  return (
    <th className="px-3 py-2.5 font-semibold whitespace-nowrap">
      <button
        onClick={() => onSort(k)}
        title={`Trier par ${label.toLowerCase()}`}
        className={`inline-flex items-center gap-1 hover:text-white/80 transition ${
          right ? "w-full justify-end" : ""
        }`}
      >
        {label}
        {on ? (
          <span className="text-[10px]">{asc ? "▲" : "▼"}</span>
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
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
