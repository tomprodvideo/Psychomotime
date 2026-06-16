"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";

export default function ConfirmDeleteButton({
  id,
  action,
  message = "Confirmer la suppression ?",
  label = "Supprimer",
}: {
  id: string;
  action: (formData: FormData) => Promise<void>;
  message?: string;
  label?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => {
        if (!confirm(message)) return;
        const fd = new FormData();
        fd.set("id", id);
        start(() => action(fd));
      }}
      disabled={pending}
      className="inline-flex items-center gap-2 text-sm font-medium text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded-lg disabled:opacity-50"
    >
      <Trash2 className="h-4 w-4" />
      {pending ? "Suppression…" : label}
    </button>
  );
}
