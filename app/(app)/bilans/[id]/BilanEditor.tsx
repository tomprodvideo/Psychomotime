"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Eye,
  Loader2,
  Mic,
  Square,
  Save,
  Sparkles,
  Undo2,
} from "lucide-react";
import type { Bilan, BilanTests, MabcScore } from "@/lib/types";
import {
  BILAN_META,
  BILAN_TEMPLATE,
  MABC_BLOCK_TITLES,
  MABC_GROUPS,
  PSYCHOMOTOR_TESTS,
  nsColor,
  type MabcRow,
} from "@/lib/constants";
import ConfirmDeleteButton from "@/components/ConfirmDeleteButton";
import { saveBilan, deleteBilan } from "../actions";
import { reformulateText } from "../ai-actions";
import { useDictation } from "./useDictation";

export default function BilanEditor({ bilan }: { bilan: Bilan }) {
  const [title, setTitle] = useState(bilan.title);
  const [patientName, setPatientName] = useState(bilan.patient_name);
  const [bilanDate, setBilanDate] = useState(bilan.bilan_date ?? "");
  const [author, setAuthor] = useState(bilan.author ?? "");
  const [status, setStatus] = useState(bilan.status);
  const [content, setContent] = useState<Record<string, string>>(
    bilan.content ?? {},
  );

  // Tests
  const t0: BilanTests = bilan.tests ?? {};
  const [used, setUsed] = useState<string[]>(t0.used ?? []);
  const [mabcGroup, setMabcGroup] = useState<1 | 2 | 3 | null>(
    t0.mabc3_group ?? null,
  );
  const [mabcScores, setMabcScores] = useState<Record<string, MabcScore>>(
    t0.mabc3 ?? {},
  );

  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState(false);
  const [pending, start] = useTransition();

  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [aiError, setAiError] = useState<Record<string, string>>({});
  const [undo, setUndo] = useState<{ id: string; prev: string } | null>(null);

  const markDirty = () => setDirty(true);

  const update = (key: string, value: string) => {
    setContent((c) => ({ ...c, [key]: value }));
    markDirty();
    if (undo?.id === key) setUndo(null);
  };

  const toggleTest = (id: string) => {
    setUsed((u) => (u.includes(id) ? u.filter((x) => x !== id) : [...u, id]));
    markDirty();
  };

  const setScore = (key: string, field: "p" | "ns", value: string) => {
    setMabcScores((m) => ({ ...m, [key]: { ...m[key], [field]: value } }));
    markDirty();
  };

  async function handleReformulate(id: string, sectionTitle: string) {
    const current = content[id] ?? "";
    if (!current.trim() || aiBusy) return;
    setAiBusy(id);
    setAiError((e) => ({ ...e, [id]: "" }));
    const res = await reformulateText(sectionTitle, current);
    setAiBusy(null);
    if (res.error) {
      setAiError((e) => ({ ...e, [id]: res.error! }));
      return;
    }
    setUndo({ id, prev: current });
    setContent((c) => ({ ...c, [id]: res.text! }));
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
      fd.set("content", JSON.stringify(content));
      fd.set(
        "tests",
        JSON.stringify({
          used,
          mabc3_group: mabcGroup,
          mabc3: mabcScores,
        }),
      );
      await saveBilan(fd);
      setDirty(false);
      setSavedAt(true);
      setTimeout(() => setSavedAt(false), 2500);
    });

  const mabcUsed = used.includes("mabc3");
  const group = MABC_GROUPS.find((g) => g.group === mabcGroup) ?? null;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto pb-28">
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
        </div>
      </div>

      {/* Informations (encadré anamnèse) */}
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

      {/* Tests utilisés */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 mb-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-brand-600 mb-3">
          Tests utilisés
        </h2>
        <div className="flex flex-wrap gap-2">
          {PSYCHOMOTOR_TESTS.map((test) => {
            const on = used.includes(test.id);
            return (
              <button
                key={test.id}
                type="button"
                onClick={() => toggleTest(test.id)}
                className={`text-sm px-3 py-1.5 rounded-full border transition ${
                  on
                    ? "bg-brand-600 border-brand-600 text-white"
                    : "bg-white border-slate-200 text-slate-600 hover:border-brand-300"
                }`}
              >
                {on ? "✓ " : ""}
                {test.label}
              </button>
            );
          })}
        </div>

        {/* M-ABC3 : groupe d'âge + tableaux */}
        {mabcUsed && (
          <div className="mt-5 border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <span className="text-sm font-medium text-slate-700">
                M-ABC3 — groupe d'âge :
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

            {!group && (
              <p className="text-sm text-slate-400">
                Choisissez un groupe d'âge pour afficher les épreuves.
              </p>
            )}

            {group &&
              (["equilibre", "oculo", "dexterite"] as const).map((blockKey) => (
                <MabcTable
                  key={blockKey}
                  title={MABC_BLOCK_TITLES[blockKey]}
                  rows={group.blocks[blockKey]}
                  scores={mabcScores}
                  onChange={setScore}
                />
              ))}
          </div>
        )}
      </div>

      {/* Sections rédigées */}
      <div className="space-y-6">
        {BILAN_TEMPLATE.map((grp) => (
          <div key={grp.group}>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-brand-600 mb-2 px-1">
              {grp.group}
            </h2>
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm divide-y divide-slate-100">
              {grp.sections.map((s) => {
                const busy = aiBusy === s.id;
                const hasText = (content[s.id] ?? "").trim() !== "";
                const recording = dictation.activeId === s.id;
                const otherRecording =
                  dictation.activeId !== null && dictation.activeId !== s.id;
                return (
                  <div key={s.id} className="p-4">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <label className="block text-sm font-medium text-slate-700">
                        {s.title}
                      </label>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => dictation.toggle(s.id)}
                          disabled={
                            !dictation.supported || otherRecording || busy
                          }
                          title={
                            dictation.supported
                              ? "Dicter à la voix"
                              : "Dictée non disponible sur ce navigateur (utilisez Chrome ou Safari)"
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
                          onClick={() => handleReformulate(s.id, s.title)}
                          disabled={busy || !hasText || aiBusy !== null}
                          title={
                            hasText
                              ? "Reformuler proprement avec l'IA"
                              : "Écrivez d'abord vos notes"
                          }
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 px-2.5 py-1 rounded-full transition disabled:opacity-40"
                        >
                          {busy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5" />
                          )}
                          {busy ? "Reformulation…" : "Reformuler"}
                        </button>
                      </div>
                    </div>
                    <textarea
                      value={content[s.id] ?? ""}
                      onChange={(e) => update(s.id, e.target.value)}
                      placeholder={s.hint}
                      rows={s.id === "anamnese" || s.id === "conclusion" ? 6 : 3}
                      disabled={busy}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2 px-3 text-sm outline-none focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100 transition resize-y leading-relaxed disabled:opacity-60"
                    />
                    {aiError[s.id] && (
                      <p className="text-xs text-rose-600 mt-1">
                        {aiError[s.id]}
                      </p>
                    )}
                    {undo?.id === s.id && (
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
              })}
            </div>
          </div>
        ))}
      </div>

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
                <td className="px-3 py-2 text-slate-700">{r.epreuve}</td>
                <td className="px-2 py-1.5">
                  <input
                    value={scores[r.key]?.p ?? ""}
                    onChange={(e) => onChange(r.key, "p", e.target.value)}
                    placeholder={r.perfHint}
                    className="w-full rounded border border-slate-200 py-1 px-2 text-sm outline-none focus:border-brand-400"
                  />
                </td>
                <td className="px-2 py-1.5">
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
