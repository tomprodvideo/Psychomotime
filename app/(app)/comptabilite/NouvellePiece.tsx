"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FilePlus2, FileText } from "lucide-react";
import { creerPiece } from "./actions";

/**
 * Ouvre un brouillon et y conduit.
 *
 * Aucun numéro n'est consommé ici : c'est l'émission qui en attribue un.
 * Ouvrir un formulaire puis l'abandonner ne laisse donc aucun trou dans la
 * série — ce que la v1 ne garantissait pas.
 */
export default function NouvellePiece() {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  function creer(kind: "facture" | "devis") {
    setErreur(null);
    demarrer(async () => {
      const fd = new FormData();
      fd.set("kind", kind);
      const r = await creerPiece(fd);
      if (r.ok && r.id) router.push(`/comptabilite/${r.id}`);
      else setErreur(r.error ?? "La création a échoué.");
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => creer("devis")}
          disabled={enCours}
          className="inline-flex items-center gap-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium px-3 py-2 rounded-lg transition disabled:opacity-50"
        >
          <FileText className="h-4 w-4" aria-hidden="true" />
          Devis
        </button>
        <button
          type="button"
          onClick={() => creer("facture")}
          disabled={enCours}
          className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition shadow-sm disabled:opacity-50"
        >
          <FilePlus2 className="h-4 w-4" aria-hidden="true" />
          Nouvelle facture
        </button>
      </div>
      {erreur && (
        <p role="alert" className="text-xs text-rose-600">
          {erreur}
        </p>
      )}
    </div>
  );
}
