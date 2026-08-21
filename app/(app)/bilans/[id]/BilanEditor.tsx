"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Eye,
  ImagePlus,
  Loader2,
  Mic,
  Plus,
  Save,
  Sparkles,
  Square,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import type {
  AdaptationFolder,
  AdaptationTemplate,
  Bilan,
  BilanPreset,
  BilanSectionConfig,
  BilanTests,
  MabcScore,
} from "@/lib/types";
import {
  BILAN_META,
  MABC_BLOCK_TITLES,
  MABC_GROUPS,
  PSYCHOMOTOR_TESTS,
  nsColor,
  type MabcRow,
} from "@/lib/constants";
import { ageFromBirth, frDate } from "@/lib/format";
import ConfirmDeleteButton from "@/components/ConfirmDeleteButton";
import {
  saveBilan,
  deleteBilan,
  saveBilanPreset,
  deleteBilanPreset,
} from "../actions";
import { reformulateText } from "../ai-actions";
import { useDictation } from "./useDictation";

function parseJSON<T>(s: unknown, fallback: T): T {
  try {
    return typeof s === "string" ? (JSON.parse(s) as T) : fallback;
  } catch {
    return fallback;
  }
}

function uid() {
  return globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID().slice(0, 8)
    : `${Date.now()}${Math.floor(Math.random() * 1e4)}`;
}

