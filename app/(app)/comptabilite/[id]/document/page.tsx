import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { formatCents } from "@/lib/money";
import { frDate } from "@/lib/format";
import { getCurrentPractice } from "@/lib/dossier/practice";
import { getDocument } from "@/lib/compta/queries";
import { KIND_LABELS } from "@/lib/compta/types";
import type { DocumentSnapshot } from "@/lib/compta/types";
import BoutonImprimer from "./BoutonImprimer";

/**
 * Le document tel qu'il est remis.
 *
 * TOUT CE QUI S'IMPRIME VIENT DE L'INSTANTANÉ, figé à l'émission. C'est le
 * cœur du dispositif : une facture de l'an dernier doit se réimprimer
 * exactement comme elle a été remise, même si l'adresse du cabinet, sa forme
 * juridique ou son régime fiscal ont changé depuis. Relire les valeurs du jour
 * produirait un document qui n'a jamais existé.
 *
 * CE QUI N'Y ENTRE PAS : la note interne, les estimations reprises de la
 * version précédente, le solde, les règlements. Ce document dit ce qui est dû
 * et pourquoi ; le reste appartient au cabinet.
 *
 * UNE ABSENCE N'EST PAS REMPLACÉE. Une mention que l'instantané ne porte pas
 * est retirée du document, jamais comblée par une valeur plausible.
 */
