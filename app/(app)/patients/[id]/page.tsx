import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Plus, Receipt } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Bilan, Invoice, Patient } from "@/lib/types";
import { ageFromBirth, euro, frDate } from "@/lib/format";
import { Card } from "@/components/ui";
import ConfirmDeleteButton from "@/components/ConfirmDeleteButton";
import PatientFormDialog from "../PatientFormDialog";
import { deletePatient } from "../actions";

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: patient } = await supabase
    .from("patients")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!patient) notFound();
  const p = patient as Patient;

  const [{ data: invoicesRaw }, { data: bilansRaw }] = await Promise.all([
    supabase
      .from("invoices")
      .select("*")
      .eq("patient_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("bilans")
      .select("*")
      .eq("patient_id", id)
      .order("bilan_date", { ascending: false }),
  ]);

  const invoices = (invoicesRaw ?? []) as Invoice[];
  const bilans = (bilansRaw ?? []) as Bilan[];
  const totalNet = invoices.reduce((s, i) => s + (i.net_revenue || 0), 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <Link
        href="/patients"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-700 mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux patients
      </Link>

      <Card className="p-6 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-semibold text-lg uppercase">
              {(p.first_name?.[0] ?? "") + (p.last_name?.[0] ?? "")}
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-800">
                {p.first_name} {p.last_name}
              </h1>
              <p className="text-sm text-slate-500">
                {p.birth_date
                  ? `Né(e) le ${frDate(p.birth_date)} · ${ageFromBirth(p.birth_date)}`
                  : "Date de naissance non renseignée"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <PatientFormDialog patient={p} />
            <ConfirmDeleteButton
              id={p.id}
              action={deletePatient}
              message="Supprimer ce patient ? (ses factures et bilans seront conservés mais dissociés)"
            />
          </div>
        </div>

        {(p.email || p.phone || p.notes) && (
          <div className="mt-4 pt-4 border-t border-slate-100 grid sm:grid-cols-3 gap-3 text-sm">
            {p.phone && (
              <div>
                <p className="text-xs text-slate-400">Téléphone</p>
                <p className="text-slate-700">{p.phone}</p>
              </div>
            )}
            {p.email && (
              <div>
                <p className="text-xs text-slate-400">Email</p>
                <p className="text-slate-700">{p.email}</p>
              </div>
            )}
            {p.notes && (
              <div className="sm:col-span-3">
                <p className="text-xs text-slate-400">Notes</p>
                <p className="text-slate-700 whitespace-pre-wrap">{p.notes}</p>
              </div>
            )}
          </div>
        )}
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Bilans */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <FileText className="h-4 w-4 text-brand-600" />
              Bilans ({bilans.length})
            </h2>
            <Link
              href={`/bilans/nouveau?patient=${p.id}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50 px-3 py-1.5 rounded-lg"
            >
              <Plus className="h-4 w-4" />
              Nouveau
            </Link>
          </div>
          {bilans.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">
              Aucun bilan pour ce patient.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {bilans.map((b) => (
                <li key={b.id}>
                  <Link
                    href={`/bilans/${b.id}`}
                    className="flex items-center justify-between py-3 hover:bg-slate-50 -mx-2 px-2 rounded-lg"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-700">
                        {b.title}
                      </p>
                      <p className="text-xs text-slate-400">
                        {frDate(b.bilan_date)}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        b.status === "finalisé"
                          ? "bg-brand-100 text-brand-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {b.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Factures */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <Receipt className="h-4 w-4 text-brand-600" />
              Factures ({invoices.length})
            </h2>
            <span className="text-sm text-slate-500">
              Net : <strong className="text-brand-700">{euro(totalNet)}</strong>
            </span>
          </div>
          {invoices.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">
              Aucune facture liée. Liez un patient lors de la saisie d&apos;une
              facture.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {invoices.map((inv) => (
                <li
                  key={inv.id}
                  className="flex items-center justify-between py-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-slate-700">
                      {inv.invoice_number || "Facture"}
                    </p>
                    <p className="text-xs text-slate-400 capitalize">
                      {inv.billing_month} {inv.billing_year}
                    </p>
                  </div>
                  <span className="font-semibold text-brand-700">
                    {euro(inv.net_revenue)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
