"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import type { PatientContact } from "@/lib/types";
import { savePatient } from "../patients/actions";

/**
 * Création express d'un patient depuis une facture : juste de quoi identifier
 * la personne. Le dossier complet (coordonnées, tuteur, suivi) se remplit
 * ensuite dans l'onglet Patients.
 */
export default function QuickPatientDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (patient: PatientContact) => void;
}) {
  const [pending, start] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setErreur(null);
    start(async () => {
      const res = await savePatient(fd);
      if (res.error || !res.patient) {
        setErreur(res.error ?? "Le patient n'a pas pu être créé.");
        return;
      }
      onSaved(res.patient);
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start sm:items-center justify-center bg-slate-900/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Nouveau patient</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Prénom</Label>
              <input name="first_name" required autoFocus className={inputCls} />
            </div>
            <div>
              <Label>Nom</Label>
              <input name="last_name" className={inputCls} />
            </div>
            <div className="col-span-2">
              <Label>Date de naissance</Label>
              <input name="birth_date" type="date" className={inputCls} />
            </div>
          </div>

          <p className="text-xs text-slate-400">
            Coordonnées, tuteur et dossier de suivi se complètent ensuite dans
            l&apos;onglet Patients.
          </p>

          {erreur && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200"
            >
              {erreur}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={pending}
              className="px-5 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg disabled:opacity-60"
            >
              {pending ? "Création…" : "Créer le patient"}
            </button>
          </div>
        </form>
      </div>
    </div>
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
