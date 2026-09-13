"use client";

import { useState, useTransition } from "react";
import { Dialogue } from "@/components/Dialogue";
import { Plus, Route, Target } from "lucide-react";
import { frDate } from "@/lib/format";
import { savePathway } from "../actions";
import {
  contactName,
  FUNDING_LABELS,
  OBJECTIVE_STATUS_LABELS,
  PATHWAY_STATUS_LABELS,
  PATHWAY_TONS,
  type CareObjective,
  type CarePathway,
  type Contact,
  type PathwayStatus,
} from "@/lib/dossier/types";
import { CHAMP } from "@/components/Champ";
import { Statut } from "@/components/Statut";
import { Bouton } from "@/components/Bouton";

/**
 * Parcours de prise en soin.
 *
 * C'est l'objet qui manquait : rien ne reliait le bilan initial, le suivi qui
 * l'a suivi et la réévaluation d'un an après. Un patient peut avoir plusieurs
 * parcours au cours de sa vie, chacun avec sa demande, sa prescription et ses
 * objectifs.
 */
export default function ParcoursSection({
  patientId,
  patientNom,
  patientNeLe,
  parcours,
  objectifs,
  contacts,
  canWrite,
  canReadClinical,
}: {
  patientId: string;
  patientNom: string;
  patientNeLe: string | null;
  parcours: CarePathway[];
  objectifs: CareObjective[];
  contacts: Contact[];
  canWrite: boolean;
  canReadClinical: boolean;
}) {
  const [edite, setEdite] = useState<CarePathway | "nouveau" | null>(null);
  const nomContact = (id: string | null) => {
    if (!id) return null;
    const c = contacts.find((x) => x.id === id);
    return c ? contactName(c) : null;
  };

  return (
    <section
      aria-labelledby="titre-parcours"
      className="bg-white rounded-xl border border-slate-100 shadow-sm p-5"
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <h2 id="titre-parcours" className="font-semibold text-slate-800">
          Parcours de prise en soin
        </h2>
        {canWrite && (
          <button
            type="button"
            onClick={() => setEdite("nouveau")}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50 px-3 py-1.5 rounded-lg"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nouveau parcours
          </button>
        )}
      </div>

      {parcours.length === 0 ? (
        <div className="flex items-start gap-3 py-4">
          <Route className="h-5 w-5 shrink-0 text-slate-300 mt-0.5" aria-hidden="true" />
          <p className="text-sm text-slate-500">
            Aucun parcours ouvert. Un parcours porte la demande, la prescription
            qui la couvre, les objectifs et la période de prise en soin — c&apos;est
            lui qui reliera bilan initial, séances et réévaluation.
          </p>
        </div>
      ) : (
        <ul className="space-y-3 mt-3 list-none p-0 m-0">
          {parcours.map((p) => {
            const obj = objectifs.filter((o) => o.pathway_id === p.id);
            return (
              <li
                key={p.id}
                className="rounded-lg border border-slate-100 bg-slate-50 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 text-sm">
                      {p.label ?? "Parcours"}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {[
                        p.started_on ? `Débuté le ${frDate(p.started_on)}` : null,
                        p.ended_on ? `terminé le ${frDate(p.ended_on)}` : null,
                        p.funding_scheme ? FUNDING_LABELS[p.funding_scheme] : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Statut
                      ton={PATHWAY_TONS[p.status]}
                      libelle={PATHWAY_STATUS_LABELS[p.status]}
                    />
                    {canWrite && (
                      <button
                        type="button"
                        onClick={() => setEdite(p)}
                        className="text-xs font-medium text-brand-700 hover:underline"
                      >
                        Modifier
                      </button>
                    )}
                  </div>
                </div>

                {p.referral_reason && (
                  <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">
                    « {p.referral_reason} »
                  </p>
                )}

                <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-xs mt-2">
                  {nomContact(p.prescriber_contact_id) && (
                    <Ligne
                      terme="Prescripteur"
                      valeur={`${nomContact(p.prescriber_contact_id)}${
                        p.prescription_date ? ` · ordonnance du ${frDate(p.prescription_date)}` : ""
                      }`}
                    />
                  )}
                  {nomContact(p.referral_source_contact_id) && (
                    <Ligne
                      terme="A orienté"
                      valeur={nomContact(p.referral_source_contact_id)!}
                    />
                  )}
                  {p.end_reason && <Ligne terme="Motif de fin" valeur={p.end_reason} />}
                </dl>

                {canReadClinical && obj.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <h4 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500 mb-1.5">
                      <Target className="h-3.5 w-3.5" aria-hidden="true" />
                      Objectifs
                    </h4>
                    <ul className="space-y-1 list-none p-0 m-0">
                      {obj.map((o) => (
                        <li key={o.id} className="text-sm text-slate-700">
                          <span className="text-slate-500 mr-1.5">•</span>
                          {o.label}
                          <span className="text-xs text-slate-500 ml-2">
                            ({OBJECTIVE_STATUS_LABELS[o.status]})
                          </span>
                          {o.detail && (
                            <span className="block text-xs text-slate-500 ml-4">
                              {o.detail}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {edite && (
        <DialogueParcours
          patientId={patientId}
          patientNom={patientNom}
          patientNeLe={patientNeLe}
          parcours={edite === "nouveau" ? null : edite}
          contacts={contacts}
          onClose={() => setEdite(null)}
        />
      )}
    </section>
  );
}

function Ligne({ terme, valeur }: { terme: string; valeur: string }) {
  return (
    <div>
      <dt className="text-slate-500">{terme}</dt>
      <dd className="text-slate-700">{valeur}</dd>
    </div>
  );
}

/* --------------------------------------------------------------- dialogue */


const CLOS: PathwayStatus[] = ["termine", "interrompu", "reoriente"];

function DialogueParcours({
  patientId,
  patientNom,
  patientNeLe,
  parcours,
  contacts,
  onClose,
}: {
  patientId: string;
  patientNom: string;
  patientNeLe: string | null;
  parcours: CarePathway | null;
  contacts: Contact[];
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [statut, setStatut] = useState<PathwayStatus>(parcours?.status ?? "demande");

  const soumettre = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setErreur(null);
    start(async () => {
      const res = await savePathway(fd);
      if (!res.ok) {
        setErreur(res.error);
        return;
      }
      onClose();
    });
  };

  return (
    <Dialogue ouvert onFermer={onClose} titre={parcours ? "Modifier le parcours" : "Nouveau parcours"}
      /* LE DOSSIER EST NOMMÉ DANS LA FENÊTRE. `showModal()` rend inerte tout
         ce qui est derrière : le nom du patient, en tête de page, devient
         inatteignable — y compris pour un lecteur d'écran — et le titre de
         l'onglet est délibérément statique.
         Les quatre écrits cliniques du lot 4 passaient déjà cette description ;
         les quatre blocs du dossier, plus anciens, ne la passaient pas. Celui
         qui écrit une NOTE CLINIQUE était le plus exposé des quatre.
         Relevé par la relecture métier de la fiche. */
      description={`${patientNom}${patientNeLe ? ` · né(e) le ${frDate(patientNeLe)}` : ""}`}
      taille="petite"
    >
        <form onSubmit={soumettre} className="px-6 py-5 space-y-4">
          <input type="hidden" name="patient_id" value={patientId} />
          {parcours && <input type="hidden" name="id" value={parcours.id} />}

          <Champ name="label" label="Intitulé" defaultValue={parcours?.label ?? ""} />

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="status" className="block text-sm text-slate-700 mb-1">
                Statut
              </label>
              <select
                id="status"
                name="status"
                value={statut}
                onChange={(e) => setStatut(e.target.value as PathwayStatus)}
                className={CHAMP}
              >
                {Object.entries(PATHWAY_STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="funding_scheme" className="block text-sm text-slate-700 mb-1">
                Financement
              </label>
              <select
                id="funding_scheme"
                name="funding_scheme"
                defaultValue={parcours?.funding_scheme ?? "liberal"}
                className={CHAMP}
              >
                {Object.entries(FUNDING_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="referral_reason"
              className="block text-sm text-slate-700 mb-1"
            >
              Motif de la demande
            </label>
            <textarea
              id="referral_reason"
              name="referral_reason"
              rows={3}
              defaultValue={parcours?.referral_reason ?? ""}
              aria-describedby="aide-motif"
              className={CHAMP}
            />
            <p id="aide-motif" className="text-xs text-slate-500 mt-1">
              Dans les termes du demandeur : c&apos;est à cette question que le
              compte rendu devra répondre.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <SelectContact
              name="prescriber_contact_id"
              label="Prescripteur"
              contacts={contacts}
              defaultValue={parcours?.prescriber_contact_id ?? ""}
            />
            <SelectContact
              name="referral_source_contact_id"
              label="A orienté vers le cabinet"
              contacts={contacts}
              defaultValue={parcours?.referral_source_contact_id ?? ""}
            />
            <Champ
              name="prescription_date"
              label="Date d'ordonnance"
              type="date"
              defaultValue={parcours?.prescription_date ?? ""}
            />
            <Champ
              name="prescription_reference"
              label="Référence d'ordonnance"
              defaultValue={parcours?.prescription_reference ?? ""}
            />
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <Champ
              name="requested_on"
              label="Demande reçue le"
              type="date"
              defaultValue={parcours?.requested_on ?? ""}
            />
            <Champ
              name="started_on"
              label="Début"
              type="date"
              defaultValue={parcours?.started_on ?? ""}
            />
            <Champ
              name="ended_on"
              label="Fin"
              type="date"
              defaultValue={parcours?.ended_on ?? ""}
            />
          </div>

          {CLOS.includes(statut) && (
            <div>
              <label htmlFor="end_reason" className="block text-sm text-slate-700 mb-1">
                Motif de fin
              </label>
              <textarea
                id="end_reason"
                name="end_reason"
                rows={2}
                defaultValue={parcours?.end_reason ?? ""}
                placeholder="Objectifs atteints, déménagement, arrêt à l'initiative de la famille…"
                className={CHAMP}
              />
              <p className="text-xs text-slate-500 mt-1">
                Un statut de fin demande une date de fin.
              </p>
            </div>
          )}

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
            <Bouton variante="libre"
              type="submit"
              pending={pending}
              className="px-5 py-2 text-sm text-white bg-brand-600 hover:bg-brand-700 rounded-lg"
              pendingLabel="Enregistrement…"
            >
              Enregistrer
            </Bouton>
          </div>
        </form>
      </Dialogue>
  );
}

function Champ({
  name,
  label,
  type = "text",
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm text-slate-700 mb-1">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        className={CHAMP}
      />
    </div>
  );
}

function SelectContact({
  name,
  label,
  contacts,
  defaultValue,
}: {
  name: string;
  label: string;
  contacts: Contact[];
  defaultValue?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm text-slate-700 mb-1">
        {label}
      </label>
      <select id={name} name={name} defaultValue={defaultValue} className={CHAMP}>
        <option value="">Non renseigné</option>
        {contacts.map((c) => (
          <option key={c.id} value={c.id}>
            {contactName(c)}
            {c.profession ? ` (${c.profession})` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
