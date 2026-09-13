"use client";

import { Mail } from "lucide-react";

export default function ApercuActions({
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
      {patientEmail && (
        <a
          href={mailto}
          className="inline-flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium px-4 py-2 rounded-lg"
        >
          <Mail className="h-4 w-4" aria-hidden="true" />
          Envoyer par email
        </a>
      )}
    </div>
  );
}
