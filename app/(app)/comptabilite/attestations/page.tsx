import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, ShieldCheck } from "lucide-react";
import { formatCents } from "@/lib/money";
import { frDate } from "@/lib/format";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { getCurrentPractice } from "@/lib/dossier/practice";
import { listPatients } from "@/lib/dossier/queries";
import { patientName } from "@/lib/dossier/types";
import { listAttestations } from "@/lib/attestations/queries";
import {
  ATTESTATION_KIND_SHORT,
  ATTESTATION_STATUS_LABELS,
  attestationTitre,
} from "@/lib/attestations/types";
import NouvelleAttestation from "./NouvelleAttestation";

import type { Metadata } from "next";
/* LE TITRE EST STATIQUE, ET C'EST DÉLIBÉRÉ. Un titre qui porterait le nom du
   patient le ferait entrer dans l'historique du navigateur, parfois synchronisé
   entre appareils, parfois affiché devant quelqu'un d'autre. C'est le même
   raisonnement que celui de la page de consultation publique, et il vaut
   autant ici. Distinguer les pages entre elles suffit. */
export const metadata: Metadata = { title: "Attestations · Psychomotime" };


/**
 * Les attestations établies.
 *
 * Elles se retrouvent ici, longtemps après : une famille rappelle, une mutuelle
 * réclame un duplicata, un organisme conteste. Ce qui a été signé doit pouvoir
 * être relu à l'identique.
 */
export default async function AttestationsPage() {
  const practice = await getCurrentPractice();
  if (!practice) notFound();

  const [liste, patients] = await Promise.all([
    listAttestations(practice),
    practice.canWrite
      ? listPatients(practice, { pageSize: 100 })
      : Promise.resolve({ items: [] as never[] }),
  ]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <Link
        href="/comptabilite"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Comptabilité
      </Link>

      <PageHeader
        title="Attestations"
        subtitle="Présence et paiement — deux documents qui ne disent pas la même chose"
      >
        {practice.canWrite && (
          <NouvelleAttestation
            patients={patients.items.map((p) => ({
              id: p.id,
              nom: patientName(p),
            }))}
          />
        )}
      </PageHeader>

      {liste.erreur && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 mb-5"
        >
          <AlertTriangle
            className="h-5 w-5 shrink-0 text-rose-500 mt-0.5"
            aria-hidden="true"
          />
          <p className="text-sm text-rose-900">{liste.erreur}</p>
        </div>
      )}

      <Card>
        {liste.items.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck className="h-6 w-6" />}
            title="Aucune attestation"
            description="Une attestation de présence s'appuie sur les séances honorées de l'agenda ; une attestation de paiement, sur les règlements réellement imputés. Aucune date ne se saisit à la main."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Attestations établies</caption>
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                  <th scope="col" className="px-4 py-2.5 font-medium">Attestation</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Date</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Dossier</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Ce qu&apos;elle atteste</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">État</th>
                </tr>
              </thead>
              <tbody>
                {liste.items.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
                  >
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/comptabilite/attestations/${a.id}`}
                        className={`font-medium hover:text-brand-700 ${
                          a.status === "annule"
                            ? "text-slate-500 line-through"
                            : "text-slate-700"
                        }`}
                      >
                        {a.number ?? attestationTitre(a)}
                      </Link>
                      <span className="block text-xs text-slate-500">
                        {ATTESTATION_KIND_SHORT[a.kind]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">
                      {a.issued_on ? frDate(a.issued_on) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      <Link
                        href={`/patients/${a.patient_id}`}
                        className="hover:text-brand-700"
                      >
                        {a.patient_nom}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {a.kind === "presence"
                        ? `${a.sessions_count} séance${a.sessions_count > 1 ? "s" : ""}`
                        : formatCents(a.total_cents)}
                      {(a.period_start || a.period_end) && (
                        <span className="block text-xs text-slate-500">
                          {a.period_start && `du ${frDate(a.period_start)}`}
                          {a.period_end && ` au ${frDate(a.period_end)}`}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          a.status === "emis"
                            ? "bg-brand-50 text-brand-700"
                            : a.status === "annule"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {ATTESTATION_STATUS_LABELS[a.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
