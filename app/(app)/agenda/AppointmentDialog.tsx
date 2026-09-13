"use client";

import { useState, useTransition } from "react";
import { Dialogue } from "@/components/Dialogue";
import { Trash2 } from "lucide-react";
import {
  deleteAppointment,
  saveAppointment,
  saveAppointmentSeries,
} from "./actions";
import {
  APPOINTMENT_KIND_LABELS,
  patientName,
  type Appointment,
  type AppointmentKind,
} from "@/lib/dossier/types";
import type { PatientListItem } from "@/lib/dossier/queries";
import { CHAMP } from "@/components/Champ";


/** Types de rendez-vous qui ne concernent personne en particulier. */
const SANS_PATIENT: AppointmentKind[] = ["reunion", "administratif", "autre"];

export default function AppointmentDialog({
  appointment,
  patients,
  jourParDefaut,
  onClose,
}: {
  appointment: Appointment | null;
  patients: PatientListItem[];
  jourParDefaut: string;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [kind, setKind] = useState<AppointmentKind>(appointment?.kind ?? "seance");
  const [serie, setSerie] = useState(false);

  const debut = appointment ? new Date(appointment.starts_at) : null;
  const fin = appointment ? new Date(appointment.ends_at) : null;
  const dureeInitiale =
    debut && fin ? Math.round((fin.getTime() - debut.getTime()) / 60_000) : 45;

  const dateInitiale = debut
    ? `${debut.getFullYear()}-${String(debut.getMonth() + 1).padStart(2, "0")}-${String(debut.getDate()).padStart(2, "0")}`
    : jourParDefaut;
  const heureInitiale = debut
    ? `${String(debut.getHours()).padStart(2, "0")}:${String(debut.getMinutes()).padStart(2, "0")}`
    : "09:00";

  const sansPatient = SANS_PATIENT.includes(kind);

  const soumettre = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setErreur(null);
    start(async () => {
      const res = serie
        ? await saveAppointmentSeries(fd)
        : await saveAppointment(fd);
      if (!res.ok) {
        setErreur(res.error);
        return;
      }
      onClose();
    });
  };

  const supprimer = () => {
    if (!appointment) return;
    if (
      !confirm(
        "Supprimer ce rendez-vous ?\n\n" +
          "Les notes cliniques prises ce jour-là sont conservées : elles se " +
          "détachent du rendez-vous, elles ne disparaissent pas.",
      )
    )
      return;
    const fd = new FormData();
    fd.set("id", appointment.id);
    setErreur(null);
    start(async () => {
      const res = await deleteAppointment(fd);
      if (!res.ok) {
        setErreur(res.error);
        return;
      }
      onClose();
    });
  };

  return (
    <Dialogue ouvert onFermer={onClose} titre={appointment ? "Modifier le rendez-vous" : "Nouveau rendez-vous"} taille="petite">
        <form onSubmit={soumettre} className="px-6 py-5 space-y-4">
          {appointment && <input type="hidden" name="id" value={appointment.id} />}

          <div>
            <label htmlFor="kind" className="block text-sm text-slate-700 mb-1">
              Type
            </label>
            <select
              id="kind"
              name="kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as AppointmentKind)}
              className={CHAMP}
            >
              {(Object.keys(APPOINTMENT_KIND_LABELS) as AppointmentKind[]).map((k) => (
                <option key={k} value={k}>
                  {APPOINTMENT_KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </div>

          {!sansPatient ? (
            <div>
              <label htmlFor="patient_id" className="block text-sm text-slate-700 mb-1">
                Patient
              </label>
              <select
                id="patient_id"
                name="patient_id"
                required
                defaultValue={appointment?.patient_id ?? ""}
                className={CHAMP}
              >
                <option value="">— Choisir —</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {patientName(p)}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label htmlFor="title" className="block text-sm text-slate-700 mb-1">
                Intitulé
              </label>
              <input
                id="title"
                name="title"
                required
                defaultValue={appointment?.title ?? ""}
                placeholder="Rédaction des comptes rendus, équipe éducative…"
                className={CHAMP}
              />
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="date" className="block text-sm text-slate-700 mb-1">
                Date
              </label>
              <input
                id="date"
                name="date"
                type="date"
                required
                defaultValue={dateInitiale}
                className={CHAMP}
              />
            </div>
            <div>
              <label htmlFor="start_time" className="block text-sm text-slate-700 mb-1">
                Heure
              </label>
              <input
                id="start_time"
                name="start_time"
                type="time"
                required
                defaultValue={heureInitiale}
                className={CHAMP}
              />
            </div>
            <div>
              <label htmlFor="duration" className="block text-sm text-slate-700 mb-1">
                Durée
              </label>
              <select
                id="duration"
                name="duration"
                defaultValue={String(dureeInitiale)}
                className={CHAMP}
              >
                {[30, 45, 60, 90, 120].map((m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!appointment && !sansPatient && (
            <div className="rounded-lg bg-slate-50 p-3">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={serie}
                  onChange={(e) => setSerie(e.target.checked)}
                />
                Créer une série hebdomadaire
              </label>
              {serie && (
                <div className="mt-2">
                  <label
                    htmlFor="occurrences"
                    className="block text-xs text-slate-600 mb-1"
                  >
                    Nombre de séances
                  </label>
                  <input
                    id="occurrences"
                    name="occurrences"
                    type="number"
                    min={2}
                    max={30}
                    defaultValue={10}
                    className="w-28 rounded-lg border border-slate-500 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                  />
                  <p className="text-xs text-slate-500 mt-1.5">
                    Chaque séance est créée séparément : vous pourrez en déplacer
                    ou en annuler une sans toucher aux autres. Il n&apos;y a pas de
                    règle de récurrence cachée derrière.
                  </p>
                </div>
              )}
            </div>
          )}

          <div>
            <label htmlFor="note" className="block text-sm text-slate-700 mb-1">
              Note d&apos;organisation
            </label>
            <input
              id="note"
              name="note"
              defaultValue={appointment?.note ?? ""}
              placeholder="Les deux parents sont conviés…"
              aria-describedby="aide-note-rdv"
              className={CHAMP}
            />
            <p id="aide-note-rdv" className="text-xs text-slate-500 mt-1">
              Information pratique. Les observations de séance se saisissent dans
              les notes du dossier, qui portent leur date et leur auteur.
            </p>
          </div>

          {erreur && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200"
            >
              {erreur}
            </p>
          )}

          <div className="flex items-center justify-between gap-2">
            {appointment ? (
              <button
                type="button"
                onClick={supprimer}
                disabled={pending}
                className="inline-flex items-center gap-1.5 text-sm text-rose-600 hover:bg-rose-50 px-3 py-2 rounded-lg disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Supprimer
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={pending}
                className="px-5 py-2 text-sm text-white bg-brand-600 hover:bg-brand-700 rounded-lg disabled:opacity-60"
              >
                {pending ? "Enregistrement…" : serie ? "Créer la série" : "Enregistrer"}
              </button>
            </div>
          </div>
        </form>
      </Dialogue>
  );
}
