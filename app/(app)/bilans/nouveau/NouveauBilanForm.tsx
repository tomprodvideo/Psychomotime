"use client";

import { useState } from "react";
import type { Patient } from "@/lib/types";
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

  const selected = patients.find((p) => p.id === patientId);

  return (
    <form action={createBilan} className="space-y-5">
      <input type="hidden" name="patient_id" value={patientId} />

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
        <input
          name="patient_name"
          required
          value={patientName}
          onChange={(e) => {
            setPatientName(e.target.value);
            setPatientId("");
          }}
          placeholder="Prénom et nom du patient"
          className={inputCls}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label>Titre du bilan</Label>
          <input
            name="title"
            defaultValue="Bilan psychomoteur"
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
        <button
          type="submit"
          className="px-5 py-2.5 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm"
        >
          Créer et rédiger
        </button>
      </div>
    </form>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition";

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-slate-500 mb-1">
      {children}
    </label>
  );
}
