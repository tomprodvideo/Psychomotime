"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FilePlus2 } from "lucide-react";
import {
  ATTESTATION_KIND_EXPLICATIONS,
  ATTESTATION_KIND_LABELS,
  type AttestationKind,
} from "@/lib/attestations/types";
import { creerAttestation } from "./actions";

interface OptionPatient {
  id: string;
  nom: string;
}

/**
 * Ouvrir une attestation.
 *
 * LE CHOIX DE LA NATURE EST EXPLIQUÉ AU MOMENT DE LE FAIRE. Présence et
 * paiement ne disent pas la même chose, et c'est ici — pas sur le document
 * remis — que la confusion doit être évitée.
 */
export default function NouvelleAttestation({
  patients,
  patientImpose,
  libelle = "Nouvelle attestation",
}: {
  patients: OptionPatient[];
  /** Depuis une fiche patient : le dossier est déjà connu. */
  patientImpose?: string;
  libelle?: string;
}) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [kind, setKind] = useState<AttestationKind>("presence");
  const [patient, setPatient] = useState(patientImpose ?? "");

  function creer() {
    setErreur(null);
    demarrer(async () => {
      const fd = new FormData();
      fd.set("kind", kind);
      fd.set("patient_id", patient);
      const r = await creerAttestation(fd);
      if (r.ok && r.id) router.push(`/comptabilite/attestations/${r.id}`);
      else setErreur(r.error ?? "La création a échoué.");
    });
  }

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition shadow-sm"
      >
        <FilePlus2 className="h-4 w-4" aria-hidden="true" />
        {libelle}
      </button>
    );
  }

  return (
    <div className="w-full sm:w-[30rem] rounded-xl border border-slate-200 bg-white shadow-sm p-4 text-left">
      <h3 className="font-medium text-slate-800 mb-3">Nouvelle attestation</h3>

      <fieldset className="space-y-2 mb-4">
        <legend className="sr-only">Nature de l&apos;attestation</legend>
        {(Object.keys(ATTESTATION_KIND_LABELS) as AttestationKind[]).map((k) => (
          <label
            key={k}
            className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition ${
              kind === k
                ? "border-brand-300 bg-brand-50"
                : "border-slate-200 hover:bg-slate-50"
            }`}
          >
            <input
              type="radio"
              name="kind"
              value={k}
              checked={kind === k}
              onChange={() => setKind(k)}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-medium text-slate-800">
                {ATTESTATION_KIND_LABELS[k]}
              </span>
              <span className="block text-xs text-slate-500 mt-0.5">
                {ATTESTATION_KIND_EXPLICATIONS[k]}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      {!patientImpose && (
        <div className="mb-4">
          <label
            htmlFor="patient-attestation"
            className="block text-xs font-medium text-slate-500 mb-1"
          >
            Dossier concerné
          </label>
          <select
            id="patient-attestation"
            value={patient}
            onChange={(e) => setPatient(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
          >
            <option value="">Choisir…</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nom}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={creer}
          disabled={enCours || patient === ""}
          className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-40"
        >
          {enCours ? "Création…" : "Créer le brouillon"}
        </button>
        <button
          type="button"
          onClick={() => setOuvert(false)}
          className="text-sm text-slate-500 px-3 py-2"
        >
          Annuler
        </button>
        {erreur && (
          <p role="alert" className="text-sm text-rose-700">
            {erreur}
          </p>
        )}
      </div>
    </div>
  );
}
