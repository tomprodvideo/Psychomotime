"use client";

import { Printer } from "lucide-react";

export default function BoutonImprimer() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition shadow-sm"
    >
      <Printer className="h-4 w-4" aria-hidden="true" />
      Imprimer
    </button>
  );
}
