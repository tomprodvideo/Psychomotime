"use client";

import { useState, useTransition } from "react";
import { X, Loader2 } from "lucide-react";
import { deleteBilanById } from "./actions";

export default function DeleteBilanButton({
  id,
  label,
}: {
  id: string;
  label: string;
}) {
  const [pending, start] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  return (
    <>
      {erreur && (
        <p
          role="alert"
          className="absolute right-0 top-8 z-20 w-64 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 shadow-lg ring-1 ring-red-200"
        >
          {erreur}
        </p>
      )}
      <button
      type="button"
      title="Supprimer ce bilan"
      aria-label={`Supprimer le bilan de ${label}`}
      disabled={pending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const ok = confirm(
          `Supprimer définitivement le bilan de ${label} ?\n\n` +
            "Tout son contenu (texte, tests, résultats) sera effacé de la base " +
            "de données. Cette action est irréversible.",
        );
        if (!ok) return;
        setErreur(null);
        // Une suppression qui échoue doit se voir : sans cela, la ligne
        // réapparaît au rechargement sans que rien n'ait été dit.
        start(async () => {
          const res = await deleteBilanById(id);
          if (!res.ok) setErreur(res.error);
        });
      }}
      className="relative z-10 h-7 w-7 shrink-0 inline-flex items-center justify-center rounded-full text-slate-500 hover:text-rose-700 hover:bg-rose-50 focus:text-rose-700 focus:bg-rose-50 transition disabled:opacity-50"
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <X className="h-4 w-4" />
      )}
      </button>
    </>
  );
}
