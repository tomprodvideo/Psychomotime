"use client";

import { useState, useTransition } from "react";
import { AlertTriangle } from "lucide-react";
import { deleteAccount } from "./actions";

export default function DeleteAccountCard() {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [pending, start] = useTransition();

  return (
    <div className="bg-white rounded-xl border border-rose-200 shadow-sm p-5">
      <h2 className="font-semibold text-rose-700 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" />
        Supprimer mon compte
      </h2>
      <p className="text-sm text-slate-500 mt-1">
        Cette action est <strong>définitive</strong>. Toutes vos données
        (patients, bilans, factures, documents…) seront supprimées et ne
        pourront pas être récupérées.
      </p>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 text-sm font-medium text-rose-600 hover:bg-rose-50 border border-rose-200 px-4 py-2 rounded-lg"
        >
          Supprimer mon compte
        </button>
      ) : (
        <div className="mt-4 bg-rose-50 border border-rose-200 rounded-lg p-4">
          <p className="text-sm text-slate-700 mb-2">
            Pour confirmer, tapez <strong>SUPPRIMER</strong> ci-dessous :
          </p>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="SUPPRIMER"
            className="w-full max-w-xs rounded-lg border border-slate-300 py-2 px-3 text-sm outline-none focus:border-rose-400 mb-3"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={confirmText.trim() !== "SUPPRIMER" || pending}
              onClick={() => start(() => deleteAccount())}
              className="text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 px-4 py-2 rounded-lg disabled:opacity-50"
            >
              {pending ? "Suppression…" : "Confirmer la suppression définitive"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setConfirmText("");
              }}
              className="text-sm text-slate-600 hover:bg-slate-100 px-4 py-2 rounded-lg"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
