"use client";

import { Mail, Printer } from "lucide-react";

export default function InvoiceActions({
  patientEmail,
  subject,
  body,
}: {
  patientEmail: string | null;
  subject: string;
  body: string;
}) {
  const mailto = `mailto:${patientEmail ?? ""}?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(body)}`;

  return (
    <div className="flex items-center gap-2">
      {patientEmail ? (
        <a
          href={mailto}
          className="inline-flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium px-4 py-2 rounded-lg"
        >
          <Mail className="h-4 w-4" />
          Envoyer par email
        </a>
      ) : (
        <span
          className="text-xs text-slate-400 max-w-[180px]"
          title="Ajoutez un email au patient pour activer l'envoi"
        >
          Aucun email patient
        </span>
      )}
      <button
        onClick={() => window.print()}
        className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-sm"
      >
        <Printer className="h-4 w-4" />
        Imprimer / PDF
      </button>
    </div>
  );
}
