"use client";

import Link from "next/link";
import { CalendarDays } from "lucide-react";
import {
  APPOINTMENT_KIND_LABELS,
  ATTENDANCE_LABELS,
  ATTENDANCE_TONS,
  type Appointment,
} from "@/lib/dossier/types";
import type { SessionCount } from "@/lib/dossier/queries";
import { Statut } from "@/components/Statut";

/**
 * Séances d'un patient.
 *
 * Répond à la question que le produit ne savait pas traiter : « combien de
 * séances cet enfant a-t-il eues, et que s'est-il passé ? ». Le compte des
 * séances RÉALISÉES vient de la vue dédiée, seule source admissible pour une
 * attestation de présence — il ne peut donc pas inclure un rendez-vous annulé
 * ou à venir.
 */

/* L'HEURE D'UNE SÉANCE SE LIT DANS LE FUSEAU DU CABINET. Le formateur n'en
   portait aucun : rendu d'abord sur le serveur, il écrivait l'heure du serveur,
   puis celle du poste à l'hydratation — deux textes pour le même rendez-vous,
   et sous un serveur UTC, 12 h 30 pour une séance de 14 h 30. C'est la règle
   que l'agenda applique déjà (`AgendaVue`). */
function formateurDateHeure(fuseau: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: fuseau,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SeancesSection({
  appointments,
  counts,
  fuseau,
}: {
  appointments: Appointment[];
  counts: SessionCount;
  /** Le fuseau du cabinet. */
  fuseau: string;
}) {
  const dateHeure = formateurDateHeure(fuseau);
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
              accent={counts.aQualifier > 0 ? "text-rose-700" : "text-slate-500"}
              aide={
                counts.aQualifier > 0
                  ? "Ces créneaux ne comptent nulle part tant qu'ils ne sont pas renseignés."
                  : undefined
              }
            />
          </dl>

          {aVenir.length > 0 && (
            <>
              <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-1.5">
                À venir
              </h3>
              <ul className="space-y-1.5 list-none p-0 m-0 mb-4">
                {aVenir.slice(0, 5).map((a) => (
                  <Ligne key={a.id} rdv={a} dateHeure={dateHeure} />
                ))}
              </ul>
            </>
          )}

          {passes.length > 0 && (
            <>
              <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-1.5">
                Historique
              </h3>
              {/* TROIS, PAS DIX. Ce bloc s'intercale entre le parcours et les
                  notes cliniques — les deux choses qu'on lit ensemble avant une
                  séance. Dix lignes d'historique les écartaient de la moitié
                  d'un écran de portable, pour une information qu'on va chercher
                  dans l'agenda quand on en a besoin.
                  Relevé par la relecture métier de la fiche. */}
              <ul className="space-y-1.5 list-none p-0 m-0">
                {passes.slice(0, 3).map((a) => (
                  <Ligne key={a.id} rdv={a} dateHeure={dateHeure} />
                ))}
              </ul>
              {passes.length > 3 && (
                <p className="text-xs text-slate-500 mt-2">
                  {passes.length - 3} rendez-vous plus anciens, visibles dans
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
      {aide && <p className="text-[11px] text-slate-500 leading-snug mt-0.5">{aide}</p>}
    </div>
  );
}

function Ligne({ rdv, dateHeure }: { rdv: Appointment; dateHeure: Intl.DateTimeFormat }) {
  const annule = rdv.attendance.startsWith("annule");
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <span className={`text-slate-700 ${annule ? "line-through opacity-70" : ""}`}>
        {dateHeure.format(new Date(rdv.starts_at))}
        <span className="text-slate-500"> · {APPOINTMENT_KIND_LABELS[rdv.kind]}</span>
      </span>
      <span className="flex items-center gap-2">
        {rdv.attendance_note && (
          <span className="text-xs text-slate-500 italic">{rdv.attendance_note}</span>
        )}
        <Statut
          ton={ATTENDANCE_TONS[rdv.attendance]}
          libelle={ATTENDANCE_LABELS[rdv.attendance]}
        />
      </span>
    </li>
  );
}
