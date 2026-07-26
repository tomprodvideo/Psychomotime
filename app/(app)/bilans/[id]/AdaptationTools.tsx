"use client";

import { useState, useTransition } from "react";
import { ChevronDown, Plus, Settings, Trash2, X } from "lucide-react";
import type { AdaptationTemplate } from "@/lib/types";
import { saveAdaptationTemplates } from "../actions";

function uid() {
  return globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `t${Date.now()}${Math.floor(Math.random() * 1e6)}`;
}

export default function AdaptationTools({
  initial,
  onInsert,
}: {
  initial: AdaptationTemplate[];
  onInsert: (text: string) => void;
}) {
  const [templates, setTemplates] = useState<AdaptationTemplate[]>(initial);
  const [menuOpen, setMenuOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [draft, setDraft] = useState<AdaptationTemplate[]>(initial);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  const openManage = () => {
    setDraft(templates.map((t) => ({ ...t })));
    setManageOpen(true);
  };

  const persist = () => {
    const clean = draft
      .map((t) => ({ ...t, title: t.title.trim(), text: t.text.trim() }))
      .filter((t) => t.title || t.text);
    start(async () => {
      await saveAdaptationTemplates(clean);
      setTemplates(clean);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      setManageOpen(false);
    });
  };

  return (
    <>
      {/* Menu d'insertion */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-full transition"
        >
          Modèles
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute right-0 z-20 mt-1 w-64 max-h-72 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg py-1">
              {templates.length === 0 ? (
                <p className="text-xs text-slate-400 px-3 py-2">
                  Aucun modèle. Cliquez sur ⚙️ pour en créer.
                </p>
              ) : (
                templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      onInsert(t.text);
                      setMenuOpen(false);
                    }}
                    className="block w-full text-left px-3 py-2 hover:bg-brand-50"
                  >
                    <p className="text-sm font-medium text-slate-700 truncate">
                      {t.title || "Sans titre"}
                    </p>
                    <p className="text-xs text-slate-400 truncate">{t.text}</p>
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* Molette de gestion */}
      <button
        type="button"
        onClick={openManage}
        title="Gérer les modèles d'adaptations"
        className="p-1 text-slate-400 hover:text-brand-600"
      >
        <Settings className="h-4 w-4" />
      </button>

      {/* Modale de gestion */}
      {manageOpen && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-slate-900/40 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800">
                Modèles d&apos;adaptations
              </h2>
              <button onClick={() => setManageOpen(false)}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {draft.length === 0 && (
                <p className="text-sm text-slate-400">
                  Aucun modèle. Ajoutez-en un ci-dessous.
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
                      onClick={() =>
                        setDraft((d) => d.filter((_, j) => j !== i))
                      }
                      className="p-1 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <textarea
                    value={t.text}
                    onChange={(e) =>
                      setDraft((d) =>
                        d.map((x, j) =>
                          j === i ? { ...x, text: e.target.value } : x,
                        ),
                      )
                    }
                    rows={3}
                    placeholder="Texte de l'adaptation…"
                    className="w-full rounded-lg border border-slate-200 py-2 px-2 text-sm outline-none focus:border-brand-400 resize-y"
                  />
                </div>
              ))}

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
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100">
              {saved && (
                <span className="text-sm text-brand-700 mr-auto">
                  Enregistré ✓
                </span>
              )}
              <button
                type="button"
                onClick={() => setManageOpen(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={persist}
                disabled={pending}
                className="px-5 py-2 text-sm text-white bg-brand-600 hover:bg-brand-700 rounded-lg disabled:opacity-60"
              >
                {pending ? "Enregistrement…" : "Enregistrer les modèles"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
