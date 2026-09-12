import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Wallet } from "lucide-react";
import { formatCents } from "@/lib/money";
import { frDate } from "@/lib/format";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { getCurrentPractice } from "@/lib/dossier/practice";
import { listPayments } from "@/lib/compta/queries";
import { METHOD_LABELS } from "@/lib/compta/types";
import { resoudrePeriode } from "../periode";

import type { Metadata } from "next";
/* LE TITRE EST STATIQUE, ET C'EST DÉLIBÉRÉ. Un titre qui porterait le nom du
   patient le ferait entrer dans l'historique du navigateur, parfois synchronisé
   entre appareils, parfois affiché devant quelqu'un d'autre. C'est le même
   raisonnement que celui de la page de consultation publique, et il vaut
   autant ici. Distinguer les pages entre elles suffit. */
export const metadata: Metadata = { title: "Règlements · Psychomotime" };


/**
 * Les règlements reçus.
 *
 * CE QUE CET ÉCRAN MONTRE ET QUE LA VERSION PRÉCÉDENTE NE POUVAIT PAS MONTRER :
 * la part d'un règlement qui n'est imputée sur aucune pièce. La v1 ne
 * connaissait qu'un « montant payé » collé à une facture ; un virement couvrant
 * trois factures, un acompte, un trop-perçu n'y existaient tout simplement pas.
 */
export default async function ReglementsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const practice = await getCurrentPractice();
  if (!practice) notFound();

  const aujourdhui = new Date();
  const periode = resoudrePeriode(params, aujourdhui);
  const reglements = await listPayments(practice, {
    du: periode.du,
    au: periode.au,
  });

  const total = reglements.reduce((s, r) => s + r.amount_cents, 0);
  const libre = reglements.reduce((s, r) => s + r.libre_cents, 0);

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
        title="Règlements"
        subtitle={`${periode.libelle} — ${formatCents(total)} reçus`}
      />

      {libre > 0 && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5">
          {formatCents(libre)} ne sont imputés sur aucune pièce. Il peut
          s&apos;agir d&apos;un acompte, d&apos;un trop-perçu ou d&apos;une
          imputation qui reste à faire — mais l&apos;argent, lui, est bien reçu.
        </p>
      )}

      <Card>
        {reglements.length === 0 ? (
          <EmptyState
            icon={<Wallet className="h-6 w-6" />}
            title="Aucun règlement sur cette période"
            description="Les règlements s'enregistrent depuis la facture concernée."
          />
        ) : (
          <ul className="list-none p-0 m-0 divide-y divide-slate-50">
            {reglements.map((r) => (
              <li key={r.id} className="px-5 py-3.5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm text-slate-800">
                      {formatCents(r.amount_cents)}
                      <span className="text-slate-500">
                        {" "}
                        · {METHOD_LABELS[r.method]} · {frDate(r.received_on)}
                        {r.reference && ` · ${r.reference}`}
                      </span>
                    </p>
                    {r.pieces.length > 0 ? (
                      <p className="text-xs text-slate-500 mt-0.5">
                        Imputé sur{" "}
                        {r.pieces.map((p, i) => (
                          <span key={p.document_id}>
                            {i > 0 && ", "}
                            <Link
                              href={`/comptabilite/${p.document_id}`}
                              className="underline hover:text-brand-700"
                            >
                              {p.number ?? "pièce"}
                            </Link>{" "}
                            ({formatCents(p.amount_cents)})
                          </span>
                        ))}
                      </p>
                    ) : (
                      <p className="text-xs text-amber-600 mt-0.5">
                        Non imputé
                      </p>
                    )}
                    {r.note && (
                      <p className="text-xs text-slate-500 mt-0.5">{r.note}</p>
                    )}
                  </div>
                  {r.libre_cents > 0 && r.pieces.length > 0 && (
                    <span className="text-xs text-amber-600 shrink-0">
                      {formatCents(r.libre_cents)} non imputés
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