/** Redimensionne une image et renvoie un data-URL JPEG léger. */
function resizeImage(file: File, maxDim = 1200, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("img"));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("ctx"));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export default function BilanEditor({
  bilan,
  templates,
  folders,
  sections,
  presets,
  patientBirthDate,
}: {
  bilan: Bilan;
  templates: AdaptationTemplate[];
  folders?: AdaptationFolder[];
  sections: BilanSectionConfig[];
  presets?: BilanPreset[];
  patientBirthDate?: string | null;
}) {
  const raw0 = bilan.content ?? {};

  const [title, setTitle] = useState(bilan.title);
  const [patientName, setPatientName] = useState(bilan.patient_name);
  const [bilanDate, setBilanDate] = useState(bilan.bilan_date ?? "");
  const [author, setAuthor] = useState(bilan.author ?? "");
  const [status, setStatus] = useState(bilan.status);

  const [content, setContent] = useState<Record<string, string>>(() => {
    const c = { ...raw0 };
    delete c.__blocks__;
    delete c.__images__;
    delete c.__flags__;
    return c;
  });
  const [images, setImages] = useState<Record<string, string[]>>(() =>
    parseJSON(raw0.__images__, {}),
  );

  const flags0 = parseJSON<{ adaptations?: boolean; preconisations?: boolean }>(
    raw0.__flags__,
    {},
  );
  const [adaptationsOn, setAdaptationsOn] = useState(!!flags0.adaptations);
  const [preconisationsOn, setPreconisationsOn] = useState(
    !!flags0.preconisations,
  );

  // Tests (sélection par section)
  const t0: BilanTests = bilan.tests ?? {};
  const [bySection, setBySection] = useState<Record<string, string[]>>(
    () => t0.bySection ?? {},
  );
  const [mabcGroup, setMabcGroup] = useState<1 | 2 | 3 | null>(
    t0.mabc3_group ?? null,
  );
  const [mabcScores, setMabcScores] = useState<Record<string, MabcScore>>(
    t0.mabc3 ?? {},
  );

  // Blocs ajoutés à la volée sous une section (titre libre + texte propre).
  const [blocks, setBlocks] = useState<
    Record<string, { id: string; title: string }[]>
  >(() => parseJSON(raw0.__blocks__, {}));

  // Modèles de bilan entiers (pré-remplis), enregistrés dans le profil.
  const [presetList, setPresetList] = useState<BilanPreset[]>(presets ?? []);
  const [presetMenuOpen, setPresetMenuOpen] = useState(false);
  const [presetPending, startPreset] = useTransition();

  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState(false);
  const [pending, start] = useTransition();

  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [aiError, setAiError] = useState<Record<string, string>>({});
  const [undo, setUndo] = useState<{ id: string; prev: string } | null>(null);

  // Modèles réutilisables (gérés dans Paramètres › Bilan), partagés par tous
  // les paragraphes et groupés par dossier dans le menu d'insertion.
  const templateList = templates;
  const folderList = folders ?? [];

  const markDirty = () => setDirty(true);

  const update = (key: string, value: string) => {
    setContent((c) => ({ ...c, [key]: value }));
    markDirty();
    if (undo?.id === key) setUndo(null);
  };

  const insertInto = (key: string, text: string) => {
    setContent((c) => {
      const prev = c[key] ?? "";
      const sep = prev.trim() ? "\n" : "";
      return { ...c, [key]: prev + sep + text };
    });
    markDirty();
  };

  const addBlock = (sectionId: string) => {
    setBlocks((b) => ({
      ...b,
      [sectionId]: [...(b[sectionId] ?? []), { id: uid(), title: "" }],
    }));
    markDirty();
  };
  const renameBlock = (sectionId: string, blockId: string, title: string) => {
    setBlocks((b) => ({
      ...b,
      [sectionId]: (b[sectionId] ?? []).map((x) =>
        x.id === blockId ? { ...x, title } : x,
      ),
    }));
    markDirty();
  };
  const removeBlock = (sectionId: string, blockId: string) => {
    setBlocks((b) => ({
      ...b,
      [sectionId]: (b[sectionId] ?? []).filter((x) => x.id !== blockId),
    }));
    setContent((c) => {
      const next = { ...c };
      delete next[`${sectionId}::${blockId}`];
      return next;
    });
    markDirty();
  };

  // ----- Modèles de bilan entiers -----
  const saveAsPreset = () => {
    const name = window.prompt("Nom du modèle de bilan :");
    if (!name?.trim()) return;
    const snapshot = { ...content, __blocks__: JSON.stringify(blocks) };
    const snapTests = {
      bySection,
      mabc3_group: mabcGroup,
      mabc3: mabcScores,
    };
    startPreset(async () => {
      const next = await saveBilanPreset(name.trim(), snapshot, snapTests);
      if (next) setPresetList(next as BilanPreset[]);
    });
  };
  const loadPreset = (p: BilanPreset) => {
    if (
      !window.confirm(
        `Remplacer le contenu actuel par le modèle « ${p.name} » ?`,
      )
    )
      return;
    const c = { ...(p.content ?? {}) };
    const bl = parseJSON<Record<string, { id: string; title: string }[]>>(
      c.__blocks__,
      {},
    );
    delete c.__blocks__;
    delete c.__images__;
    delete c.__flags__;
    setContent(c);
    setBlocks(bl);
    const t = p.tests ?? {};
    setBySection(t.bySection ?? {});
    setMabcGroup(t.mabc3_group ?? null);
    setMabcScores(t.mabc3 ?? {});
    setPresetMenuOpen(false);
    markDirty();
  };
  const deletePreset = (id: string) => {
    if (!window.confirm("Supprimer ce modèle de bilan ?")) return;
    startPreset(async () => {
      const next = await deleteBilanPreset(id);
      if (next) setPresetList(next as BilanPreset[]);
    });
  };

  const toggleSectionTest = (sectionId: string, testId: string) => {
    setBySection((b) => {
      const cur = b[sectionId] ?? [];
      return {
        ...b,
        [sectionId]: cur.includes(testId)
          ? cur.filter((x) => x !== testId)
          : [...cur, testId],
      };
    });
    markDirty();
  };

  const setScore = (key: string, field: "p" | "ns", value: string) => {
    setMabcScores((m) => ({ ...m, [key]: { ...m[key], [field]: value } }));
    markDirty();
  };

  const addImages = async (sectionId: string, files: FileList) => {
    const urls: string[] = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/")) continue;
      try {
        urls.push(await resizeImage(f));
      } catch {
        /* ignore */
      }
    }
    if (urls.length) {
      setImages((im) => ({
        ...im,
        [sectionId]: [...(im[sectionId] ?? []), ...urls],
      }));
      markDirty();
    }
  };
  const removeImage = (sectionId: string, idx: number) => {
    setImages((im) => ({
      ...im,
      [sectionId]: (im[sectionId] ?? []).filter((_, i) => i !== idx),
    }));
    markDirty();
  };

  async function handleReformulate(key: string, sectionTitle: string) {
    const current = content[key] ?? "";
    if (!current.trim() || aiBusy) return;
    setAiBusy(key);
    setAiError((e) => ({ ...e, [key]: "" }));
    const res = await reformulateText(sectionTitle, current);
    setAiBusy(null);
    if (res.error) {
      setAiError((e) => ({ ...e, [key]: res.error! }));
      return;
    }
    setUndo({ id: key, prev: current });
    setContent((c) => ({ ...c, [key]: res.text! }));
    markDirty();
  }
  function handleUndo() {
    if (!undo) return;
    setContent((c) => ({ ...c, [undo.id]: undo.prev }));
    setUndo(null);
    markDirty();
  }

  const dictation = useDictation((text, id) => {
    setContent((c) => {
      const prev = c[id] ?? "";
      const sep = prev && !/\s$/.test(prev) ? " " : "";
      return { ...c, [id]: prev + sep + text };
    });
    markDirty();
  });

  const doSave = (newStatus?: string) =>
    start(async () => {
      const fd = new FormData();
      fd.set("id", bilan.id);
      fd.set("patient_id", bilan.patient_id ?? "");
      fd.set("patient_name", patientName);
      fd.set("title", title);
      fd.set("bilan_date", bilanDate);
      fd.set("author", author);
      fd.set("status", newStatus ?? status);
      fd.set(
        "content",
        JSON.stringify({
          ...content,
          __images__: JSON.stringify(images),
          __blocks__: JSON.stringify(blocks),
          __flags__: JSON.stringify({
            adaptations: adaptationsOn,
            preconisations: preconisationsOn,
          }),
        }),
      );
      fd.set(
        "tests",
        JSON.stringify({
          bySection,
          mabc3_group: mabcGroup,
          mabc3: mabcScores,
        }),
      );
      await saveBilan(fd);
      setDirty(false);
      setSavedAt(true);
      setTimeout(() => setSavedAt(false), 2500);
    });

  const group = MABC_GROUPS.find((g) => g.group === mabcGroup) ?? null;

  /** Champ texte réutilisable (section principale ou bloc), avec dictée + IA. */
  function TextField({
    fieldKey,
    label,
    hint,
    rows = 3,
    onRemove,
    extraActions,
  }: {
    fieldKey: string;
    label: string;
    hint?: string;
    rows?: number;
    onRemove?: () => void;
    extraActions?: React.ReactNode;
  }) {
    const busy = aiBusy === fieldKey;
    const hasText = (content[fieldKey] ?? "").trim() !== "";
    const recording = dictation.activeId === fieldKey;
    const otherRecording =
      dictation.activeId !== null && dictation.activeId !== fieldKey;
    return (
      <div>
        <div className="flex items-center justify-between gap-2 mb-1">
          <label className="block text-sm font-medium text-slate-700">
            {label}
          </label>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => dictation.toggle(fieldKey)}
              disabled={!dictation.supported || otherRecording || busy}
              title={
                dictation.supported
                  ? "Dicter à la voix"
                  : "Dictée non disponible (utilisez Chrome ou Safari)"
              }
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition disabled:opacity-40 ${
                recording
                  ? "bg-rose-100 text-rose-700 animate-pulse"
                  : "text-slate-600 bg-slate-100 hover:bg-slate-200"
              }`}
            >
              {recording ? (
                <Square className="h-3.5 w-3.5 fill-current" />
              ) : (
                <Mic className="h-3.5 w-3.5" />
              )}
              {recording ? "Stop" : "Dicter"}
            </button>
            <button
              type="button"
              onClick={() => handleReformulate(fieldKey, label)}
              disabled={busy || !hasText || aiBusy !== null}
              title={hasText ? "Reformuler avec l'IA" : "Écrivez d'abord"}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 px-2.5 py-1 rounded-full transition disabled:opacity-40"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {busy ? "Reformulation…" : "Reformuler"}
            </button>
            <TemplatesMenu
              templates={templateList}
              folders={folderList}
              onInsert={(t) => insertInto(fieldKey, t)}
            />
            {extraActions}
            {onRemove && (
              <button
                type="button"
                onClick={onRemove}
                title="Supprimer ce bloc"
                className="p-1 text-slate-400 hover:text-rose-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <textarea
          value={content[fieldKey] ?? ""}
          onChange={(e) => update(fieldKey, e.target.value)}
          placeholder={hint}
          rows={rows}
          disabled={busy}
          className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2 px-3 text-sm outline-none focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100 transition resize-y leading-relaxed disabled:opacity-60"
        />
        {aiError[fieldKey] && (
          <p className="text-xs text-rose-600 mt-1">{aiError[fieldKey]}</p>
        )}
        {undo?.id === fieldKey && (
          <button
            type="button"
            onClick={handleUndo}
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-brand-700 mt-1"
          >
            <Undo2 className="h-3.5 w-3.5" />
            Annuler la reformulation
          </button>
        )}
      </div>
    );
  }

  /** Sélecteur de tests + tableaux M-ABC3 d'une section (domaines). */
  function SectionTests({
    sectionId,
    mabcBlocks,
  }: {
    sectionId: string;
    mabcBlocks?: ("equilibre" | "oculo" | "dexterite")[];
  }) {
    const sel = bySection[sectionId] ?? [];
    const showMabc =
      sel.includes("mabc3") && mabcBlocks && mabcBlocks.length > 0;
    return (
      <div className="mt-3 bg-slate-50/60 rounded-lg p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-slate-500 mr-1">
            Tests utilisés :
          </span>
          {PSYCHOMOTOR_TESTS.map((t) => {
            const on = sel.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleSectionTest(sectionId, t.id)}
                className={`text-xs px-2.5 py-1 rounded-full border transition ${
                  on
                    ? "bg-brand-600 border-brand-600 text-white"
                    : "bg-white border-slate-200 text-slate-600 hover:border-brand-300"
                }`}
              >
                {on ? "✓ " : ""}
                {t.label}
              </button>
            );
          })}
        </div>

        {showMabc && (
          <div className="mt-3 border-t border-slate-200 pt-3">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-xs font-medium text-slate-700">
                M-ABC3 — groupe d&apos;âge :
              </span>
              {MABC_GROUPS.map((g) => (
                <button
                  key={g.group}
                  type="button"
                  onClick={() => {
                    setMabcGroup(g.group);
                    markDirty();
                  }}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                    mabcGroup === g.group
                      ? "bg-brand-50 border-brand-400 text-brand-700 ring-1 ring-brand-200"
                      : "border-slate-200 text-slate-500 hover:border-brand-300"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
            {group ? (
              mabcBlocks!.map((bk) => (
                <MabcTable
                  key={bk}
                  title={MABC_BLOCK_TITLES[bk]}
                  rows={group.blocks[bk]}
                  scores={mabcScores}
                  onChange={setScore}
                />
              ))
            ) : (
              <p className="text-sm text-slate-400">
                Choisissez un groupe d&apos;âge pour afficher les épreuves.
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  /** Photos d'une section. */
  function SectionPhotos({ sectionId }: { sectionId: string }) {
    const imgs = images[sectionId] ?? [];
    return (
      <div className="mt-3 space-y-3">
        {imgs.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {imgs.map((src, i) => (
              <div key={i} className="relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt=""
                  className="h-24 w-24 object-cover rounded-lg border border-slate-200"
                />
                <button
                  type="button"
                  onClick={() => removeImage(sectionId, i)}
                  className="absolute -top-2 -right-2 bg-white border border-slate-200 rounded-full p-0.5 text-slate-500 hover:text-rose-600 shadow"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg cursor-pointer">
          <ImagePlus className="h-3.5 w-3.5" />
          Ajouter une photo
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) addImages(sectionId, e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      </div>
    );
  }

  /** Blocs ajoutés à la volée (sous-titre libre + texte), remplissables par modèle. */
  function SectionBlocks({ sectionId }: { sectionId: string }) {
    const list = blocks[sectionId] ?? [];
    return (
      <div className="mt-3 space-y-3">
        {list.map((bl) => (
          <div
            key={bl.id}
            className="pl-3 border-l-2 border-brand-100 bg-slate-50/40 rounded-r-lg py-2 pr-2"
          >
            <div className="flex items-center gap-2 mb-1">
              <input
                value={bl.title}
                onChange={(e) => renameBlock(sectionId, bl.id, e.target.value)}
                placeholder="Titre du bloc (sous-titre)"
                className="flex-1 rounded-md border border-slate-200 py-1 px-2 text-sm font-medium italic text-slate-700 outline-none focus:border-brand-400"
              />
              <button
                type="button"
                onClick={() => removeBlock(sectionId, bl.id)}
                title="Supprimer ce bloc"
                className="p-1 text-slate-400 hover:text-rose-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            {TextField({
              fieldKey: `${sectionId}::${bl.id}`,
              label: "",
              hint: "Texte du bloc…",
              rows: 3,
            })}
          </div>
        ))}
        <button
          type="button"
          onClick={() => addBlock(sectionId)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg"
        >
          <Plus className="h-3.5 w-3.5" />
          Ajouter un bloc
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto pb-40">
      <div className="flex items-center justify-between mb-4">
        <Link
          href="/bilans"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Bilans
        </Link>
        <ConfirmDeleteButton
          id={bilan.id}
          action={deleteBilan}
          message="Supprimer définitivement ce bilan ?"
        />
      </div>

      {/* En-tête éditable */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 mb-5">
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            markDirty();
          }}
          className="w-full text-xl font-semibold text-slate-800 outline-none border-b border-transparent focus:border-brand-300 pb-1"
        />
        <div className="grid sm:grid-cols-3 gap-4 mt-4">
          <div>
            <Label>Patient (Prénom Nom)</Label>
            <input
              value={patientName}
              onChange={(e) => {
                setPatientName(e.target.value);
                markDirty();
              }}
              className={inputCls}
            />
            {patientBirthDate && (
              <p className="text-xs text-slate-400 mt-1">
                Né(e) le {frDate(patientBirthDate)} ·{" "}
                {ageFromBirth(patientBirthDate)}
              </p>
            )}
          </div>
          <div>
            <Label>Date du bilan</Label>
            <input
              type="date"
              value={bilanDate}
              onChange={(e) => {
                setBilanDate(e.target.value);
                markDirty();
              }}
              className={inputCls}
            />
          </div>
          <div>
            <Label>Rédigé par</Label>
            <input
              value={author}
              onChange={(e) => {
                setAuthor(e.target.value);
                markDirty();
              }}
              className={inputCls}
            />
          </div>
          <div>
            <Label>Lieu (« Fait à… »)</Label>
            <input
              value={content.lieu ?? ""}
              onChange={(e) => update("lieu", e.target.value)}
              placeholder="Ex. Le Puy-en-Velay"
              className={inputCls}
            />
          </div>
        </div>
      </div>

      {/* Modèle de bilan entier */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 mb-5 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-brand-600 mr-auto">
          Modèle de bilan
        </span>
        <div className="relative">
          <button
            type="button"
            onClick={() => setPresetMenuOpen((o) => !o)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg"
          >
            Charger un modèle
            <ChevronDown className="h-4 w-4" />
          </button>
          {presetMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setPresetMenuOpen(false)}
              />
              <div className="absolute right-0 z-20 mt-1 w-72 bg-white border border-slate-200 rounded-lg shadow-lg max-h-72 overflow-y-auto divide-y divide-slate-100">
                {presetList.length === 0 ? (
                  <p className="text-xs text-slate-400 px-3 py-2">
                    Aucun modèle enregistré. Remplissez un bilan puis « Enregistrer
                    comme modèle ».
                  </p>
                ) : (
                  presetList.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-1 px-2 py-1.5 hover:bg-brand-50"
                    >
                      <button
                        type="button"
                        onClick={() => loadPreset(p)}
                        className="flex-1 text-left text-sm text-slate-700 px-1 truncate"
                        title={p.name}
                      >
                        {p.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => deletePreset(p.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 shrink-0"
                        title="Supprimer ce modèle"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={saveAsPreset}
          disabled={presetPending}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg disabled:opacity-60"
        >
          {presetPending ? "…" : "Enregistrer comme modèle"}
        </button>
      </div>

      {/* Informations */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 mb-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-brand-600 mb-3">
          Informations (en-tête du bilan)
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {BILAN_META.map((f) => (
            <div key={f.id}>
              <Label>{f.label}</Label>
              <input
                value={content[f.id] ?? ""}
                onChange={(e) => update(f.id, e.target.value)}
                placeholder={f.placeholder}
                className={inputCls}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Sections rédigées (trame personnalisable dans Paramètres › Bilan) */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-brand-600 mb-2 px-1">
          Sections du bilan
        </h2>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm divide-y divide-slate-100">
          {sections.map((s) => (
            <div
              key={s.id}
              className={`p-4 ${
                s.level === "subtitle"
                  ? "pl-8 border-l-2 border-brand-100 bg-slate-50/40"
                  : ""
              }`}
            >
              {s.kind === "scores" ? (
                <div>
                  <p className="text-sm font-medium text-slate-700">{s.title}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Section générée automatiquement (interprétation des scores +
                    courbe de Gauss). Elle apparaît dès qu&apos;un test est
                    renseigné — rien à saisir ici.
                  </p>
                </div>
              ) : (
                <>
                  {TextField({
                    fieldKey: s.id,
                    label: s.title,
                    hint: s.hint,
                    rows: s.id === "anamnese" || s.id === "conclusion" ? 6 : 3,
                  })}
                  {s.domain &&
                    SectionTests({ sectionId: s.id, mabcBlocks: s.mabcBlocks })}
                  {SectionBlocks({ sectionId: s.id })}
                  {SectionPhotos({ sectionId: s.id })}
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Paragraphes optionnels après la conclusion */}
      <div className="mt-6 bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-brand-600">
          Paragraphes optionnels (après la conclusion)
        </h2>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={adaptationsOn}
            onChange={(e) => {
              setAdaptationsOn(e.target.checked);
              markDirty();
            }}
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-400"
          />
          Ajouter un paragraphe « Adaptations »
        </label>
        {adaptationsOn &&
          TextField({
            fieldKey: "adaptations",
            label: "Adaptations",
            hint: "Adaptations à mettre en place au quotidien et en contexte scolaire…",
            rows: 4,
          })}

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={preconisationsOn}
            onChange={(e) => {
              setPreconisationsOn(e.target.checked);
              markDirty();
            }}
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-400"
          />
          Ajouter un paragraphe « Préconisations »
        </label>
        {preconisationsOn &&
          TextField({
            fieldKey: "preconisations",
            label: "Préconisations",
            hint: "Préconisations, orientations, suivi conseillé…",
            rows: 4,
          })}
      </div>

      {/* Espace de sécurité sous le dernier bloc (barre d'actions fixe) */}
      <div aria-hidden className="h-24" />

      {/* Barre d'actions fixe */}
      <div className="fixed bottom-0 inset-x-0 md:left-64 bg-white/90 backdrop-blur border-t border-slate-200 px-4 py-3 no-print">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={() => {
                const next = status === "finalisé" ? "brouillon" : "finalisé";
                setStatus(next);
                doSave(next);
              }}
              className={`text-xs px-3 py-1.5 rounded-full font-medium ${
                status === "finalisé"
                  ? "bg-brand-100 text-brand-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {status === "finalisé" ? "● Finalisé" : "○ Brouillon"}
            </button>
            <span className="text-xs text-slate-400">
              {savedAt
                ? "Enregistré ✓"
                : dirty
                  ? "Modifications non enregistrées"
                  : ""}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/bilans/${bilan.id}/apercu`}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:bg-slate-100 px-3 py-2 rounded-lg"
            >
              <Eye className="h-4 w-4" />
              Aperçu / PDF
            </Link>
            <button
              onClick={() => doSave()}
              disabled={pending}
              className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-60"
            >
              {savedAt ? (
                <Check className="h-4 w-4" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {pending ? "…" : "Enregistrer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Menu « Modèles » groupé par dossier (composant stable, au niveau module). */
function TemplatesMenu({
  templates,
  folders,
  onInsert,
}: {
  templates: AdaptationTemplate[];
  folders: AdaptationFolder[];
  onInsert: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const folderIds = new Set(folders.map((f) => f.id));
  const general = templates.filter((t) => !t.folder || !folderIds.has(t.folder));
  const groups = [
    ...folders.map((f) => ({
      name: f.name,
      items: templates.filter((t) => t.folder === f.id),
    })),
    { name: "Général", items: general },
  ].filter((g) => g.items.length > 0);

  const item = (t: AdaptationTemplate) => (
    <button
      key={t.id}
      type="button"
      onClick={() => {
        onInsert(t.text);
        setOpen(false);
      }}
      className="block w-full text-left px-3 py-2 hover:bg-brand-50"
    >
      <p className="text-sm font-medium text-slate-700">
        {t.title || "Sans titre"}
      </p>
      <p className="text-xs text-slate-500 whitespace-pre-wrap mt-0.5 leading-relaxed line-clamp-2">
        {t.text}
      </p>
    </button>
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Insérer un modèle"
        className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-full transition"
      >
        Modèles
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-80 sm:w-96 bg-white border border-slate-200 rounded-lg shadow-lg">
            <div className="max-h-80 overflow-y-auto">
              {groups.length === 0 ? (
                <p className="text-xs text-slate-400 px-3 py-2">
                  Aucun modèle. Créez-en dans Paramètres › Bilan.
                </p>
              ) : (
                groups.map((g) => (
                  <div key={g.name} className="border-b border-slate-100 last:border-0">
                    <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      {g.name}
                    </p>
                    {g.items.map(item)}
                  </div>
                ))
              )}
            </div>
            <p className="px-3 py-2 text-[11px] text-slate-400 border-t border-slate-100">
              Gérez vos dossiers et modèles dans Paramètres › Bilan.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function MabcTable({
  title,
  rows,
  scores,
  onChange,
}: {
  title: string;
  rows: MabcRow[];
  scores: Record<string, MabcScore>;
  onChange: (key: string, field: "p" | "ns", value: string) => void;
}) {
  return (
    <div className="mb-4">
      <p className="text-sm font-medium text-slate-700 mb-1.5">{title}</p>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm min-w-[520px]">
          <thead>
            <tr className="bg-slate-100 text-left text-xs text-slate-500 uppercase">
              <th className="px-3 py-2 font-semibold">Épreuve</th>
              <th className="px-3 py-2 font-semibold w-56">Performance</th>
              <th className="px-3 py-2 font-semibold w-24 text-center">N.S</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-slate-100">
                <td className="px-3 py-2 text-slate-700 align-top">
                  {r.epreuve}
                </td>
                <td className="px-2 py-1.5 align-top">
                  <textarea
                    value={scores[r.key]?.p ?? ""}
                    onChange={(e) => onChange(r.key, "p", e.target.value)}
                    placeholder={r.perfHint}
                    rows={2}
                    className="w-full rounded border border-slate-200 py-1 px-2 text-sm outline-none focus:border-brand-400 resize-y leading-snug"
                  />
                </td>
                <td className="px-2 py-1.5 align-top">
                  <input
                    value={scores[r.key]?.ns ?? ""}
                    onChange={(e) => onChange(r.key, "ns", e.target.value)}
                    style={{
                      color: nsColor(scores[r.key]?.ns),
                      fontWeight: scores[r.key]?.ns ? 600 : undefined,
                    }}
                    className="w-full rounded border border-slate-200 py-1 px-2 text-sm text-center outline-none focus:border-brand-400"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition";

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-slate-500 mb-1">
      {children}
    </label>
  );
}
