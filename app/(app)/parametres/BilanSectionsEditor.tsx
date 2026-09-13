"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, RotateCcw, Trash2 } from "lucide-react";
import type { BilanSectionConfig } from "@/lib/types";
import { DEFAULT_BILAN_SECTIONS } from "@/lib/constants";
import { Bouton } from "@/components/Bouton";

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

  /* SUPPRIMER UN TITRE NE SUPPRIME PAS CE QUI A ÉTÉ ÉCRIT DESSOUS.
   *
   * Le texte reste dans le jsonb de chaque bilan — il n'est pas perdu — mais
   * plus rien ne l'affiche : ni l'éditeur, ni l'aperçu, ni le document remis.
   * Il devient invisible sans avoir été effacé, ce qui est la pire des deux
   * situations : on ne peut ni le lire, ni savoir qu'il existe.
   *
   * L'avertissement de bas de page couvrait le renommage et le déplacement,
   * jamais la suppression — c'est-à-dire le seul geste qui fait disparaître
   * quelque chose. On le dit ici, au moment du geste, et on demande à
   * confirmer. Le § C-8 de la sécurité clinique. */
  const remove = (id: string) => {
    const titre = sections.find((s) => s.id === id)?.title ?? "cette section";
    const ok = window.confirm(
      `Retirer « ${titre} » de la trame ?\n\n` +
        "Le texte déjà écrit sous ce titre, dans les bilans existants, ne sera " +
        "pas effacé — mais il cessera d'apparaître, y compris sur les documents " +
        "remis. Remettre le titre le fera réapparaître.",
    );
    if (!ok) return;
    setSections((arr) => arr.filter((s) => s.id !== id));
  };

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
                {/* LE CAS EXACT OÙ `disabled` ÉJECTAIT LE CLAVIER. « Descendre »
                    sur l'avant-dernière section la rend dernière : son bouton
                    s'éteignait SOUS le focus, qui retombait sur `body`. La ligne
                    garde sa clé en se déplaçant, donc son bouton garde le focus.

                    Et ces flèches n'avaient que `title` pour nom accessible —
                    le même sur chaque ligne. Un lecteur d'écran entendait
                    « Monter » vingt fois sans savoir quelle section. */}
                <Bouton
                  variante="libre"
                  onClick={() => move(i, -1)}
                  motifMasque
                  empeche={i === 0 ? "Cette section est déjà la première." : null}
                  aria-label={`Monter la section « ${s.title || "sans titre"} »`}
                  title="Monter"
                  className="text-slate-500 hover:text-brand-600"
                >
                  <ArrowUp className="h-4 w-4" aria-hidden="true" />
                </Bouton>
                <Bouton
                  variante="libre"
                  onClick={() => move(i, 1)}
                  motifMasque
                  empeche={
                    i === sections.length - 1
                      ? "Cette section est déjà la dernière."
                      : null
                  }
                  aria-label={`Descendre la section « ${s.title || "sans titre"} »`}
                  title="Descendre"
                  className="text-slate-500 hover:text-brand-600"
                >
                  <ArrowDown className="h-4 w-4" aria-hidden="true" />
                </Bouton>
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
                <span className="text-[10px] uppercase tracking-wide text-slate-500 shrink-0">
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
                <span className="text-[11px] text-slate-500 shrink-0 px-1">
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
                  className="p-1 text-slate-500 hover:text-rose-600 shrink-0"
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
      <p className="text-xs text-slate-500">
        Cochez « Encadré » pour afficher un titre dans un cadre. Les
        <span className="italic"> sous-titres</span> s&apos;affichent en plus
        petit, en italique coloré, et se trient/positionnent comme les titres.
        Pensez à « Enregistrer les paramètres » en bas de page. «
        L&apos;anamnèse », « Résultats chiffrés » et « Conclusion » ne peuvent
        pas être supprimées.
      </p>
      <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        Retirer un titre ne supprime pas le texte déjà écrit dessous dans les
        bilans existants : il cesse simplement d&apos;apparaître, y compris sur
        les documents remis. Remettre le titre le fait réapparaître.
      </p>
    </div>
  );
}
