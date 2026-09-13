"use client";

import { useState, useTransition } from "react";
import { Dialogue } from "@/components/Dialogue";
import { FileCheck, Plus } from "lucide-react";
import { frDate } from "@/lib/format";
import { saveConsent, withdrawConsent } from "../actions";
import {
  contactName,
  CONSENT_LABELS,
  type Contact,
  type ConsentKind,
  type PatientConsent,
} from "@/lib/dossier/types";
import { CHAMP } from "@/components/Champ";

/**
 * Autorisations et consentements.
 *
 * Un consentement se donne ET se retire. La ligne retirée demeure : savoir
 * qu'une autorisation a existé puis a été révoquée fait partie de la trace, et
 * c'est ce qui permet de comprendre pourquoi un document a pu être transmis à
 * une date et plus à une autre.
 */
export default function ConsentementsSection({
  patientId,
  consentements,
  contacts,
  canWrite,
}: {
  patientId: string;
  consentements: PatientConsent[];
  contacts: Contact[];
  canWrite: boolean;
}) {
  const [ouvert, setOuvert] = useState(false);

  const actifs = consentements.filter((c) => !c.withdrawn_on);
  const retires = consentements.filter((c) => c.withdrawn_on);

  return (
    <section
      aria-labelledby="titre-consentements"
      className="bg-white rounded-xl border border-slate-100 shadow-sm p-5"
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <h2 id="titre-consentements" className="font-semibold text-slate-800">
          Autorisations
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

      {actifs.length === 0 ? (
        <div className="flex items-start gap-3 py-4">
          <FileCheck className="h-5 w-5 shrink-0 text-slate-300 mt-0.5" aria-hidden="true" />
          <p className="text-sm text-slate-500">
            Aucune autorisation enregistrée. Tracer un accord, même oral, permet
            de savoir ce qui peut être transmis, à qui, et depuis quand.
          </p>
        </div>
      ) : (
        <ul className="space-y-2 mt-3 list-none p-0 m-0">
          {actifs.map((c) => (
            <LigneConsentement
              key={c.id}
              consentement={c}
              contacts={contacts}
              patientId={patientId}
              canWrite={canWrite}
            />
          ))}
        </ul>
      )}

      {retires.length > 0 && (
        <details className="mt-4 pt-4 border-t border-slate-100">
          <summary className="text-sm text-slate-500 cursor-pointer hover:text-slate-700">
            {retires.length} autorisation{retires.length > 1 ? "s" : ""} retirée
            {retires.length > 1 ? "s" : ""}
          </summary>
          <ul className="mt-3 space-y-2 list-none p-0">
            {retires.map((c) => (
              <li key={c.id} className="text-sm text-slate-500">
                <span className="font-medium">{CONSENT_LABELS[c.kind]}</span> —
                retirée le {frDate(c.withdrawn_on!)}
                {c.scope && <span className="block text-xs">{c.scope}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}

      {ouvert && (
        <DialogueConsentement
          patientId={patientId}
          contacts={contacts}
          onClose={() => setOuvert(false)}
        />
      )}
    </section>
  );
}

function LigneConsentement({
  consentement,
  contacts,
  patientId,
  canWrite,
}: {
  consentement: PatientConsent;
  contacts: Contact[];
  patientId: string;
  canWrite: boolean;
}) {
  const [pending, start] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const donneur = contacts.find((c) => c.id === consentement.granted_by_contact_id);

  const retirer = () => {
    if (
      !confirm(
        `Retirer l'autorisation « ${CONSENT_LABELS[consentement.kind]} » ?\n\n` +
          "La ligne est conservée avec sa date de retrait.",
      )
    )
      return;
    const fd = new FormData();
    fd.set("id", consentement.id);
    fd.set("patient_id", patientId);
    setErreur(null);
    start(async () => {
      const res = await withdrawConsent(fd);
      if (!res.ok) setErreur(res.error);
    });
  };

  return (
    <li className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
      <div className="min-w-0 text-sm">
        <p className="font-medium text-slate-800">{CONSENT_LABELS[consentement.kind]}</p>
        {consentement.scope && (
          <p className="text-xs text-slate-600">{consentement.scope}</p>
        )}
        <p className="text-xs text-slate-500">
          {[
            consentement.granted_on ? `Accordée le ${frDate(consentement.granted_on)}` : null,
            donneur ? `par ${contactName(donneur)}` : null,
            consentement.granted_by_patient ? "par le patient" : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {consentement.evidence && (
          <p className="text-xs text-slate-500 italic">{consentement.evidence}</p>
        )}
        {erreur && (
          <p role="alert" className="text-xs text-red-700 mt-1">
            {erreur}
          </p>
        )}
      </div>
      {canWrite && (
        <button
          type="button"
          onClick={retirer}
          disabled={pending}
          className="shrink-0 text-xs font-medium text-slate-500 hover:text-rose-700 hover:underline disabled:opacity-50"
        >
          Retirer
        </button>
      )}
    </li>
  );
}


function DialogueConsentement({
  patientId,
  contacts,
  onClose,
}: {
  patientId: string;
  contacts: Contact[];
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  const soumettre = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setErreur(null);
    start(async () => {
      const res = await saveConsent(fd);
      if (!res.ok) {
        setErreur(res.error);
        return;
      }
      onClose();
    });
  };

  return (
    <Dialogue ouvert onFermer={onClose} titre="Nouvelle autorisation" taille="petite">
        <form onSubmit={soumettre} className="px-6 py-5 space-y-4">
          <input type="hidden" name="patient_id" value={patientId} />

          <div>
            <label htmlFor="kind" className="block text-sm text-slate-700 mb-1">
              Type
            </label>
            <select id="kind" name="kind" className={CHAMP}>
              {(Object.keys(CONSENT_LABELS) as ConsentKind[]).map((k) => (
                <option key={k} value={k}>
                  {CONSENT_LABELS[k]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="scope" className="block text-sm text-slate-700 mb-1">
              Portée
            </label>
            <input
              id="scope"
              name="scope"
              placeholder="Compte rendu de bilan au médecin prescripteur"
              className={CHAMP}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="granted_by_contact_id"
                className="block text-sm text-slate-700 mb-1"
              >
                Accordée par
              </label>
              <select
                id="granted_by_contact_id"
                name="granted_by_contact_id"
                className={CHAMP}
              >
                <option value="">Non précisé</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {contactName(c)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="granted_on" className="block text-sm text-slate-700 mb-1">
                Le
              </label>
              <input
                id="granted_on"
                name="granted_on"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                className={CHAMP}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="granted_by_patient" />
            Accordée par le patient lui-même
          </label>

          <div>
            <label htmlFor="evidence" className="block text-sm text-slate-700 mb-1">
              Trace
            </label>
            <input
              id="evidence"
              name="evidence"
              placeholder="Formulaire signé, accord oral tracé en séance…"
              className={CHAMP}
            />
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
