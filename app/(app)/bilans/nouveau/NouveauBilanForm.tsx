"use client";

import { useState } from "react";
import { estUneRetouche } from "@/lib/bilans/rattachement";
import { useFormStatus } from "react-dom";
import type { Patient } from "@/lib/types";
import { BILAN_TYPES, type BilanType } from "@/lib/constants";
import { ageFromBirth, frDate } from "@/lib/format";
import { createBilan } from "../actions";

type PatientLite = Pick<Patient, "id" | "first_name" | "last_name" | "birth_date">;

export default function NouveauBilanForm({
  patients,
  defaultAuthor,
  defaultPatientId,
  today,
}: {
  patients: PatientLite[];
  defaultAuthor: string;
  defaultPatientId?: string;
  today: string;
}) {
  const initial = patients.find((p) => p.id === defaultPatientId);
  const [patientId, setPatientId] = useState(defaultPatientId ?? "");
  const [patientName, setPatientName] = useState(
    initial ? `${initial.first_name} ${initial.last_name}`.trim() : "",
  );
  const [type, setType] = useState<BilanType>("psychomoteur");
  const [title, setTitle] = useState("Bilan psychomoteur");

  const selected = patients.find((p) => p.id === patientId);

  return (
    <form action={createBilan} className="space-y-5">
      <input type="hidden" name="patient_id" value={patientId} />
      <input type="hidden" name="bilan_type" value={type} />

      {/* Type de bilan */}
      <div>
        <Label>Type de bilan</Label>
        <div className="grid sm:grid-cols-2 gap-3">
          {BILAN_TYPES.map((bt) => {
            const active = type === bt.id;
            return (
              <button
                key={bt.id}
                type="button"
                onClick={() => {
                  setType(bt.id);
                  setTitle(bt.label);
                }}
                className={`text-left rounded-xl border p-3 transition ${
                  active
                    ? "border-brand-500 bg-brand-50 ring-2 ring-brand-100"
                    : "border-slate-200 hover:border-brand-300"
                }`}
              >
                <p className="font-medium text-slate-800 text-sm">{bt.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{bt.hint}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* En-tête patient */}
      {selected && (
        <div className="bg-brand-50 border border-brand-100 rounded-xl p-4 flex items-center gap-3">
          <div className="h-11 w-11 rounded-full bg-brand-600 text-white flex items-center justify-center font-semibold uppercase">
            {(selected.first_name?.[0] ?? "") + (selected.last_name?.[0] ?? "")}
          </div>
          <div>
            <p className="font-semibold text-slate-800">
              {selected.first_name} {selected.last_name}
            </p>
            <p className="text-sm text-slate-500">
              {selected.birth_date
                ? `Né(e) le ${frDate(selected.birth_date)} · ${ageFromBirth(selected.birth_date)}`
                : "Date de naissance non renseignée"}
            </p>
          </div>
        </div>
      )}

      <div>
        <Label>Patient</Label>
        {patients.length > 0 && (
          <select
            className={`${inputCls} mb-2`}
            value={patientId}
            onChange={(e) => {
              const p = patients.find((x) => x.id === e.target.value);
              setPatientId(e.target.value);
              if (p) setPatientName(`${p.first_name} ${p.last_name}`.trim());
            }}
          >
            <option value="">— Choisir un patient existant —</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.first_name} {p.last_name}
              </option>
            ))}
          </select>
        )}
        {/* CORRIGER LE NOM NE DÉTACHE PLUS LE BILAN DU DOSSIER.
          *
          * Cette saisie effaçait l'identifiant du patient à chaque frappe.
          * Choisir « Zéphyr Pirouette » dans la liste puis corriger une
          * coquille suffisait donc à rompre le lien : le bilan disparaissait de
          * la fiche, perdait la date de naissance et l'âge, et plus rien ne
          * proposait de le rattacher. C'est le risque n° 1 de la sécurité
          * clinique — l'attribution au mauvais dossier — atteignable en deux
          * frappes, et documenté § C-6.
          *
          * Le lien ne se rompt plus que si le nom s'éloigne VRAIMENT de celui
          * du dossier choisi : un bilan peut légitimement être établi pour
          * quelqu'un qui n'a pas encore de dossier, et forcer le rattachement
          * serait aussi faux que l'inverse. */}
        <input
          name="patient_name"
          required
          value={patientName}
          onChange={(e) => {
            const saisi = e.target.value;
            setPatientName(saisi);
            if (!patientId) return;
            const p = patients.find((x) => x.id === patientId);
            const duDossier = p ? `${p.first_name} ${p.last_name}`.trim() : "";
            if (!estUneRetouche(saisi, duDossier)) setPatientId("");
          }}
          placeholder="Prénom et nom du patient"
          className={inputCls}
          aria-describedby={patientId ? "lien-dossier" : undefined}
        />
        {/* L'état du rattachement est ÉCRIT, pas deviné. Sans cela, rien à
          * l'écran ne distingue un bilan rattaché d'un bilan orphelin. */}
        <p
          id="lien-dossier"
          className={`text-xs mt-1 ${patientId ? "text-brand-700" : "text-amber-700"}`}
        >
          {patientId
            ? "Ce bilan est rattaché au dossier : il apparaîtra dans la fiche du patient."
            : "Ce bilan n'est rattaché à aucun dossier. Il n'apparaîtra pas dans une fiche patient."}
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label>Titre du bilan</Label>
          <input
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <Label>Date du bilan</Label>
          <input
            name="bilan_date"
            type="date"
            defaultValue={today}
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <Label>Rédigé par</Label>
        <input
          name="author"
          defaultValue={defaultAuthor}
          placeholder="Nom du psychomotricien(ne)"
          className={inputCls}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <SubmitButton />
      </div>
    </form>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-500 bg-white py-2 px-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition";

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-slate-500 mb-1">
      {children}
    </label>
  );
}

/** Bouton d'envoi désactivé pendant la soumission : évite les doubles clics,
 *  donc les bilans créés en double. */
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-5 py-2.5 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {pending ? "Création…" : "Créer et rédiger"}
    </button>
  );
}
