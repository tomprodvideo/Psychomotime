import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import type { SharedInvoice } from "@/lib/invoiceShare";
import { euro, frDate } from "@/lib/format";

// Un lien de facture ne doit jamais se retrouver dans un moteur de recherche.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Votre facture",
};

export default async function FacturePubliquePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  // La RLS interdit la lecture directe : seule cette fonction, limitée à une
  // facture et à ses champs imprimables, est ouverte sans compte.
  const { data } = await supabase.rpc("invoice_by_token", { p_token: token });
  if (!data) notFound();

  const { invoice: inv, patient, settings } = data as SharedInvoice;
  const profile = settings.profile;
  const issueDate =
    inv.issue_date ?? inv.payment_date ?? new Date().toISOString().slice(0, 10);
  const service = inv.service_label ?? "Séance de psychomotricité";
  const amount = inv.revenue_gross ?? 0;

  return (
    <div className="bg-slate-100 min-h-screen">
      <div className="no-print sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            Facture{inv.invoice_number ? ` n° ${inv.invoice_number}` : ""}
          </p>
          <a
            href={`/facture/${token}/pdf`}
            className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-sm"
          >
            Télécharger le PDF
          </a>
        </div>
      </div>

      <div className="py-8 px-4 print:p-0">
        <article className="print-area max-w-3xl mx-auto bg-white shadow-sm border border-slate-200 rounded-lg p-10 print:shadow-none print:border-0">
          <div className="flex items-start justify-between gap-6 mb-8">
            <div className="flex items-start gap-4">
              {profile.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.logo_url}
                  alt="Logo"
                  className="h-20 w-20 object-contain"
                />
              )}
              <div className="text-sm text-slate-600 leading-relaxed">
                <p className="font-semibold text-slate-900 text-base">
                  {settings.display_name ?? "Psychomotricien(ne)"}
                </p>
                {profile.address && (
                  <p className="whitespace-pre-line">{profile.address}</p>
                )}
                {(profile.postal_code || profile.city) && (
                  <p>
                    {[profile.postal_code, profile.city]
                      .filter(Boolean)
                      .join(" ")}
                  </p>
                )}
                {profile.business_phone && <p>Tél. {profile.business_phone}</p>}
                {profile.business_email && <p>{profile.business_email}</p>}
                {profile.siret && <p>SIRET : {profile.siret}</p>}
                {profile.adeli && <p>N° ADELI : {profile.adeli}</p>}
              </div>
            </div>
            <div className="text-right">
              <h1 className="text-2xl font-bold text-brand-700">FACTURE</h1>
              {inv.invoice_number && (
                <p className="text-sm text-slate-600 mt-1">
                  N° {inv.invoice_number}
                </p>
              )}
              <p className="text-sm text-slate-500">Date : {frDate(issueDate)}</p>
            </div>
          </div>

          <div className="flex justify-end mb-8">
            <div className="bg-slate-50 rounded-lg p-4 text-sm min-w-[220px]">
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">
                Facturé à
              </p>
              <p className="font-semibold text-slate-800">
                {inv.patient_name || "—"}
              </p>
              {patient?.address && (
                <p className="text-slate-600 whitespace-pre-line">
                  {patient.address}
                </p>
              )}
            </div>
          </div>

          <table className="w-full text-sm mb-6">
            <thead>
              <tr className="border-b-2 border-slate-200 text-left text-slate-500">
                <th className="py-2 font-medium">Désignation</th>
                <th className="py-2 font-medium text-right">Montant</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="py-3 text-slate-700">
                  {service}
                  {inv.billing_month && (
                    <span className="text-slate-400">
                      {" "}
                      — {inv.billing_month}
                      {inv.billing_year ? ` ${inv.billing_year}` : ""}
                    </span>
                  )}
                  {inv.has_pco && <span className="text-slate-400"> (PCO)</span>}
                </td>
                <td className="py-3 text-right text-slate-700">
                  {euro(amount)}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="flex justify-end mb-8">
            <div className="w-64">
              <div className="flex justify-between py-2 border-t-2 border-slate-300 font-semibold text-slate-900">
                <span>Total à payer</span>
                <span>{euro(amount)}</span>
              </div>
              {inv.payment_method && (
                <p className="text-xs text-slate-400 mt-1 text-right">
                  Règlement : {inv.payment_method}
                  {inv.payment_date ? ` le ${frDate(inv.payment_date)}` : ""}
                </p>
              )}
            </div>
          </div>

          {profile.legal_mentions && (
            <p className="text-xs text-slate-400 border-t border-slate-100 pt-4 whitespace-pre-line">
              {profile.legal_mentions}
            </p>
          )}
        </article>
      </div>
    </div>
  );
}
