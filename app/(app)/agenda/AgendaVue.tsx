"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import {
  APPOINTMENT_KIND_LABELS,
  ATTENDANCE_LABELS,
  ATTENDANCE_TEINTES,
  patientName,
  type Appointment,
  type AppointmentWithPatient,
} from "@/lib/dossier/types";
import type { PatientListItem } from "@/lib/dossier/queries";
import AppointmentDialog from "./AppointmentDialog";
import AttendanceControl from "./AttendanceControl";
import NoteSeanceBouton from "./NoteSeanceBouton";

/** Couleur de l'issue. Jamais la SEULE porteuse de l'information : le libellé
 *  est toujours écrit à côté (WCAG 1.4.1). */

const heure = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
});
const jourLong = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const jourCourt = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
});

export default function AgendaVue({
  vue,
  debut,
  fin,
  maintenant,
  rendezVous,
  aQualifier,
  totalAQualifier,
  seancesNotees,
  patients,
  canWrite,
}: {
  vue: "jour" | "semaine";
  debut: string;
  fin: string;
  maintenant: string;
  rendezVous: AppointmentWithPatient[];
  aQualifier: AppointmentWithPatient[];
  /** Le compte RÉEL, non plafonné. `null` quand il n'a pas pu être fait. */
  totalAQualifier: number | null;
  /** Identifiants des séances portant déjà une note. */
  seancesNotees: string[];
  patients: PatientListItem[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [edite, setEdite] = useState<Appointment | "nouveau" | null>(null);
  const notees = new Set(seancesNotees);

  const d = new Date(debut);
  const f = new Date(fin);

  const naviguer = (pas: number) => {
    const cible = new Date(d);
    cible.setDate(cible.getDate() + pas * (vue === "semaine" ? 7 : 1));
    const params = new URLSearchParams();
    params.set("jour", cible.toISOString().slice(0, 10));
    if (vue === "semaine") params.set("vue", "semaine");
    router.push(`/agenda?${params.toString()}`);
  };

  const changerVue = (v: "jour" | "semaine") => {
    const params = new URLSearchParams();
    params.set("jour", d.toISOString().slice(0, 10));
    if (v === "semaine") params.set("vue", "semaine");
    router.push(`/agenda?${params.toString()}`);
  };

  // Regroupement par journée : en vue semaine, une liste plate serait illisible.
  const parJour = new Map<string, AppointmentWithPatient[]>();
  for (const rdv of rendezVous) {
    const cle = new Date(rdv.starts_at).toISOString().slice(0, 10);
    if (!parJour.has(cle)) parJour.set(cle, []);
    parJour.get(cle)!.push(rdv);
  }

  const titrePeriode =
    vue === "jour"
      ? jourLong.format(d)
      : `Semaine du ${jourCourt.format(d)} au ${jourCourt.format(new Date(f.getTime() - 1))}`;

  return (
    <>
      {/* ------------------------------------------ rendez-vous à qualifier */}
      {aQualifier.length > 0 && (
        <section
          aria-labelledby="titre-a-qualifier"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-5"
        >
          <h2
            id="titre-a-qualifier"
            className="flex items-center gap-2 font-medium text-amber-900"
          >
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            {totalAQualifier ?? aQualifier.length} rendez-vous passé
            {(totalAQualifier ?? aQualifier.length) > 1 ? "s" : ""} à renseigner
          </h2>
          <p className="text-sm text-amber-800 mt-1">
            Tant qu&apos;un créneau n&apos;est pas renseigné, il ne compte ni comme
            séance réalisée, ni comme absence — et il ne peut nourrir aucune
            attestation de présence.
          </p>
          {/* LE COMPTE ET LA LISTE SONT DEUX CHOSES. La liste est plafonnée ;
              le compte ne l'est pas. Quand ils divergent, on le DIT — sans quoi
              l'écran annoncerait un arriéré stable pendant qu'il grossit. */}
          {totalAQualifier !== null && totalAQualifier > aQualifier.length && (
            <p className="text-sm text-amber-900 font-medium mt-1">
              Les {aQualifier.length} plus anciens sont listés ci-dessous.
            </p>
          )}
          <ul className="mt-3 space-y-2 list-none p-0 m-0">
            {aQualifier.map((rdv) => (
              <li
                key={rdv.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2"
              >
                <div className="text-sm min-w-0">
                  <span className="font-medium text-slate-800">
                    {rdv.patient ? patientName(rdv.patient) : (rdv.title ?? "Créneau")}
                  </span>
                  <span className="text-slate-500">
                    {" — "}
                    {jourCourt.format(new Date(rdv.starts_at))} à{" "}
                    {heure.format(new Date(rdv.starts_at))}
                  </span>
                </div>
                {canWrite && (
                  <div className="flex items-center gap-1">
                    <AttendanceControl appointment={rdv} compact />
                    <NoteSeanceBouton
                      appointment={rdv}
                      aDejaUneNote={notees.has(rdv.id)}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* --------------------------------------------------- barre de période */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => naviguer(-1)}
            aria-label={vue === "jour" ? "Jour précédent" : "Semaine précédente"}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-300"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <h2 className="text-base font-medium text-slate-800 first-letter:uppercase px-1">
            {titrePeriode}
          </h2>
          <button
            type="button"
            onClick={() => naviguer(1)}
            aria-label={vue === "jour" ? "Jour suivant" : "Semaine suivante"}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-300"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
          <Link
            href="/agenda"
            className="ml-2 text-sm text-brand-700 hover:underline"
          >
            Aujourd&apos;hui
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <div
            role="group"
            aria-label="Période affichée"
            className="flex gap-1 p-1 bg-slate-100 rounded-lg"
          >
            {(["jour", "semaine"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={vue === v}
                onClick={() => changerVue(v)}
                className={`text-sm font-medium px-3 py-1 rounded-md transition ${
                  vue === v
                    ? "bg-white shadow-sm text-brand-700"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {v === "jour" ? "Jour" : "Semaine"}
              </button>
            ))}
          </div>
          {canWrite && (
            <button
              type="button"
              onClick={() => setEdite("nouveau")}
              className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition shadow-sm"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Rendez-vous
            </button>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------- la liste */}
      {parJour.size > 0 && (
        <div className="space-y-5">
          {[...parJour.entries()].map(([cle, liste]) => (
            <section key={cle} aria-label={jourLong.format(new Date(`${cle}T12:00:00`))}>
              {vue === "semaine" && (
                <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-2 first-letter:uppercase">
                  {jourLong.format(new Date(`${cle}T12:00:00`))}
                </h3>
              )}
              <ul className="space-y-2 list-none p-0 m-0">
                {liste.map((rdv) => (
                  <LigneRendezVous
                    key={rdv.id}
                    rdv={rdv}
                    maintenant={maintenant}
                    canWrite={canWrite}
                    aDejaUneNote={notees.has(rdv.id)}
                    onEdit={() => setEdite(rdv)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {edite && (
        <AppointmentDialog
          appointment={edite === "nouveau" ? null : edite}
          patients={patients}
          jourParDefaut={d.toISOString().slice(0, 10)}
          onClose={() => setEdite(null)}
        />
      )}
    </>
  );
}

function LigneRendezVous({
  rdv,
  maintenant,
  canWrite,
  aDejaUneNote,
  onEdit,
}: {
  rdv: AppointmentWithPatient;
  maintenant: string;
  canWrite: boolean;
  aDejaUneNote: boolean;
  onEdit: () => void;
}) {
  const debut = new Date(rdv.starts_at);
  const fin = new Date(rdv.ends_at);
  const passe = debut.getTime() < new Date(maintenant).getTime();
  const annule = rdv.attendance.startsWith("annule");

  return (
    <li
      className={`rounded-lg border border-slate-100 bg-white px-3 py-2.5 ${
        annule ? "opacity-70" : ""
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="text-sm font-medium text-slate-700 tabular-nums shrink-0 pt-0.5">
            {heure.format(debut)}
            <span className="block text-xs font-normal text-slate-500">
              {heure.format(fin)}
            </span>
          </div>
          <div className="min-w-0">
            <p className={`text-sm font-medium text-slate-800 ${annule ? "line-through" : ""}`}>
              {rdv.patient ? (
                <Link
                  href={`/patients/${rdv.patient.id}`}
                  className="hover:text-brand-700 hover:underline"
                >
                  {patientName(rdv.patient)}
                </Link>
              ) : (
                (rdv.title ?? "Créneau")
              )}
            </p>
            <p className="text-xs text-slate-500">
              {APPOINTMENT_KIND_LABELS[rdv.kind]}
              {rdv.attendance_note && ` · ${rdv.attendance_note}`}
            </p>
            {rdv.note && (
              <p className="text-xs text-slate-500 italic mt-0.5">{rdv.note}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`text-xs font-medium rounded-full px-2 py-0.5 ${ATTENDANCE_TEINTES[rdv.attendance]}`}
          >
            {ATTENDANCE_LABELS[rdv.attendance]}
          </span>
          {rdv.attendance !== "a_venir" && !rdv.billable && (
            <span className="text-xs text-slate-500">non facturable</span>
          )}
          {canWrite && (
            <>
              {passe && <AttendanceControl appointment={rdv} compact />}
              {/* La note s'écrit ICI, quand ce qu'on a travaillé est encore
                  frais. Passer par la fiche du dossier suppose de quitter
                  l'agenda, de retrouver le dossier, puis la séance dans une
                  liste — trois gestes à un moment où l'on en enchaîne dix. */}
              {passe && (
                <NoteSeanceBouton appointment={rdv} aDejaUneNote={aDejaUneNote} />
              )}
              <button
                type="button"
                onClick={onEdit}
                className="text-xs font-medium text-brand-700 hover:underline"
              >
                Modifier
              </button>
            </>
          )}
        </div>
      </div>
    </li>
  );
}
