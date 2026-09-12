"use client";

import { useState, useTransition } from "react";
import { Save } from "lucide-react";
import {
  BILLING_FUNDING_LABELS,
  type BillingDocument,
  type BillingFundingScheme,
} from "@/lib/compta/types";
import { enregistrerPiece } from "../actions";

interface Option {
  id: string;
  nom: string;
}

/**
 * En-tête d'un brouillon.
 *
 * Ce formulaire n'existe QUE pour un brouillon : une pièce émise se corrige par
 * un avoir ou une facture de remplacement, et la base refuse toute autre voie.
 * L'interface ne le propose donc pas, pour ne pas laisser croire à une
 * modification qui sera rejetée.
 */
export default function EnteteForm({
  document,
  patients,
  contacts,
  parcours,
}: {
  document: BillingDocument;
  patients: Option[];
  contacts: Option[];
  parcours: Option[];
}) {
  const [enCours, demarrer] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [payeurTiers, setPayeurTiers] = useState(
    document.payer_contact_id !== null,
  );

  function enregistrer(fd: FormData) {
    setErreur(null);
    setMessage(null);
    demarrer(async () => {
      const r = await enregistrerPiece(fd);
      if (r.ok) setMessage(r.message ?? "Enregistré.");
      else setErreur(r.error ?? "L'enregistrement a échoué.");
    });
  }

  const estDevis = document.kind === "devis";

  return (
    <form action={enregistrer} className="space-y-4">
      <input type="hidden" name="document_id" value={document.id} />

      <div className="grid sm:grid-cols-2 gap-4">
        <Champ label="Patient" htmlFor="patient_id">
          <select
            id="patient_id"
            name="patient_id"
            defaultValue={document.patient_id ?? ""}
            className={styleChamp}
          >
            <option value="">Aucun patient rattaché</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nom}
              </option>
            ))}
          </select>
        </Champ>

        <Champ label="Parcours de soin" htmlFor="pathway_id">
          <select
            id="pathway_id"
            name="pathway_id"
            defaultValue={document.pathway_id ?? ""}
            className={styleChamp}
          >
            <option value="">Aucun</option>
            {parcours.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nom}
              </option>
            ))}
          </select>
        </Champ>
      </div>

      <fieldset className="rounded-xl border border-slate-100 p-4">
        <legend className="text-sm font-medium text-slate-700 px-1">
          Destinataire
        </legend>
        <p className="text-xs text-slate-500 mb-3">
          Par défaut, la pièce est adressée au patient. Un parent, un organisme
          ou une plateforme peut être le payeur sans être le patient — et c&apos;est
          alors son nom qui s&apos;imprime.
        </p>
        <label className="flex items-center gap-2 text-sm text-slate-700 mb-3">
          <input
            type="checkbox"
            name="payer_tiers"
            checked={payeurTiers}
            onChange={(e) => setPayeurTiers(e.target.checked)}
            className="rounded border-slate-300"
          />
          Adresser à un tiers
        </label>
        {payeurTiers && (
          <select
            name="payer_contact_id"
            aria-label="Destinataire de la pièce"
            defaultValue={document.payer_contact_id ?? ""}
            className={styleChamp}
          >
            <option value="">Choisir un contact…</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
              </option>
            ))}
          </select>
        )}
      </fieldset>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Champ label="Mode de financement" htmlFor="funding_scheme">
          <select
            id="funding_scheme"
            name="funding_scheme"
            defaultValue={document.funding_scheme ?? ""}
            className={styleChamp}
          >
            <option value="">Non précisé</option>
            {(
              Object.keys(BILLING_FUNDING_LABELS) as BillingFundingScheme[]
            ).map((f) => (
              <option key={f} value={f}>
                {BILLING_FUNDING_LABELS[f]}
              </option>
            ))}
          </select>
        </Champ>

        {estDevis ? (
          <Champ label="Valable jusqu'au" htmlFor="valid_until">
            <input
              id="valid_until"
              name="valid_until"
              type="date"
              defaultValue={document.valid_until ?? ""}
              className={styleChamp}
            />
          </Champ>
        ) : (
          <Champ label="Échéance de règlement" htmlFor="due_on">
            <input
              id="due_on"
              name="due_on"
              type="date"
              defaultValue={document.due_on ?? ""}
              className={styleChamp}
            />
          </Champ>
        )}

        <Champ
          label="Période — début"
          htmlFor="period_start"
          aide="Rattachement comptable"
        >
          <input
            id="period_start"
            name="period_start"
            type="date"
            defaultValue={document.period_start ?? ""}
            className={styleChamp}
          />
        </Champ>

        <Champ label="Période — fin" htmlFor="period_end">
          <input
            id="period_end"
            name="period_end"
            type="date"
            defaultValue={document.period_end ?? ""}
            className={styleChamp}
          />
        </Champ>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Champ
          label="Mention sur le document"
          htmlFor="note"
          aide="Visible par le destinataire"
        >
          <textarea
            id="note"
            name="note"
            rows={2}
            defaultValue={document.note ?? ""}
            className={styleChamp}
          />
        </Champ>
        <Champ
          label="Note interne"
          htmlFor="internal_note"
          aide="Jamais imprimée, jamais transmise"
        >
          <textarea
            id="internal_note"
            name="internal_note"
            rows={2}
            defaultValue={document.internal_note ?? ""}
            className={styleChamp}
          />
        </Champ>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={enCours}
          className="inline-flex items-center gap-2 bg-slate-700 hover:bg-slate-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50"
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          {enCours ? "Enregistrement…" : "Enregistrer"}
        </button>
        {message && (
          <p role="status" className="text-sm text-emerald-700">
            {message}
          </p>
        )}
        {erreur && (
          <p role="alert" className="text-sm text-rose-700">
            {erreur}
          </p>
        )}
      </div>
    </form>
  );
}

const styleChamp =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-200";

function Champ({
  label,
  htmlFor,
  aide,
  children,
}: {
  label: string;
  htmlFor: string;
  aide?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-xs font-medium text-slate-500 mb-1"
      >
        {label}
      </label>
      {children}
      {aide && <p className="text-xs text-slate-400 mt-1">{aide}</p>}
    </div>
  );
}
