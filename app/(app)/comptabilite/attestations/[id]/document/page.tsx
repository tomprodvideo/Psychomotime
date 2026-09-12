import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { formatCents } from "@/lib/money";
import { frDate } from "@/lib/format";
import { getCurrentPractice } from "@/lib/dossier/practice";
import { getAttestation } from "@/lib/attestations/queries";
import { libelleActe } from "@/lib/attestations/types";
import type { AttestationSnapshot } from "@/lib/attestations/types";
import BoutonImprimer from "../../../[id]/document/BoutonImprimer";

/**
 * L'attestation telle qu'elle est remise.
 *
 * TOUT CE QUI S'IMPRIME VIENT DE L'INSTANTANÉ, figé à la signature. Un
 * rendez-vous peut être requalifié, un patient déménager, un praticien changer
 * de numéro professionnel : le document déjà remis ne change pas. Le relire
 * avec les données du jour produirait une attestation qui n'a jamais existé.
 *
 * CE QUI N'Y ENTRE PAS : la note interne, le motif de la demande, le parcours
 * de soin, la moindre observation. Ce document part chez un employeur, une
 * mutuelle, une administration — il dit qu'une personne est venue, ou qu'une
 * somme a été reçue, et rien d'autre.
 */
export default async function DocumentAttestationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const practice = await getCurrentPractice();
  if (!practice) notFound();

  const complete = await getAttestation(practice, id);
  if (!complete) notFound();

  const a = complete.attestation;
  if (a.status === "brouillon") {
    // Un brouillon ne s'imprime pas : il n'est ni numéroté ni signé, et
    // sortirait de l'imprimante indiscernable d'un document définitif.
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <Link
          href={`/comptabilite/attestations/${a.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Retour à l&apos;attestation
        </Link>
        <p className="text-slate-600">
          Ce brouillon n&apos;est pas signé. Signez-le pour obtenir le document
          à remettre.
        </p>
      </div>
    );
  }

  const s: AttestationSnapshot = a.snapshot ?? {};
  const emetteur = s.entite_juridique;
  const identifiants = (s.identifiants ?? []).filter((i) => i?.valeur);
  const destinataire = s.destinataire?.nom?.trim() ? s.destinataire : null;
  const seances = s.seances ?? [];
  const reglements = s.reglements ?? [];
  const factures = (s.factures ?? []).filter((f) => f?.numero);
  const signataire = s.praticien;
  const patient = s.patient;

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5 no-print">
        <Link
          href={`/comptabilite/attestations/${a.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Retour à l&apos;attestation
        </Link>
        <BoutonImprimer />
      </div>

      <article className="print-area bg-white rounded-xl border border-slate-100 shadow-sm p-8 sm:p-10">
        {/* Une attestation annulée ne doit JAMAIS ressortir de l'imprimante
            comme si elle valait encore. */}
        {a.status === "annule" && (
          <p className="border-2 border-rose-400 text-rose-700 font-semibold text-center py-2 mb-8 tracking-wide">
            ATTESTATION ANNULÉE
            {a.cancellation_reason && (
              <span className="block text-xs font-normal mt-0.5">
                {a.cancellation_reason}
              </span>
            )}
          </p>
        )}

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
            <h1 className="text-xl font-semibold text-brand-700 tracking-tight uppercase">
              {a.kind === "presence"
                ? "Attestation de présence"
                : "Attestation de paiement"}
            </h1>
            <p className="text-slate-700 mt-1">{a.number}</p>
            {a.issued_on && (
              <p className="text-slate-500">{frDate(a.issued_on)}</p>
            )}
          </div>
        </header>

        {destinataire && (
          <section className="mb-8 text-sm">
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">
              Remise à
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

        <section className="text-sm text-slate-800 leading-relaxed space-y-4">
          <p>
            Je soussigné(e){" "}
            <strong className="font-medium">
              {signataire?.nom?.trim() || "—"}
            </strong>
            {signataire?.titre && `, ${signataire.titre}`}, atteste que :
          </p>

          <p className="pl-4">
            <strong className="font-medium">{patient?.nom?.trim() || "—"}</strong>
            {patient?.ne_le && `, né(e) le ${frDate(patient.ne_le)}`}
          </p>

          {a.kind === "presence" ? (
            <>
              <p>
                a été reçu(e) en séance de psychomotricité
                {a.period_start && ` du ${frDate(a.period_start)}`}
                {a.period_end && ` au ${frDate(a.period_end)}`}, aux dates
                suivantes :
              </p>
              <ul className="pl-4 list-none m-0 space-y-0.5">
                {seances.map((x, i) => (
                  <li key={`${x.date}-${i}`} className="text-slate-700">
                    {x.date ? frDate(x.date) : "—"}
                    {a.detail_nature && x.nature && (
                      <span className="text-slate-500">
                        {" — "}
                        {libelleActe(x.nature, true)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <p>
                soit <strong className="font-medium">{seances.length}</strong>{" "}
                séance{seances.length > 1 ? "s" : ""}.
              </p>
            </>
          ) : (
            <>
              <p>
                a réglé la somme de{" "}
                <strong className="font-medium">
                  {formatCents(a.total_cents)}
                </strong>{" "}
                au titre de séances de psychomotricité
                {a.period_start && ` du ${frDate(a.period_start)}`}
                {a.period_end && ` au ${frDate(a.period_end)}`}.
              </p>
              {reglements.length > 0 && (
                <>
                  <p>Règlements reçus :</p>
                  <ul className="pl-4 list-none m-0 space-y-0.5">
                    {reglements.map((r, i) => (
                      <li key={`${r.date}-${i}`} className="text-slate-700">
                        {r.date ? frDate(r.date) : "—"} —{" "}
                        {formatCents(r.montant_centimes ?? 0)}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {factures.length > 0 && (
                <p className="text-slate-600">
                  Facture{factures.length > 1 ? "s" : ""} concernée
                  {factures.length > 1 ? "s" : ""} :{" "}
                  {factures.map((f) => f.numero).join(", ")}.
                </p>
              )}
            </>
          )}

          {a.note && <p className="whitespace-pre-wrap">{a.note}</p>}

          <p className="text-slate-600">
            Attestation établie pour faire valoir ce que de droit.
          </p>
        </section>

        <footer className="mt-12 text-sm text-right">
          {a.issued_on && (
            <p className="text-slate-600">Le {frDate(a.issued_on)}</p>
          )}
          <p className="text-slate-800 font-medium mt-6">
            {signataire?.nom?.trim() || ""}
          </p>
          {signataire?.titre && (
            <p className="text-slate-600 text-xs">{signataire.titre}</p>
          )}
        </footer>
      </article>

      <p className="text-xs text-slate-400 mt-4 no-print">
        Ce document est rendu à partir de l&apos;instantané figé à la signature :
        il ne changera plus, quelles que soient les modifications apportées
        ensuite au dossier ou à l&apos;agenda.
      </p>
    </div>
  );
}
