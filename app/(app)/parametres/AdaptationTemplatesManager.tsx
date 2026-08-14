"use client";

import { useState, useTransition } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import type { AdaptationTemplate } from "@/lib/types";
import { saveAdaptationTemplates } from "../bilans/actions";

function uid() {
  return globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `t${Date.now()}${Math.floor(Math.random() * 1e6)}`;
}

export default function AdaptationTemplatesManager({
  initial,
}: {
  initial: AdaptationTemplate[];
}) {
  const [draft, setDraft] = useState<AdaptationTemplate[]>(
    initial.map((t) => ({ ...t })),
  );
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  const save = () => {
    const clean = draft
      .map((t) => ({ ...t, title: t.title.trim(), text: t.text.trim() }))
      .filter((t) => t.title || t.text);
    start(async () => {
      await saveAdaptationTemplates(clean);
      setDraft(clean);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500 -mt-2">
        Exemples d&apos;adaptations réutilisables, insérables en un clic dans le
        paragraphe « Adaptations » de chaque bilan (via le menu « Modèles »).
      </p>

      {draft.length === 0 && (
        <p className="text-sm text-slate-400">
          Aucun modèle pour l&apos;instant. Ajoutez-en un ci-dessous.
        </p>
      )}

      {draft.map((t, i) => (
        <div
          key={t.id}
          className="border border-slate-200 rounded-lg p-3 space-y-2"
        >
          <div className="flex items-center gap-2">
            <input
              value={t.title}
              onChange={(e) =>
                setDraft((d) =>
                  d.map((x, j) =>
                    j === i ? { ...x, title: e.target.value } : x,
                  ),
                )
              }
              placeholder="Titre du modèle (ex. Aménagements scolaires)"
              className="flex-1 rounded-lg border border-slate-200 py-1.5 px-2 text-sm font-medium outline-none focus:border-brand-400"
            />
            <button
              type="button"
              onClick={() => setDraft((d) => d.filter((_, j) => j !== i))}
              className="p-1 text-slate-400 hover:text-rose-600"
              title="Supprimer ce modèle"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <textarea
            value={t.text}
            onChange={(e) =>
              setDraft((d) =>
                d.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)),
              )
            }
            rows={3}
            placeholder="Texte de l'adaptation…"
            className="w-full rounded-lg border border-slate-200 py-2 px-2 text-sm outline-none focus:border-brand-400 resize-y"
          />
        </div>
      ))}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() =>
            setDraft((d) => [...d, { id: uid(), title: "", text: "" }])
          }
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50 px-3 py-1.5 rounded-lg"
        >
          <Plus className="h-4 w-4" />
          Ajouter un modèle
        </button>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 px-4 py-1.5 rounded-lg disabled:opacity-60"
        >
          {saved ? <Check className="h-4 w-4" /> : null}
          {pending ? "Enregistrement…" : "Enregistrer les modèles"}
        </button>
        {saved && (
          <span className="text-sm text-brand-700">Modèles enregistrés ✓</span>
        )}
      </div>
    </div>
  );
}
