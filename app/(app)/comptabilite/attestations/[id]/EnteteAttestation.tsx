"use client";

import { useState, useTransition } from "react";
import { Save } from "lucide-react";
import type { Attestation } from "@/lib/attestations/types";
import { enregistrerAttestation } from "../actions";

interface Option {
  id: string;
  nom: string;
}

interface OptionLiee extends Option {
  role: string;
  /** Lien dont la validité est passée : proposé, mais signalé. */
  revolu: boolean;
}

/**
 * L'en-tête d'un brouillon d'attestation.
 *
 * LA PÉRIODE N'EST PAS UN FILTRE D'AFFICHAGE : c'est ce que le document
 * annoncera. Les séances et règlements proposés en découlent, et rien d'autre
 * ne s'y ajoute.
 */
export default function EnteteAttestation({
  attestation,
  contactsDuDossier,
  autresContacts,
}: {
  attestation: Attestation;
  contactsDuDossier: OptionLiee[];
  autresContacts: Option[];
}) {
  const [enCours, demarrer] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [tiers, setTiers] = useState(attestation.recipient_contact_id !== null);

  function enregistrer(fd: FormData) {
    setErreur(null);
    setMessage(null);
    demarrer(async () => {
      const r = await enregistrerAttestation(fd);
      if (r.ok) setMessage(r.message ?? "Enregistré.");
      else setErreur(r.error ?? "L'enregistrement a échoué.");
    });
  }

  return (
    <form action={enregistrer} className="space-y-4">
      <input type="hidden" name="attestation_id" value={attestation.id} />

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="period_start"
            className="block text-xs font-medium text-slate-500 mb-1"
          >
            Période attestée — du
          </label>
          <input
            id="period_start"
            name="period_start"
            type="date"
            defaultValue={attestation.period_start ?? ""}
            className={styleChamp}
          />
        </div>
        <div>
          <label
            htmlFor="period_end"
            className="block text-xs font-medium text-slate-500 mb-1"
          >
            au
          </label>
          <input
            id="period_end"
            name="period_end"
            type="date"
            defaultValue={attestation.period_end ?? ""}
            className={styleChamp}
          />
        </div>
      </div>

      <fieldset className="rounded-xl border border-slate-100 p-4">
        <legend className="text-sm font-medium text-slate-700 px-1">
          Remise à
        </legend>
        <p className="text-xs text-slate-500 mb-3">
          Par défaut, l&apos;attestation est remise au patient ou à sa famille.
          Un organisme, un employeur ou une administration peut en être le
          destinataire — son nom figurera alors sur le document.
        </p>
        <label className="flex items-center gap-2 text-sm text-slate-700 mb-3">
          <input
            type="checkbox"
            name="destinataire_tiers"
            checked={tiers}
            onChange={(e) => setTiers(e.target.checked)}
            className="rounded border-slate-300"
          />
          Remettre à un tiers
        </label>
        {tiers && (
          <>
            <select
              name="recipient_contact_id"
              aria-label="Destinataire de l'attestation"
              defaultValue={attestation.recipient_contact_id ?? ""}
              className={styleChamp}
            >
              <option value="">Choisir un destinataire…</option>
              {contactsDuDossier.length > 0 && (
                <optgroup label="Entourage de ce dossier">
                  {contactsDuDossier.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nom} — {c.role}
                      {c.revolu ? " (lien révolu)" : ""}
                    </option>
                  ))}
                </optgroup>
              )}
              {autresContacts.length > 0 && (
                <optgroup label="Autres contacts du cabinet">
                  {autresContacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nom}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <p className="text-xs text-slate-400 mt-1">
              L&apos;entourage du dossier est proposé en premier, avec son rôle.
              Un contact pris ailleurs dans le cabinet n&apos;a aucun lien établi
              avec cette personne : ce document la nomme, elle et ses dates de
              venue.
            </p>
          </>
        )}
      </fieldset>

      {attestation.kind === "presence" && (
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="detail_nature"
            defaultChecked={attestation.detail_nature}
            className="rounded border-slate-300 mt-0.5"
          />
          <span>
            Préciser le type de chaque rendez-vous
            <span className="block text-xs text-slate-500">
              Sans cette option, tout est présenté comme « séance de
              psychomotricité ». Préciser — bilan, entretien, restitution — en
              dit davantage au destinataire : c&apos;est parfois utile, parfois
              une information de trop. Un entretien ou une restitution force
              cette précision, car le document ne peut pas affirmer la présence
              du patient à un rendez-vous où il n&apos;était peut-être pas.
            </span>
          </span>
        </label>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="note"
            className="block text-xs font-medium text-slate-500 mb-1"
          >
            Mention sur le document
          </label>
          <textarea
            id="note"
            name="note"
            rows={2}
            defaultValue={attestation.note ?? ""}
            className={styleChamp}
          />
          <p className="text-xs text-slate-400 mt-1">
            Visible par le destinataire. Une attestation n&apos;a pas à porter de
            contenu clinique : ni motif, ni observation, ni hypothèse.
          </p>
        </div>
        <div>
          <label
            htmlFor="internal_note"
            className="block text-xs font-medium text-slate-500 mb-1"
          >
            Note interne
          </label>
          <textarea
            id="internal_note"
            name="internal_note"
            rows={2}
            defaultValue={attestation.internal_note ?? ""}
            className={styleChamp}
          />
          <p className="text-xs text-slate-400 mt-1">
            Jamais imprimée, jamais transmise.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={enCours}
          className="inline-flex items-center gap-2 bg-slate-700 hover:bg-slate-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50"
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          {enCours ? "Enregistrement…" : "Enregistrer"}
        </button>
        {message && (
          <p role="status" className="text-sm text-emerald-700">
            {message}
          </p>
        )}
        {erreur && (
          <p role="alert" className="text-sm text-rose-700">
            {erreur}
          </p>
        )}
      </div>
    </form>
  );
}

const styleChamp =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-200";
