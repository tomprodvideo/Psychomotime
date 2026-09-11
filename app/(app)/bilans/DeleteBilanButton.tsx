"use client";

import { useTransition } from "react";
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

  return (
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
        start(() => deleteBilanById(id));
      }}
      className="relative z-10 h-7 w-7 shrink-0 inline-flex items-center justify-center rounded-full text-slate-300 hover:text-rose-600 hover:bg-rose-50 focus:text-rose-600 focus:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-200 transition disabled:opacity-50"
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <X className="h-4 w-4" />
      )}
    </button>
  );
}
