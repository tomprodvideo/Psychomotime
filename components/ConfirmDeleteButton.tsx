"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Bouton } from "@/components/Bouton";

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
    <Bouton variante="libre"
      onClick={() => {
        if (!confirm(message)) return;
        const fd = new FormData();
        fd.set("id", id);
        start(() => action(fd));
      }}
      pending={pending}
      className="inline-flex items-center gap-2 text-sm font-medium text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded-lg"
    >
      <Trash2 className="h-4 w-4" />
      {pending ? "Suppression…" : label}
    </Bouton>
  );
}
