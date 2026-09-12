import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { formatCents } from "@/lib/money";
import { frDate } from "@/lib/format";
import type { AttestationListItem } from "@/lib/attestations/queries";
import {
  ATTESTATION_KIND_SHORT,
  ATTESTATION_STATUS_LABELS,
} from "@/lib/attestations/types";
import NouvelleAttestation from "../../comptabilite/attestations/NouvelleAttestation";

/**
 * Les attestations établies pour ce dossier.
 *
 * ELLES SE CRÉENT D'ICI, et c'est délibéré : une attestation part toujours des
 * faits d'un dossier — des séances honorées, des règlements imputés. Devoir la
 * commencer depuis un écran comptable puis y rechercher le patient inverserait
 * le chemin réel.
 */
export default function AttestationsSection({
  patientId,
  attestations,
  canWrite,
}: {
  patientId: string;
  attestations: AttestationListItem[];
  canWrite: boolean;
}) {
  return (
    <section
      aria-labelledby="titre-attestations"
      className="bg-white rounded-xl border border-slate-100 shadow-sm p-5"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 id="titre-attestations" className="font-semibold text-slate-800">
            Attestations
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Présence et paiement. Elles s&apos;appuient sur les séances honorées
            de l&apos;agenda et sur les règlements imputés — aucune date ne se
            saisit à la main.
          </p>
        </div>
        {canWrite && (
          <NouvelleAttestation
            patients={[]}
            patientImpose={patientId}
            libelle="Attester"
          />
        )}
      </div>

      {attestations.length === 0 ? (
        <p className="text-sm text-slate-500">
          Aucune attestation pour ce dossier.
        </p>
      ) : (
        <ul className="space-y-1.5 list-none p-0 m-0">
          {attestations.map((a) => (
            <li key={a.id} className="text-sm">
              <Link
                href={`/comptabilite/attestations/${a.id}`}
                className={`hover:text-brand-700 hover:underline ${
                  a.status === "annule"
                    ? "text-slate-500 line-through"
                    : "text-slate-700"
                }`}
              >
                <ShieldCheck
                  className="inline h-3.5 w-3.5 text-slate-500 mr-1.5"
                  aria-hidden="true"
                />
                {a.number ?? "Brouillon"}
              </Link>
              <span className="block text-xs text-slate-500 ml-5">
                {ATTESTATION_KIND_SHORT[a.kind]}
                {" · "}
                {a.issued_on ? frDate(a.issued_on) : "non signée"}
                {" · "}
                {a.kind === "presence"
                  ? `${a.sessions_count} séance${a.sessions_count > 1 ? "s" : ""}`
                  : formatCents(a.total_cents)}
                {a.status !== "emis" && (
                  <span className="text-amber-700">
                    {" · "}
                    {ATTESTATION_STATUS_LABELS[a.status]}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
