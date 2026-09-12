import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Ban, Printer } from "lucide-react";
import { formatCents } from "@/lib/money";
import { frDate } from "@/lib/format";
import { Card } from "@/components/ui";
import { getCurrentPractice } from "@/lib/dossier/practice";
import { listContacts } from "@/lib/dossier/queries";
import { contactName } from "@/lib/dossier/types";
import {
  getAttestation,
  listReglementsAttestables,
  listSeancesAttestables,
} from "@/lib/attestations/queries";
import {
  ATTESTATION_KIND_EXPLICATIONS,
  ATTESTATION_KIND_LABELS,
  ATTESTATION_STATUS_LABELS,
  NATURE_ACTE_LABELS,
  attestationModifiable,
  attestationTitre,
} from "@/lib/attestations/types";
import EnteteAttestation from "./EnteteAttestation";
import FaitsAttestes from "./FaitsAttestes";
import ActionsAttestation from "./ActionsAttestation";

/**
 * Une attestation.
 *
 * Deux visages, et c'est le statut qui décide : un brouillon se compose, une
 * attestation signée se lit. Proposer un formulaire sur un document déjà remis
 * reviendrait à promettre une modification que la base refuse — et qui
 * produirait deux documents contradictoires portant le même numéro.
 */
export default async function AttestationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const practice = await getCurrentPractice();
  if (!practice) notFound();

  const complete = await getAttestation(practice, id);
  if (!complete) notFound();

  const { attestation: a } = complete;
  const modifiable = attestationModifiable(a) && practice.canWrite;
  const aujourdhui = new Date().toISOString().slice(0, 10);

  const [contacts, seances, reglements] = await Promise.all([
    modifiable ? listContacts(practice) : Promise.resolve([]),
    modifiable && a.kind === "presence"
      ? listSeancesAttestables(practice, a.patient_id, {
          du: a.period_start ?? undefined,
          au: a.period_end ?? undefined,
        })
      : Promise.resolve([]),
    modifiable && a.kind === "paiement"
      ? listReglementsAttestables(practice, a.patient_id, {
          du: a.period_start ?? undefined,
          au: a.period_end ?? undefined,
        })
      : Promise.resolve([]),
  ]);

  const choisies = new Set<string>([
    ...complete.seances.map((s) => s.appointment_id),
    ...complete.reglements.map((r) => r.payment_id),
  ]);
  const nbFaits =
    a.kind === "presence" ? complete.seances.length : complete.reglements.length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
      <Link
        href="/comptabilite/attestations"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Attestations
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">
            {attestationTitre(a)}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {ATTESTATION_STATUS_LABELS[a.status]}
            {a.issued_on && ` · signée le ${frDate(a.issued_on)}`}
            {complete.patient_nom && (
              <>
                {" · "}
                <Link
                  href={`/patients/${a.patient_id}`}
                  className="hover:text-brand-700 underline"
                >
                  {complete.patient_nom}
                </Link>
              </>
            )}
          </p>
        </div>
        {practice.canWrite && (
          <ActionsAttestation
            attestation={a}
            nbFaits={nbFaits}
            aujourdhui={aujourdhui}
          />
        )}
      </div>

      {a.status === "annule" && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 mb-5">
          <Ban className="h-5 w-5 shrink-0 text-amber-500 mt-0.5" aria-hidden="true" />
          <div className="text-sm text-amber-900">
            <p className="font-medium">Attestation annulée</p>
            <p>{a.cancellation_reason}</p>
            <p className="text-xs text-amber-800 mt-1">
              Elle reste consultable : son destinataire en détient peut-être une
              copie, et faire disparaître le document ferait disparaître la
              trace de ce qui a été affirmé.
            </p>
          </div>
        </div>
      )}

      <p className="text-sm text-slate-500 mb-5">
        {ATTESTATION_KIND_EXPLICATIONS[a.kind]}
      </p>

      <div className="space-y-6">
        {modifiable ? (
          <Card className="p-5">
            <h2 className="font-semibold text-slate-800 mb-4">
              Période et destinataire
            </h2>
            <EnteteAttestation
              attestation={a}
              contacts={contacts.map((c) => ({ id: c.id, nom: contactName(c) }))}
            />
          </Card>
        ) : (
          <Card className="p-5">
            <h2 className="font-semibold text-slate-800 mb-3">Récapitulatif</h2>
            <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <Ligne terme="Nature" valeur={ATTESTATION_KIND_LABELS[a.kind]} />
              {a.number && <Ligne terme="Numéro" valeur={a.number} />}
              {a.issued_on && (
                <Ligne terme="Signée le" valeur={frDate(a.issued_on)} />
              )}
              {(a.period_start || a.period_end) && (
                <Ligne
                  terme="Période attestée"
                  valeur={[
                    a.period_start && `du ${frDate(a.period_start)}`,
                    a.period_end && `au ${frDate(a.period_end)}`,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                />
              )}
              <Ligne
                terme="Remise à"
                valeur={
                  a.snapshot?.destinataire?.nom?.trim() ||
                  complete.patient_nom ||
                  "Non précisé"
                }
              />
              {a.kind === "presence" ? (
                <Ligne
                  terme="Séances attestées"
                  valeur={String(a.sessions_count)}
                />
              ) : (
                <Ligne terme="Montant attesté" valeur={formatCents(a.total_cents)} />
              )}
            </dl>
            {a.note && (
              <p className="text-sm text-slate-600 whitespace-pre-wrap mt-3 pt-3 border-t border-slate-100">
                {a.note}
              </p>
            )}
            {a.internal_note && (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                  Note interne — jamais imprimée
                </p>
                <p className="text-sm text-slate-600 whitespace-pre-wrap mt-0.5">
                  {a.internal_note}
                </p>
              </div>
            )}
          </Card>
        )}

        <Card>
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">
              {a.kind === "presence" ? "Séances attestées" : "Règlements attestés"}
            </h2>
            {!modifiable && a.status === "emis" && (
              <Link
                href={`/comptabilite/attestations/${a.id}/document`}
                className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-brand-700"
              >
                <Printer className="h-4 w-4" aria-hidden="true" />
                Document imprimable
              </Link>
            )}
          </div>

          {modifiable ? (
            <FaitsAttestes
              attestationId={a.id}
              kind={a.kind}
              seances={seances}
              reglements={reglements}
              choisies={choisies}
              modifiable={modifiable}
            />
          ) : a.kind === "presence" ? (
            <ul className="list-none p-0 m-0 divide-y divide-slate-50">
              {complete.seances.map((s) => (
                <li key={s.appointment_id} className="px-5 py-2.5 text-sm text-slate-700">
                  {frDate(s.starts_at.slice(0, 10))}
                  <span className="text-slate-400">
                    {" · "}
                    {a.detail_nature
                      ? (NATURE_ACTE_LABELS[s.kind] ?? s.kind)
                      : "Séance de psychomotricité"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="list-none p-0 m-0 divide-y divide-slate-50">
              {complete.reglements.map((r) => (
                <li key={r.payment_id} className="px-5 py-2.5 text-sm text-slate-700">
                  {formatCents(r.amount_cents)}
                  <span className="text-slate-400">
                    {" · "}
                    {frDate(r.received_on)}
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

function Ligne({ terme, valeur }: { terme: string; valeur: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{terme}</dt>
      <dd className="text-slate-700">{valeur}</dd>
    </div>
  );
}
