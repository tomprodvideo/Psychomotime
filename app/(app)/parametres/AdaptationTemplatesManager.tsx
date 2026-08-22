"use client";

import { useState, useTransition } from "react";
import {
  Check,
  ChevronDown,
  FolderPlus,
  Plus,
  Trash2,
} from "lucide-react";
import type { AdaptationFolder, AdaptationTemplate } from "@/lib/types";
import { saveAdaptationLibrary } from "../bilans/actions";

function uid() {
  return globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `t${Date.now()}${Math.floor(Math.random() * 1e6)}`;
}

const GENERAL = "__general__";

export default function AdaptationTemplatesManager({
  initialTemplates,
  initialFolders,
  type = "psychomoteur",
}: {
  initialTemplates: AdaptationTemplate[];
  initialFolders: AdaptationFolder[];
  type?: "psychomoteur" | "sensoriel";
}) {
  const [folders, setFolders] = useState<AdaptationFolder[]>(
    initialFolders.map((f) => ({ ...f })),
  );
  const [templates, setTemplates] = useState<AdaptationTemplate[]>(
    initialTemplates.map((t) => ({ ...t })),
  );
  // Dossiers fermés par défaut (l'utilisateur les déplie au besoin).
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const addFolder = () => {
    const id = uid();
    setFolders((f) => [...f, { id, name: "" }]);
    setOpen((s) => new Set(s).add(id));
  };

  const renameFolder = (id: string, name: string) =>
    setFolders((f) => f.map((x) => (x.id === id ? { ...x, name } : x)));

  const deleteFolder = (id: string) => {
    // Les modèles du dossier repassent en « Général » (pas de perte).
    setTemplates((t) =>
      t.map((x) => (x.folder === id ? { ...x, folder: null } : x)),
    );
    setFolders((f) => f.filter((x) => x.id !== id));
  };

  const addTemplate = (folder: string | null) => {
    setTemplates((t) => [...t, { id: uid(), title: "", text: "", folder }]);
  };

  const updateTemplate = (
    id: string,
    field: "title" | "text",
    value: string,
  ) =>
    setTemplates((t) =>
      t.map((x) => (x.id === id ? { ...x, [field]: value } : x)),
    );

  const deleteTemplate = (id: string) =>
    setTemplates((t) => t.filter((x) => x.id !== id));

  const save = () => {
    const cleanFolders = folders
      .map((f) => ({ ...f, name: f.name.trim() }))
      .filter((f) => f.name);
    const validIds = new Set(cleanFolders.map((f) => f.id));
    const cleanTemplates = templates
      .map((t) => ({
        ...t,
        title: t.title.trim(),
        text: t.text.trim(),
        // Rattache à « Général » si le dossier a été supprimé/vidé.
        folder: t.folder && validIds.has(t.folder) ? t.folder : null,
      }))
      .filter((t) => t.title || t.text);
    start(async () => {
      await saveAdaptationLibrary(cleanTemplates, cleanFolders, type);
      setFolders(cleanFolders);
      setTemplates(cleanTemplates);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  };

  const templatesOf = (folder: string | null) =>
    templates.filter((t) => (t.folder ?? null) === folder);

  const groups: { id: string; folderId: string | null; name: string }[] = [
    { id: GENERAL, folderId: null, name: "Général (sans dossier)" },
    ...folders.map((f) => ({ id: f.id, folderId: f.id, name: f.name })),
  ];

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500 -mt-2">
        Rangez vos modèles dans des dossiers (ex. « Anamnèse », « Adaptations »,
        « Conclusion »). Ils sont ensuite insérables en un clic dans n&apos;importe
        quel paragraphe du bilan, groupés par dossier.
      </p>

      {groups.map((g) => {
        const isOpen = open.has(g.id);
        const items = templatesOf(g.folderId);
        const isFolder = g.folderId !== null;
        return (
          <div
            key={g.id}
            className="border border-slate-200 rounded-lg overflow-hidden"
          >
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-2">
              <button
                type="button"
                onClick={() => toggle(g.id)}
                className="shrink-0 text-slate-400 hover:text-slate-700"
                title={isOpen ? "Replier" : "Déplier"}
              >
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              {isFolder ? (
                <input
                  value={g.name}
                  onChange={(e) => renameFolder(g.folderId!, e.target.value)}
                  placeholder="Nom du dossier"
                  className="flex-1 bg-transparent text-sm font-semibold text-slate-800 outline-none border-b border-transparent focus:border-brand-300"
                />
              ) : (
                <span className="flex-1 text-sm font-semibold text-slate-500">
                  {g.name}
                </span>
              )}
              <span className="text-xs text-slate-400 shrink-0">
                {items.length}
              </span>
              {isFolder && (
                <button
                  type="button"
                  onClick={() => deleteFolder(g.folderId!)}
                  className="shrink-0 p-1 text-slate-400 hover:text-rose-600"
                  title="Supprimer le dossier (les modèles repassent en Général)"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>

            {isOpen && (
              <div className="p-3 space-y-3">
                {items.length === 0 && (
                  <p className="text-xs text-slate-400">
                    Aucun modèle dans ce dossier.
                  </p>
                )}
                {items.map((t) => (
                  <div
                    key={t.id}
                    className="border border-slate-200 rounded-lg p-3 space-y-2 bg-white"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        value={t.title}
                        onChange={(e) =>
                          updateTemplate(t.id, "title", e.target.value)
                        }
                        placeholder="Titre du modèle"
                        className="flex-1 rounded-lg border border-slate-200 py-1.5 px-2 text-sm font-medium outline-none focus:border-brand-400"
                      />
                      <button
                        type="button"
                        onClick={() => deleteTemplate(t.id)}
                        className="p-1 text-slate-400 hover:text-rose-600"
                        title="Supprimer ce modèle"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <textarea
                      value={t.text}
                      onChange={(e) =>
                        updateTemplate(t.id, "text", e.target.value)
                      }
                      rows={3}
                      placeholder="Texte du modèle…"
                      className="w-full rounded-lg border border-slate-200 py-2 px-2 text-sm outline-none focus:border-brand-400 resize-y"
                    />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addTemplate(g.folderId)}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50 px-3 py-1.5 rounded-lg"
                >
                  <Plus className="h-4 w-4" />
                  Ajouter un modèle
                </button>
              </div>
            )}
          </div>
        );
      })}

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={addFolder}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 px-3 py-1.5 rounded-lg"
        >
          <FolderPlus className="h-4 w-4" />
          Nouveau dossier
        </button>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 px-4 py-1.5 rounded-lg disabled:opacity-60"
        >
          {saved ? <Check className="h-4 w-4" /> : null}
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
        {saved && (
          <span className="text-sm text-brand-700">Modèles enregistrés ✓</span>
        )}
      </div>
    </div>
  );
}
