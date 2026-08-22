"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, RotateCcw, Trash2 } from "lucide-react";
import type { BilanSectionConfig } from "@/lib/types";
import { DEFAULT_BILAN_SECTIONS } from "@/lib/constants";

function uid() {
  return globalThis.crypto?.randomUUID
    ? `s_${globalThis.crypto.randomUUID().slice(0, 8)}`
    : `s_${Date.now()}${Math.floor(Math.random() * 1e4)}`;
}

// Sections « système » (rendu spécial) : renommables/déplaçables mais pas supprimables.
const PROTECTED = new Set(["anamnese", "conclusion", "resultats_chiffres"]);

export default function BilanSectionsEditor({
  initial,
  name = "bilan_sections",
  defaultSections = DEFAULT_BILAN_SECTIONS,
}: {
  initial?: BilanSectionConfig[];
  name?: string;
  defaultSections?: BilanSectionConfig[];
}) {
  const [sections, setSections] = useState<BilanSectionConfig[]>(() =>
    (initial && initial.length ? initial : defaultSections).map((s) => ({
      ...s,
    })),
  );

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= sections.length) return;
    setSections((arr) => {
      const next = [...arr];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const rename = (id: string, title: string) =>
    setSections((arr) => arr.map((s) => (s.id === id ? { ...s, title } : s)));

  const toggleDomain = (id: string) =>
    setSections((arr) =>
      arr.map((s) => (s.id === id ? { ...s, domain: !s.domain } : s)),
    );

  const toggleBoxed = (id: string) =>
    setSections((arr) =>
      arr.map((s) =>
        s.id === id ? { ...s, boxed: !(s.boxed ?? true) } : s,
      ),
    );

  const remove = (id: string) =>
    setSections((arr) => arr.filter((s) => s.id !== id));

  const insertBeforeConclusion = (item: BilanSectionConfig) =>
    setSections((arr) => {
      const i = arr.findIndex((s) => s.id === "conclusion");
      return i >= 0
        ? [...arr.slice(0, i), item, ...arr.slice(i)]
        : [...arr, item];
    });

  const add = () =>
    insertBeforeConclusion({
      id: uid(),
      title: "Nouvelle section",
      level: "title",
      boxed: true,
      kind: "text",
    });

  const addSub = () =>
    insertBeforeConclusion({
      id: uid(),
      title: "Nouveau sous-titre",
      level: "subtitle",
      kind: "text",
    });

  // Ajoute un sous-titre à la fin du groupe du titre situé à `index`
  // (après ses sous-titres déjà présents, avant le titre suivant).
  const addSubTo = (index: number) =>
    setSections((arr) => {
      let at = index + 1;
      while (at < arr.length && arr[at].level === "subtitle") at++;
      const item: BilanSectionConfig = {
        id: uid(),
        title: "Nouveau sous-titre",
        level: "subtitle",
        kind: "text",
      };
      return [...arr.slice(0, at), item, ...arr.slice(at)];
    });

  const reset = () => setSections(defaultSections.map((s) => ({ ...s })));

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={JSON.stringify(sections)} />
      <p className="text-sm text-slate-500 -mt-2">
        Ordre, noms et emplacements des titres et sous-titres du bilan. Le
        renommage et le déplacement n&apos;affectent pas le contenu déjà saisi
        dans les bilans.
      </p>

      <div className="space-y-2">
        {sections.map((s, i) => {
          const protectedItem = PROTECTED.has(s.id);
          const isScores = s.kind === "scores";
          const isSub = s.level === "subtitle";
          return (
            <div
              key={s.id}
              className={`flex items-center gap-2 border rounded-lg px-2 py-1.5 ${
                isSub
                  ? "ml-6 border-slate-100 bg-slate-50"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex flex-col shrink-0">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="text-slate-400 hover:text-brand-600 disabled:opacity-30"
                  title="Monter"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === sections.length - 1}
                  className="text-slate-400 hover:text-brand-600 disabled:opacity-30"
                  title="Descendre"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
              </div>

              <input
                value={s.title}
                onChange={(e) => rename(s.id, e.target.value)}
                placeholder={isSub ? "Sous-titre" : "Titre de la section"}
                className={`flex-1 rounded-md border border-slate-200 py-1.5 px-2 outline-none focus:border-brand-400 ${
                  isSub ? "text-[13px] italic" : "text-sm"
                }`}
              />

              {isSub && (
                <span className="text-[10px] uppercase tracking-wide text-slate-400 shrink-0">
                  sous-titre
                </span>
              )}

              {!isSub && (
                <label
                  className="flex items-center gap-1 text-[11px] text-slate-500 shrink-0 cursor-pointer select-none px-1"
                  title="Afficher ce titre dans un encadré"
                >
                  <input
                    type="checkbox"
                    checked={s.boxed ?? true}
                    onChange={() => toggleBoxed(s.id)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-400"
                  />
                  Encadré
                </label>
              )}

              {isScores ? (
                <span className="text-[11px] text-slate-400 shrink-0 px-1">
                  auto
                </span>
              ) : isSub ? null : (
                <label
                  className="flex items-center gap-1 text-[11px] text-slate-500 shrink-0 cursor-pointer select-none px-1"
                  title="Afficher le sélecteur de tests et les tableaux M-ABC sous cette section"
                >
                  <input
                    type="checkbox"
                    checked={!!s.domain}
                    onChange={() => toggleDomain(s.id)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-400"
                  />
                  Tests
                </label>
              )}

              {!isSub && (
                <button
                  type="button"
                  onClick={() => addSubTo(i)}
                  className="inline-flex items-center gap-0.5 text-[11px] font-medium text-brand-600 hover:bg-brand-50 px-1.5 py-1 rounded shrink-0"
                  title="Ajouter un sous-titre sous ce titre"
                >
                  <Plus className="h-3.5 w-3.5" />
                  ss-titre
                </button>
              )}

              {protectedItem ? (
                <span className="w-6 shrink-0" />
              ) : (
                <button
                  type="button"
                  onClick={() => remove(s.id)}
                  className="p-1 text-slate-400 hover:text-rose-600 shrink-0"
                  title="Supprimer cette section"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50 px-3 py-1.5 rounded-lg"
        >
          <Plus className="h-4 w-4" />
          Ajouter un titre
        </button>
        <button
          type="button"
          onClick={addSub}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50 px-3 py-1.5 rounded-lg"
        >
          <Plus className="h-4 w-4" />
          Ajouter un sous-titre
        </button>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:bg-slate-50 px-3 py-1.5 rounded-lg"
        >
          <RotateCcw className="h-4 w-4" />
          Réinitialiser
        </button>
      </div>
      <p className="text-xs text-slate-400">
        Cochez « Encadré » pour afficher un titre dans un cadre. Les
        <span className="italic"> sous-titres</span> s&apos;affichent en plus
        petit, en italique coloré, et se trient/positionnent comme les titres.
        Pensez à « Enregistrer les paramètres » en bas de page. «
        L&apos;anamnèse », « Résultats chiffrés » et « Conclusion » ne peuvent
        pas être supprimées.
      </p>
    </div>
  );
}