export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const practice = await getCurrentPractice();
  if (!practice) notFound();

  const piece = await getDocument(practice, id);
  if (!piece) notFound();

  const d = piece.document;
  if (d.status === "brouillon") {
    // Un brouillon ne s'imprime pas : il n'a ni numéro ni date, et sortirait
    // de l'imprimante indiscernable d'un document définitif.
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <Link
          href={`/comptabilite/${d.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Retour à la pièce
        </Link>
        <p className="text-slate-600">
          Ce brouillon n&apos;a pas encore de numéro ni de date d&apos;émission.
          Émettez-le pour obtenir le document à remettre.
        </p>
      </div>
    );
  }

  const s: DocumentSnapshot = d.snapshot ?? {};
  const emetteur = s.entite_juridique;
  const destinataire = s.payeur?.nom?.trim()
    ? s.payeur
    : (s.patient ?? null);
  const identifiants = (s.identifiants ?? []).filter((i) => i?.valeur);
  const exonere = piece.lignes.every(
    (l) => l.vat_treatment === "exoneration_soins",
  );

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5 no-print">
        <Link
          href={`/comptabilite/${d.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Retour à la pièce
        </Link>
        <BoutonImprimer />
      </div>

      <article className="print-area bg-white rounded-xl border border-slate-100 shadow-sm p-8 sm:p-10">
        <header className="flex justify-between gap-8 mb-10">
          <div className="text-sm text-slate-700">
            {s.cabinet?.nom && (
              <p className="font-semibold text-slate-800">{s.cabinet.nom}</p>
            )}
            {emetteur?.denomination && <p>{emetteur.denomination}</p>}
            {emetteur?.adresse && <p>{emetteur.adresse}</p>}
            {(emetteur?.code_postal || emetteur?.ville) && (
              <p>
                {[emetteur.code_postal, emetteur.ville].filter(Boolean).join(" ")}
              </p>
            )}
            {identifiants.length > 0 && (
              <p className="text-xs text-slate-500 mt-2">
                {identifiants
                  .map((i) => `${(i.type ?? "").toUpperCase()} ${i.valeur}`)
                  .join(" · ")}
              </p>
            )}
          </div>

          <div className="text-right text-sm">
            <h1 className="text-2xl font-semibold text-brand-700 tracking-tight">
              {KIND_LABELS[d.kind].toUpperCase()}
            </h1>
            <p className="text-slate-700 mt-1">{d.number}</p>
            {d.issued_on && (
              <p className="text-slate-500">{frDate(d.issued_on)}</p>
            )}
            {d.due_on && (
              <p className="text-slate-500 mt-1">
                Échéance : {frDate(d.due_on)}
              </p>
            )}
            {d.valid_until && (
              <p className="text-slate-500 mt-1">
                Valable jusqu&apos;au {frDate(d.valid_until)}
              </p>
            )}
          </div>
        </header>

        {destinataire?.nom && (
          <section className="mb-8 text-sm">
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">
              Destinataire
            </p>
            <p className="text-slate-800 font-medium">{destinataire.nom}</p>
            {destinataire.adresse && (
              <p className="text-slate-600">{destinataire.adresse}</p>
            )}
            {(destinataire.code_postal || destinataire.ville) && (
              <p className="text-slate-600">
                {[destinataire.code_postal, destinataire.ville]
                  .filter(Boolean)
                  .join(" ")}
              </p>
            )}
          </section>
        )}

        {d.rectifies_number && (
          <p className="text-sm text-slate-600 mb-6">
            {KIND_LABELS[d.kind]} rectifiant la facture {d.rectifies_number}
            {d.rectifies_issued_on && ` du ${frDate(d.rectifies_issued_on)}`}
            {d.rectification_reason && ` — ${d.rectification_reason}`}.
          </p>
        )}

        {(d.period_start || d.period_end) && (
          <p className="text-sm text-slate-600 mb-4">
            Période : {d.period_start && `du ${frDate(d.period_start)}`}
            {d.period_end && ` au ${frDate(d.period_end)}`}
          </p>
        )}

        <table className="w-full text-sm mb-8">
          <caption className="sr-only">Détail des prestations</caption>
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-400 border-b border-slate-200">
              <th scope="col" className="py-2 font-medium">Prestation</th>
              <th scope="col" className="py-2 font-medium text-right w-24">P.U.</th>
              <th scope="col" className="py-2 font-medium text-right w-16">Qté</th>
              <th scope="col" className="py-2 font-medium text-right w-28">Montant</th>
            </tr>
          </thead>
          <tbody>
            {piece.lignes.map((l) => (
              <tr key={l.id} className="border-b border-slate-100 align-top">
                <td className="py-3 pr-4">
                  <span className="text-slate-800">{l.label}</span>
                  {l.intro && (
                    <span className="block text-slate-500 mt-0.5">{l.intro}</span>
                  )}
                  {l.service_dates.length > 0 && (
                    <span className="block text-slate-600 mt-0.5">
                      {l.date_render === "par_date"
                        ? l.service_dates.map((x) => frDate(x)).join(", ")
                        : `${l.service_dates.length} date(s)`}
                    </span>
                  )}
                  {l.note && (
                    <span className="block text-slate-500 mt-0.5 italic">
                      {l.note}
                    </span>
                  )}
                </td>
                <td className="py-3 text-right text-slate-600 tabular-nums">
                  {formatCents(l.unit_price_cents)}
                </td>
                <td className="py-3 text-right text-slate-600 tabular-nums">
                  {l.pricing === "forfait" ? "—" : l.quantity}
                </td>
                <td className="py-3 text-right text-slate-800 tabular-nums">
                  {formatCents(l.amount_cents)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="pt-4 text-right font-medium text-slate-700">
                Total {d.kind === "avoir" ? "de l'avoir" : "à régler"}
              </td>
              <td className="pt-4 text-right text-lg font-semibold text-slate-900 tabular-nums">
                {formatCents(d.total_cents)}
              </td>
            </tr>
          </tfoot>
        </table>

        {d.note && (
          <p className="text-sm text-slate-700 whitespace-pre-wrap mb-6">
            {d.note}
          </p>
        )}

        {exonere && (
          <p className="text-xs text-slate-500">
            TVA non applicable — exonération des soins.
          </p>
        )}
      </article>

      <p className="text-xs text-slate-400 mt-4 no-print">
        Ce document est rendu à partir de l&apos;instantané figé à
        l&apos;émission : il ne changera plus, quelles que soient les
        modifications apportées ensuite au cabinet ou au dossier.
      </p>
    </div>
  );
}
