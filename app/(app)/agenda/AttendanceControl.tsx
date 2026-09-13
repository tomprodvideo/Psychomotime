"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { setAttendance } from "./actions";
import {
  ATTENDANCE_BILLABLE_BY_DEFAULT,
  ATTENDANCE_LABELS,
  ATTENDANCE_REQUIRING_NOTE,
  type Appointment,
  type Attendance,
} from "@/lib/dossier/types";

/**
 * Constater ce qui s'est passé.
 *
 * Le geste le plus fréquent — « la séance a eu lieu » — tient en un clic. Les
 * autres issues ouvrent une saisie, parce qu'elles demandent un motif ou une
 * décision de facturation, et qu'escamoter cette saisie produirait des données
 * inexploitables : on ne saurait ni relancer, ni justifier une facture.
 */
const ISSUES: Attendance[] = [
  "honore",
  "absent_excuse",
  "absent_non_excuse",
  "annule_patient",
  "annule_praticien",
  "reporte",
];

export default function AttendanceControl({
  appointment,
  compact = false,
}: {
  appointment: Appointment;
  compact?: boolean;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [pending, start] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [issue, setIssue] = useState<Attendance>("honore");
  const [note, setNote] = useState("");
  const [facturable, setFacturable] = useState(true);
  const [forcerFacturable, setForcerFacturable] = useState(false);

  const envoyer = (
    attendance: Attendance,
    motif?: string,
    explicite?: boolean,
  ) => {
    const fd = new FormData();
    fd.set("id", appointment.id);
    fd.set("attendance", attendance);
    if (motif) fd.set("attendance_note", motif);
    if (explicite) {
      fd.set("billable_explicit", "1");
      fd.set("billable", facturable ? "on" : "");
    }
    setErreur(null);
    start(async () => {
      const res = await setAttendance(fd);
      if (!res.ok) {
        setErreur(res.error);
        return;
      }
      setOuvert(false);
      setNote("");
      setForcerFacturable(false);
    });
  };

  const choisirIssue = (v: Attendance) => {
    setIssue(v);
    // Le défaut suit l'issue, et se voit : on ne cache pas au praticien ce que
    // le logiciel s'apprête à décider pour lui.
    setFacturable(ATTENDANCE_BILLABLE_BY_DEFAULT.includes(v));
    setForcerFacturable(false);
  };

  if (!ouvert) {
    return (
      <div className="flex items-center gap-1">
        {/* Le geste courant, en un clic. */}
        <button
          type="button"
          onClick={() => envoyer("honore")}
          disabled={pending}
          title="Marquer comme honoré"
          aria-label="Marquer ce rendez-vous comme honoré"
          className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:bg-brand-50 border border-brand-200 rounded-lg px-2 py-1 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand-300"
        >
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          {compact ? "Honoré" : "Séance honorée"}
        </button>
        <button
          type="button"
          onClick={() => setOuvert(true)}
          disabled={pending}
          className="text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg px-2 py-1 disabled:opacity-50"
        >
          Autre issue
        </button>
        {erreur && (
          <span role="alert" className="text-xs text-red-700">
            {erreur}
          </span>
        )}
      </div>
    );
  }

  const motifExige = ATTENDANCE_REQUIRING_NOTE.includes(issue);

  return (
    <div className="w-full sm:w-96 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-slate-700">Ce qui s&apos;est passé</p>
        <button
          type="button"
          onClick={() => setOuvert(false)}
          aria-label="Fermer"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-200"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <label htmlFor={`issue-${appointment.id}`} className="sr-only">
        Issue du rendez-vous
      </label>
      <select
        id={`issue-${appointment.id}`}
        value={issue}
        onChange={(e) => choisirIssue(e.target.value as Attendance)}
        className="w-full rounded-lg border border-slate-500 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
      >
        {ISSUES.map((a) => (
          <option key={a} value={a}>
            {ATTENDANCE_LABELS[a]}
          </option>
        ))}
      </select>

      <div className="mt-2">
        <label
          htmlFor={`motif-${appointment.id}`}
          className="block text-xs text-slate-600 mb-1"
        >
          Motif {motifExige ? "(obligatoire)" : "(facultatif)"}
        </label>
        <input
          id={`motif-${appointment.id}`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={
            motifExige
              ? "Sans nouvelle, relancée par téléphone…"
              : "Prévenue la veille…"
          }
          className="w-full rounded-lg border border-slate-500 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700 mt-2">
        <input
          type="checkbox"
          checked={facturable}
          onChange={(e) => {
            setFacturable(e.target.checked);
            setForcerFacturable(true);
          }}
        />
        Facturable
        {!forcerFacturable && (
          <span className="text-xs text-slate-500">(défaut pour cette issue)</span>
        )}
      </label>

      {erreur && (
        <p role="alert" className="text-xs text-red-700 mt-2">
          {erreur}
        </p>
      )}

      <div className="flex justify-end gap-2 mt-3">
        <button
          type="button"
          onClick={() => setOuvert(false)}
          className="text-sm text-slate-600 hover:bg-slate-100 px-3 py-1.5 rounded-lg"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={() => envoyer(issue, note.trim() || undefined, forcerFacturable)}
          disabled={pending || (motifExige && !note.trim())}
          className="text-sm text-white bg-brand-600 hover:bg-brand-700 px-4 py-1.5 rounded-lg disabled:opacity-50"
        >
          {pending ? "Enregistrement en cours…" : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}
