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
 *
 * `patientId` ouvre le brouillon DÉJÀ RATTACHÉ au dossier. Le serveur savait
 * le faire depuis toujours — `creerPiece` lit `patient_id` du formulaire —
 * mais aucun écran ne l'envoyait jamais : facturer une séance obligeait à
 * quitter le dossier, ouvrir la comptabilité, créer une facture, puis
 * retrouver le patient dans une liste qu'on venait de parcourir. Six gestes,
 * dont une recherche de nom déjà faite. Relevé par la relecture d'interface.
 *
 * La base vérifie de son côté que le dossier appartient au cabinet : ce
 * raccourci n'ouvre rien qu'elle n'accepterait pas.
 */
export default function NouvellePiece({
  patientId,
  compact,
}: {
  patientId?: string;
  /** Sur une fiche de dossier, un seul bouton suffit — la facture. */
  compact?: boolean;
} = {}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  function creer(kind: "facture" | "devis") {
    setErreur(null);
    demarrer(async () => {
      const fd = new FormData();
      fd.set("kind", kind);
      if (patientId) fd.set("patient_id", patientId);
      const r = await creerPiece(fd);
      if (r.ok && r.id) router.push(`/comptabilite/${r.id}`);
      else setErreur(r.error ?? "La création a échoué.");
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {!compact && (
        <button
          type="button"
          onClick={() => creer("devis")}
          disabled={enCours}
          className="inline-flex items-center gap-2 border border-slate-500 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium px-3 py-2 rounded-lg transition disabled:opacity-50"
        >
          <FileText className="h-4 w-4" aria-hidden="true" />
          Devis
        </button>
        )}
        <button
          type="button"
          onClick={() => creer("facture")}
          disabled={enCours}
          className={
            compact
              ? "inline-flex items-center gap-1.5 text-sm text-brand-700 hover:text-brand-900 disabled:opacity-50"
              : "inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition shadow-sm disabled:opacity-50"
          }
        >
          <FilePlus2 className="h-4 w-4" aria-hidden="true" />
          {compact ? "Facturer" : "Nouvelle facture"}
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
