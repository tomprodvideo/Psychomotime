"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import type { Patient } from "@/lib/types";
import { savePatient } from "./actions";

export default function PatientFormDialog({
  patient,
  trigger,
}: {
  patient?: Patient;
  trigger?: "button" | "link";
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      await savePatient(fd);
      setOpen(false);
    });
  }

  return (
    <>
      {patient ? (
        <button
          onClick={() => setOpen(true)}
          className="text-sm font-medium text-brand-700 hover:bg-brand-50 px-3 py-1.5 rounded-lg"
        >
          Modifier
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Nouveau patient
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-slate-900/40 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800">
                {patient ? "Modifier le patient" : "Nouveau patient"}
              </h2>
              <button onClick={() => setOpen(false)}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {patient && <input type="hidden" name="id" value={patient.id} />}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Prénom</Label>
                  <input
                    name="first_name"
                    required
                    defaultValue={patient?.first_name ?? ""}
                    className={inputCls}
                  />
                </div>
                <div>
                  <Label>Nom</Label>
                  <input
                    name="last_name"
                    defaultValue={patient?.last_name ?? ""}
                    className={inputCls}
                  />
                </div>
                <div>
                  <Label>Date de naissance</Label>
                  <input
                    name="birth_date"
                    type="date"
                    defaultValue={patient?.birth_date ?? ""}
                    className={inputCls}
                  />
                </div>
                <div>
                  <Label>Téléphone</Label>
                  <input
                    name="phone"
                    defaultValue={patient?.phone ?? ""}
                    className={inputCls}
                  />
                </div>
                <div className="col-span-2">
                  <Label>Email</Label>
                  <input
                    name="email"
                    type="email"
                    defaultValue={patient?.email ?? ""}
                    className={inputCls}
                  />
                </div>
                <div className="col-span-2">
                  <Label>Notes</Label>
                  <textarea
                    name="notes"
                    rows={3}
                    defaultValue={patient?.notes ?? ""}
                    className={inputCls}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="px-5 py-2 text-sm text-white bg-brand-600 hover:bg-brand-700 rounded-lg disabled:opacity-60"
                >
                  {pending ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
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
