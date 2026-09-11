"use client";

import Link from "next/link";
import { CalendarDays } from "lucide-react";
import {
  APPOINTMENT_KIND_LABELS,
  ATTENDANCE_LABELS,
  type Appointment,
  type Attendance,
} from "@/lib/dossier/types";
import type { SessionCount } from "@/lib/dossier/queries";

/**
 * Séances d'un patient.
 *
 * Répond à la question que le produit ne savait pas traiter : « combien de
 * séances cet enfant a-t-il eues, et que s'est-il passé ? ». Le compte des
 * séances RÉALISÉES vient de la vue dédiée, seule source admissible pour une
 * attestation de présence — il ne peut donc pas inclure un rendez-vous annulé
 * ou à venir.
 */
const TEINTES: Record<Attendance, string> = {
  a_venir: "bg-slate-100 text-slate-600",
  honore: "bg-brand-50 text-brand-700",
  absent_excuse: "bg-amber-50 text-amber-800",
  absent_non_excuse: "bg-rose-50 text-rose-700",
  annule_praticien: "bg-slate-100 text-slate-500",
  annule_patient: "bg-slate-100 text-slate-500",
  reporte: "bg-sky-50 text-sky-700",
};

const dateHeure = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default function SeancesSection({
  appointments,
  counts,
}: {
  appointments: Appointment[];
  counts: SessionCount;
}) {
  const aVenir = appointments.filter((a) => a.attendance === "a_venir" && new Date(a.starts_at) >= new Date());
  const passes = appointments.filter((a) => !aVenir.includes(a));

  return (
    <section
      aria-labelledby="titre-seances"
      className="bg-white rounded-xl border border-slate-100 shadow-sm p-5"
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 id="titre-seances" className="font-semibold text-slate-800">
          Séances
        </h2>
        <Link href="/agenda" className="text-sm font-medium text-brand-700 hover:underline">
          Ouvrir l&apos;agenda
        </Link>
      </div>

      {appointments.length === 0 ? (
        <div className="flex items-start gap-3 py-2">
          <CalendarDays className="h-5 w-5 shrink-0 text-slate-300 mt-0.5" aria-hidden="true" />
          <p className="text-sm text-slate-500">
            Aucun rendez-vous. Les séances se posent depuis l&apos;agenda, et c&apos;est
            leur issue constatée qui alimentera une attestation de présence.
          </p>
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <Compteur
              label="Réalisées"
              valeur={counts.realisees}
              accent="text-brand-700"
              aide="Seule base admissible d'une attestation de présence."
            />
            <Compteur label="À venir" valeur={counts.aVenir} accent="text-slate-700" />
            <Compteur label="Absences" valeur={counts.absences} accent="text-amber-700" />
            <Compteur
              label="À renseigner"
              valeur={counts.aQualifier}
              accent={counts.aQualifier > 0 ? "text-rose-700" : "text-slate-400"}
              aide={
                counts.aQualifier > 0
                  ? "Ces créneaux ne comptent nulle part tant qu'ils ne sont pas renseignés."
                  : undefined
              }
            />
          </dl>

          {aVenir.length > 0 && (
            <>
              <h3 className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-1.5">
                À venir
              </h3>
              <ul className="space-y-1.5 list-none p-0 m-0 mb-4">
                {aVenir.slice(0, 5).map((a) => (
                  <Ligne key={a.id} rdv={a} />
                ))}
              </ul>
            </>
          )}

          {passes.length > 0 && (
            <>
              <h3 className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-1.5">
                Historique
              </h3>
              <ul className="space-y-1.5 list-none p-0 m-0">
                {passes.slice(0, 10).map((a) => (
                  <Ligne key={a.id} rdv={a} />
                ))}
              </ul>
              {passes.length > 10 && (
                <p className="text-xs text-slate-400 mt-2">
                  {passes.length - 10} rendez-vous plus anciens, visibles dans
                  l&apos;agenda.
                </p>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}

function Compteur({
  label,
  valeur,
  accent,
  aide,
}: {
  label: string;
  valeur: number;
  accent: string;
  aide?: string;
}) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`text-lg font-semibold ${accent}`}>{valeur}</dd>
      {aide && <p className="text-[11px] text-slate-400 leading-snug mt-0.5">{aide}</p>}
    </div>
  );
}

function Ligne({ rdv }: { rdv: Appointment }) {
  const annule = rdv.attendance.startsWith("annule");
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <span className={`text-slate-700 ${annule ? "line-through opacity-70" : ""}`}>
        {dateHeure.format(new Date(rdv.starts_at))}
        <span className="text-slate-400"> · {APPOINTMENT_KIND_LABELS[rdv.kind]}</span>
      </span>
      <span className="flex items-center gap-2">
        {rdv.attendance_note && (
          <span className="text-xs text-slate-500 italic">{rdv.attendance_note}</span>
        )}
        <span
          className={`text-xs font-medium rounded-full px-2 py-0.5 ${TEINTES[rdv.attendance]}`}
        >
          {ATTENDANCE_LABELS[rdv.attendance]}
        </span>
      </span>
    </li>
  );
}
