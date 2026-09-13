"use client";

import { useState, useTransition } from "react";
import { NotebookPen } from "lucide-react";
import { Dialogue } from "@/components/Dialogue";
import { frDate } from "@/lib/format";
import { saveNote } from "../patients/actions";
import type { AppointmentWithPatient } from "@/lib/dossier/types";
import { patientName } from "@/lib/dossier/types";

const CHAMP =
  "w-full rounded-lg border border-slate-500 px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

/**
 * Écrire la note d'une séance depuis l'agenda.
 *
 * POURQUOI ICI, alors que la fiche du dossier le permet déjà : c'est ICI que
 * le geste est naturel. On vient de constater que la séance a eu lieu ; ce
 * qu'on a travaillé est encore frais. Passer par la fiche suppose de quitter
 * l'agenda, de retrouver le dossier, puis de retrouver la séance dans une
 * liste — trois gestes à un moment où l'on en enchaîne dix.
 *
 * LA SÉANCE N'EST PAS CHOISIE, ELLE EST DONNÉE. Le rattachement vient du
 * rendez-vous sur lequel on a cliqué : il ne peut pas se tromper de séance, ni
 * de dossier. C'est la différence avec la fiche, où il faut la désigner.
 *
 * LA DATE PROPOSÉE EST CELLE DE LA SÉANCE, pas celle du jour. On écrit
 * souvent le mercredi la séance du lundi, et c'est la date de la séance qui
 * situe l'observation.
 */
export default function NoteSeanceBouton({
  appointment,
  aDejaUneNote,
}: {
  appointment: AppointmentWithPatient;
  /** Une séance déjà notée le dit : sans cela, on relit tout pour savoir. */
  aDejaUneNote: boolean;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [pending, start] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [tiers, setTiers] = useState(false);

  /* Un créneau sans dossier — réunion, temps administratif — n'est pas une
   * séance : il ne porte pas de note clinique. La base le refuse aussi. */
  if (!appointment.patient_id) return null;

  const jour = appointment.starts_at.slice(0, 10);

  const soumettre = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("patient_id", appointment.patient_id!);
    fd.set("appointment_id", appointment.id);
    setErreur(null);
    start(async () => {
      const res = await saveNote(fd);
      if (!res.ok) {
        setErreur(res.error);
        return;
      }
      setOuvert(false);
      setTiers(false);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-brand-800 hover:bg-brand-50 border border-slate-200 rounded-lg px-2 py-1"
      >
        <NotebookPen className="h-3.5 w-3.5" aria-hidden="true" />
        {aDejaUneNote ? "Note écrite" : "Note de séance"}
      </button>

      <Dialogue
        ouvert={ouvert}
        onFermer={() => setOuvert(false)}
        titre="Note de séance"
        description={`${
          appointment.patient ? patientName(appointment.patient) : "Dossier"
        } · séance du ${frDate(jour)}`}
        taille="petite"
      >
        <form onSubmit={soumettre} className="px-6 py-5 space-y-4">
          <div>
            <label htmlFor="body-seance" className="block text-sm text-slate-700 mb-1">
              Ce qui a été travaillé
            </label>
            <textarea
              id="body-seance"
              name="body"
              rows={6}
              required
              autoFocus
              aria-describedby="aide-note-seance"
              className={CHAMP}
            />
            <p id="aide-note-seance" className="text-xs text-slate-500 mt-1">
              Distinguez ce qui est observé de ce qui est pensé. Une note reste
              une donnée de santé, potentiellement communicable.
            </p>
          </div>

          <div>
            <label htmlFor="written_on-seance" className="block text-sm text-slate-700 mb-1">
              Date de la note
            </label>
            <input
              id="written_on-seance"
              name="written_on"
              type="date"
              defaultValue={jour}
              className={CHAMP}
            />
          </div>

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
                <span className="block text-xs mt-1">
                  Le droit d&apos;accès du patient exclut les informations
                  recueillies auprès d&apos;un tiers n&apos;intervenant pas dans
                  la prise en charge (article L1111-7 du code de la santé
                  publique). Ce marquage permet de les distinguer le jour où le
                  dossier serait communiqué.
                </span>
              </span>
            </label>
            {tiers && (
              <div className="mt-2">
                <label
                  htmlFor="third_party_source-seance"
                  className="block text-xs text-amber-900 mb-1"
                >
                  De qui vient cette information ?
                </label>
                <input
                  id="third_party_source-seance"
                  name="third_party_source"
                  placeholder="Ex. la mère, l'enseignante"
                  className={CHAMP}
                />
              </div>
            )}
          </div>

          {erreur && (
            <p role="alert" className="text-sm text-red-700">
              {erreur}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOuvert(false)}
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
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
    </>
  );
}
