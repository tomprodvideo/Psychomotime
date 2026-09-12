"use client";

import { useState, useTransition } from "react";
import { Archive, ArchiveRestore } from "lucide-react";
import { archivePatient, unarchivePatient } from "../actions";

/**
 * Archivage d'un dossier.
 *
 * Il n'y a PAS de bouton « supprimer ». Un dossier de santé porte des pièces
 * comptables et des durées de conservation qui ne sont pas celles du confort
 * d'affichage. L'archivage sort le dossier des listes actives sans rien
 * effacer ; l'effacement, quand il sera possible, sera une opération distincte
 * et motivée.
 */
export default function ArchiveControls({
  patientId,
  archived,
  reason,
}: {
  patientId: string;
  archived: boolean;
  reason: string | null;
}) {
  const [pending, start] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [saisie, setSaisie] = useState(false);
  const [motif, setMotif] = useState(reason ?? "");

  const archiver = () => {
    const fd = new FormData();
    fd.set("id", patientId);
    fd.set("reason", motif);
    setErreur(null);
    start(async () => {
      const res = await archivePatient(fd);
      if (!res.ok) setErreur(res.error);
      else setSaisie(false);
    });
  };

  const rouvrir = () => {
    const fd = new FormData();
    fd.set("id", patientId);
    setErreur(null);
    start(async () => {
      const res = await unarchivePatient(fd);
      if (!res.ok) setErreur(res.error);
    });
  };

  if (archived) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={rouvrir}
          disabled={pending}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg disabled:opacity-60"
        >
          <ArchiveRestore className="h-4 w-4" aria-hidden="true" />
          {pending ? "…" : "Rouvrir le dossier"}
        </button>
        {erreur && (
          <p role="alert" className="text-xs text-red-700">
            {erreur}
          </p>
        )}
      </div>
    );
  }

  if (saisie) {
    return (
      <div className="w-full sm:w-80 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <label htmlFor="motif-archive" className="block text-sm text-slate-700 mb-1">
          Motif de l&apos;archivage
        </label>
        <input
          id="motif-archive"
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          placeholder="Fin de suivi, déménagement, relais transmis…"
          className="w-full rounded-lg border border-slate-500 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        />
        <p className="text-xs text-slate-500 mt-1.5">
          Les parcours encore ouverts seront clos. Rien n&apos;est effacé.
        </p>
        {erreur && (
          <p role="alert" className="text-xs text-red-700 mt-1">
            {erreur}
          </p>
        )}
        <div className="flex justify-end gap-2 mt-2">
          <button
            type="button"
            onClick={() => setSaisie(false)}
            className="text-sm text-slate-600 hover:bg-slate-100 px-3 py-1.5 rounded-lg"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={archiver}
            disabled={pending}
            className="text-sm text-white bg-slate-700 hover:bg-slate-800 px-3 py-1.5 rounded-lg disabled:opacity-60"
          >
            {pending ? "…" : "Archiver"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setSaisie(true)}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 px-3 py-1.5 rounded-lg"
    >
      <Archive className="h-4 w-4" aria-hidden="true" />
      Archiver
    </button>
  );
}
