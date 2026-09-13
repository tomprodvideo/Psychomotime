"use client";

import { useState, useTransition } from "react";
import { Dialogue } from "@/components/Dialogue";
import { Plus, NotebookPen, ShieldAlert } from "lucide-react";
import { frDate } from "@/lib/format";
import { ATTENDANCE_LABELS } from "@/lib/dossier/types";
import { saveNote } from "../actions";
import type {
  Appointment,
  CarePathway,
  PatientNote,
} from "@/lib/dossier/types";
import { CHAMP } from "@/components/Champ";

/**
 * Notes cliniques.
 *
 * Elles remplacent le champ texte libre du dossier, qui n'avait ni auteur, ni
 * date, ni statut — ce que la sécurité clinique exige pourtant.
 *
 * Le marquage « information venant d'un tiers » applique l'article L1111-7 du
 * code de la santé publique : le droit d'accès du patient exclut les
 * informations recueillies auprès d'un tiers n'intervenant pas dans la prise en
 * charge, ou concernant un tel tiers. Marquer l'information est le seul moyen
 * technique de préparer un jour une communication de dossier conforme. Le
 * produit ne promet pas pour autant qu'une note soit inaccessible.
 */
export default function NotesSection({
  patientId,
  notes,
  parcours,
  seances,
  canWrite,
}: {
  patientId: string;
  notes: PatientNote[];
  parcours: CarePathway[];
  /** Les séances passées du dossier, pour rattacher une note à l'une d'elles. */
  seances: Appointment[];
  canWrite: boolean;
}) {
  const [ouvert, setOuvert] = useState(false);
  /* Un index, pas une recherche par note : sans lui, afficher la séance de
   * chaque note coûterait un parcours de la liste par note. */
  const seanceParId = new Map(seances.map((r) => [r.id, r]));

  return (
    <section
      aria-labelledby="titre-notes"
      className="bg-white rounded-xl border border-slate-100 shadow-sm p-5"
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <h2 id="titre-notes" className="font-semibold text-slate-800">
          Notes cliniques
        </h2>
        {canWrite && (
          <button
            type="button"
            onClick={() => setOuvert(true)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50 px-3 py-1.5 rounded-lg"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Ajouter
          </button>
        )}
      </div>

      {notes.length === 0 ? (
        <div className="flex items-start gap-3 py-4">
          <NotebookPen
            className="h-5 w-5 shrink-0 text-slate-300 mt-0.5"
            aria-hidden="true"
          />
          <p className="text-sm text-slate-500">
            Aucune note. Chaque note porte sa date et son auteur, et peut être
            rattachée à un parcours.
          </p>
        </div>
      ) : (
        <ul className="space-y-3 mt-3 list-none p-0 m-0">
          {notes.map((n) => (
            <li
              key={n.id}
              className={`rounded-lg p-3 ${
                n.third_party_information
                  ? "bg-amber-50 ring-1 ring-amber-200"
                  : "bg-slate-50"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-xs text-slate-500">
                  {frDate(n.written_on)}
                  {n.appointment_id && seanceParId.get(n.appointment_id) && (
                    <span className="text-brand-700">
                      {" · séance du "}
                      {frDate(
                        seanceParId.get(n.appointment_id)!.starts_at.slice(0, 10),
                      )}
                    </span>
                  )}
                </p>
                {n.third_party_information && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-800">
                    <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                    Information d&apos;un tiers
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{n.body}</p>
              {n.third_party_source && (
                <p className="text-xs text-amber-800 mt-1.5">
                  Source : {n.third_party_source}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {ouvert && (
        <DialogueNote
          patientId={patientId}
          parcours={parcours}
          seances={seances}
          onClose={() => setOuvert(false)}
        />
      )}
    </section>
  );
}


function DialogueNote({
  patientId,
  parcours,
  seances,
  onClose,
}: {
  patientId: string;
  parcours: CarePathway[];
  seances: Appointment[];
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [tiers, setTiers] = useState(false);

  const soumettre = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setErreur(null);
    start(async () => {
      const res = await saveNote(fd);
      if (!res.ok) {
        setErreur(res.error);
        return;
      }
      onClose();
    });
  };

  return (
    <Dialogue ouvert onFermer={onClose} titre="Nouvelle note" taille="petite">
        <form onSubmit={soumettre} className="px-6 py-5 space-y-4">
          <input type="hidden" name="patient_id" value={patientId} />

          <div>
            <label htmlFor="body" className="block text-sm text-slate-700 mb-1">
              Note
            </label>
            <textarea
              id="body"
              name="body"
              rows={6}
              required
              autoFocus
              aria-describedby="aide-note"
              className={CHAMP}
            />
            <p id="aide-note" className="text-xs text-slate-500 mt-1">
              Distinguez ce qui est observé de ce qui est pensé. Une note reste
              une donnée de santé, potentiellement communicable.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="written_on" className="block text-sm text-slate-700 mb-1">
                Date
              </label>
              <input
                id="written_on"
                name="written_on"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                className={CHAMP}
              />
            </div>
            {parcours.length > 0 && (
              <div>
                <label htmlFor="pathway_id" className="block text-sm text-slate-700 mb-1">
                  Parcours
                </label>
                <select id="pathway_id" name="pathway_id" className={CHAMP}>
                  <option value="">Sans rattachement</option>
                  {parcours.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label ?? "Parcours"}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {seances.length > 0 && (
            <div>
              <label htmlFor="appointment_id" className="block text-sm text-slate-700 mb-1">
                Séance racontée (facultatif)
              </label>
              <select id="appointment_id" name="appointment_id" className={CHAMP}>
                <option value="">Aucune séance en particulier</option>
                {seances.map((r) => (
                  <option key={r.id} value={r.id}>
                    {frDate(r.starts_at.slice(0, 10))} ·{" "}
                    {ATTENDANCE_LABELS[r.attendance] ?? r.attendance}
                  </option>
                ))}
              </select>
              {/* Toutes les notes ne racontent pas une séance : un appel de la
                  mère entre deux rendez-vous est une note du dossier, pas une
                  note de séance. Le rattachement reste facultatif. */}
              <p className="text-xs text-slate-500 mt-1">
                Rattacher la note à une séance permet de relire ce qui a été
                travaillé, séance par séance.
              </p>
            </div>
          )}

          <div className="rounded-lg bg-amber-50 ring-1 ring-amber-200 p-3">
            <label className="flex items-start gap-2 text-sm text-amber-900">
              <input
                type="checkbox"
                name="third_party_information"
                checked={tiers}
                onChange={(e) => setTiers(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Cette note vient d&apos;un tiers, ou le concerne
                <span className="block text-xs text-amber-800 mt-0.5">
                  Le droit d&apos;accès du patient exclut les informations
                  recueillies auprès d&apos;un tiers n&apos;intervenant pas dans
                  la prise en charge (article L1111-7 du code de la santé
                  publique). Ce marquage permet de les distinguer le jour où le
                  dossier serait communiqué.
                </span>
              </span>
            </label>
            {tiers && (
              <div className="mt-3">
                <label
                  htmlFor="third_party_source"
                  className="block text-xs text-amber-900 mb-1"
                >
                  Origine de l&apos;information
                </label>
                <input
                  id="third_party_source"
                  name="third_party_source"
                  placeholder="Entretien téléphonique avec…"
                  className="w-full rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
              </div>
            )}
          </div>

          {erreur && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200"
            >
              {erreur}
            </p>
          )}

          <div className="flex justify-end gap-2">
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
              {pending ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </form>
      </Dialogue>
  );
}
