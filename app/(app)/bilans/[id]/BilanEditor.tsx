"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Eye,
  Loader2,
  Save,
  Sparkles,
  Undo2,
} from "lucide-react";
import type { Bilan } from "@/lib/types";
import { BILAN_TEMPLATE } from "@/lib/constants";
import ConfirmDeleteButton from "@/components/ConfirmDeleteButton";
import { saveBilan, deleteBilan } from "../actions";
import { reformulateText } from "../ai-actions";

export default function BilanEditor({ bilan }: { bilan: Bilan }) {
  const [title, setTitle] = useState(bilan.title);
  const [patientName, setPatientName] = useState(bilan.patient_name);
  const [bilanDate, setBilanDate] = useState(bilan.bilan_date ?? "");
  const [author, setAuthor] = useState(bilan.author ?? "");
  const [status, setStatus] = useState(bilan.status);
  const [content, setContent] = useState<Record<string, string>>(
    bilan.content ?? {},
  );

  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<boolean>(false);
  const [pending, start] = useTransition();

  // Reformulation IA par section
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [aiError, setAiError] = useState<Record<string, string>>({});
  const [undo, setUndo] = useState<{ id: string; prev: string } | null>(null);

  const update = (key: string, value: string) => {
    setContent((c) => ({ ...c, [key]: value }));
    setDirty(true);
    if (undo?.id === key) setUndo(null);
  };

  async function handleReformulate(id: string, title: string) {
    const current = content[id] ?? "";
    if (!current.trim() || aiBusy) return;
    setAiBusy(id);
    setAiError((e) => ({ ...e, [id]: "" }));
    const res = await reformulateText(title, current);
    setAiBusy(null);
    if (res.error) {
      setAiError((e) => ({ ...e, [id]: res.error! }));
      return;
    }
    setUndo({ id, prev: current });
    setContent((c) => ({ ...c, [id]: res.text! }));
    setDirty(true);
  }

  function handleUndo() {
    if (!undo) return;
    setContent((c) => ({ ...c, [undo.id]: undo.prev }));
    setUndo(null);
    setDirty(true);
  }

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
      await saveBilan(fd);
      setDirty(false);
      setSavedAt(true);
      setTimeout(() => setSavedAt(false), 2500);
    });

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
            setDirty(true);
          }}
          className="w-full text-xl font-semibold text-slate-800 outline-none border-b border-transparent focus:border-brand-300 pb-1"
        />
        <div className="grid sm:grid-cols-3 gap-4 mt-4">
          <div>
            <Label>Patient</Label>
            <input
              value={patientName}
              onChange={(e) => {
                setPatientName(e.target.value);
                setDirty(true);
              }}
              className={inputCls}
            />
          </div>
          <div>
            <Label>Date</Label>
            <input
              type="date"
              value={bilanDate}
              onChange={(e) => {
                setBilanDate(e.target.value);
                setDirty(true);
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
                setDirty(true);
              }}
              className={inputCls}
            />
          </div>
        </div>
      </div>

      {/* Sections */}
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
                return (
                  <div key={s.id} className="p-4">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <label className="block text-sm font-medium text-slate-700">
                        {s.title}
                      </label>
                      <button
                        type="button"
                        onClick={() => handleReformulate(s.id, s.title)}
                        disabled={busy || !hasText || aiBusy !== null}
                        title={
                          hasText
                            ? "Reformuler proprement avec l'IA"
                            : "Écrivez d'abord vos notes"
                        }
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 px-2.5 py-1 rounded-full transition disabled:opacity-40 shrink-0"
                      >
                        {busy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5" />
                        )}
                        {busy ? "Reformulation…" : "Reformuler"}
                      </button>
                    </div>
                    <textarea
                      value={content[s.id] ?? ""}
                      onChange={(e) => update(s.id, e.target.value)}
                      placeholder={s.hint}
                      rows={3}
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

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white py-2 px-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition";

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-slate-500 mb-1">
      {children}
    </label>
  );
}
