import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import type { SharedInvoice } from "@/lib/invoiceShare";
import {
  buildInvoiceDocument,
  type InvoiceDocumentText,
} from "@/lib/invoiceDocument";

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

  const shared = data as SharedInvoice;
  const invoiceNumber = shared.invoice.invoice_number;
  // Tout le contenu imprimé vient du modèle partagé : cette page ne décide rien.
  const doc = buildInvoiceDocument(shared);

  return (
    <div className="bg-slate-100 min-h-screen">
      <div className="no-print sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            Facture{invoiceNumber ? ` n° ${invoiceNumber}` : ""}
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
              {doc.issuer.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={doc.issuer.logoUrl}
                  alt="Logo"
                  className="h-20 w-20 object-contain"
                />
              )}
              <div className="text-sm text-slate-600 leading-relaxed">
                <p className="font-semibold text-slate-900 text-base">
                  {doc.issuer.name ?? "Psychomotricien(ne)"}
                </p>
                {doc.issuer.lines.map((l, i) => (
                  <p
                    key={i}
                    className={l.multiline ? "whitespace-pre-line" : undefined}
                  >
                    <Fragments block={l} />
                  </p>
                ))}
              </div>
            </div>
            <div className="text-right">
              <h1 className="text-2xl font-bold text-brand-700">
                {doc.header.title}
              </h1>
              {doc.header.number && (
                <p className="text-sm text-slate-600 mt-1">
                  <Fragments block={doc.header.number} />
                </p>
              )}
              <p className="text-sm text-slate-500">
                <Fragments block={doc.header.date} />
              </p>
            </div>
          </div>

          <div className="flex justify-end mb-8">
            <div className="bg-slate-50 rounded-lg p-4 text-sm min-w-[220px]">
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">
                {doc.billedTo.label}
              </p>
              <p className="font-semibold text-slate-800">
                {doc.billedTo.name || "—"}
              </p>
              {doc.billedTo.address && (
                <p
                  className={`text-slate-600${
                    doc.billedTo.address.multiline ? " whitespace-pre-line" : ""
                  }`}
                >
                  <Fragments block={doc.billedTo.address} />
                </p>
              )}
            </div>
          </div>

          <table className="w-full text-sm mb-6">
            <thead>
              <tr className="border-b-2 border-slate-200 text-left text-slate-500">
                <th className="py-2 font-medium">
                  {doc.table.designationHeader}
                </th>
                <th className="py-2 font-medium text-right">
                  {doc.table.amountHeader}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="py-3 text-slate-700">
                  <Fragments block={doc.table.line.designation} />
                </td>
                <td className="py-3 text-right text-slate-700">
                  {doc.table.line.amount}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="flex justify-end mb-8">
            <div className="w-64">
              <div className="flex justify-between py-2 border-t-2 border-slate-300 font-semibold text-slate-900">
                <span>{doc.total.label}</span>
                <span>{doc.total.amount}</span>
              </div>
              {doc.total.note && (
                <p className="text-xs text-slate-400 mt-1 text-right">
                  <Fragments block={doc.total.note} />
                </p>
              )}
            </div>
          </div>

          {doc.legalMentions && (
            <p
              className={`text-xs text-slate-400 border-t border-slate-100 pt-4${
                doc.legalMentions.multiline ? " whitespace-pre-line" : ""
              }`}
            >
              <Fragments block={doc.legalMentions} />
            </p>
          )}
        </article>
      </div>
    </div>
  );
}

/**
 * Assemblage d'un bloc du modèle : les fragments atténués passent dans un
 * `<span>`, les autres restent des nœuds texte. C'est exactement la structure
 * que cette page produisait avant l'extraction du modèle — les fragments ne
 * sont jamais concaténés.
 */
function Fragments({ block }: { block: InvoiceDocumentText }) {
  return block.segments.map((seg, i) =>
    seg.muted ? (
      <span key={i} className="text-slate-400">
        {seg.text}
      </span>
    ) : (
      seg.text
    ),
  );
}
