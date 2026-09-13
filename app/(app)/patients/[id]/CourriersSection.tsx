"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Plus, Send, Printer, Ban } from "lucide-react";
import { Dialogue } from "@/components/Dialogue";
import { frDate } from "@/lib/format";
import {
  COURRIER_STATUS_LABELS,
  messageConsentement,
  type EtatConsentement,
} from "@/lib/courriers/types";
import type { CourrierAvecDestinataire } from "@/lib/courriers/queries";
import {
  annulerCourrier,
  enregistrerCourrier,
  remettreCourrier,
  supprimerBrouillonCourrier,
} from "../../courriers/actions";

const CHAMP =
  "w-full rounded-lg border border-slate-500 px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

export interface OptionDestinataire {
  id: string;
  nom: string;
  role?: string;
  /** « dossier » ou « cabinet ». Les deux groupes sont séparés à l'œil. */
  groupe: "dossier" | "cabinet";
}

/**
 * Les courriers de liaison d'un dossier.
 *
 * CE QUE CET ÉCRAN DOIT FAIRE COMPRENDRE : un courrier de liaison part chez
 * quelqu'un. Une fois remis, il ne se modifie plus — il s'annule, avec un
 * motif, et on en écrit un autre. C'est la même doctrine que les factures et
 * les attestations, pour la même raison : ce qui est parti est parti.
 *
 * LE DESTINATAIRE VIENT EN DEUX GROUPES, séparés à l'œil : l'entourage du
 * dossier d'abord, le reste du cabinet ensuite. Proposer indistinctement tous
 * les contacts rendrait possible d'écrire au confrère d'un autre patient au
 * sujet de celui-ci.
 */
export default function CourriersSection({
  patientId,
  courriers,
  destinataires,
  consentement,
  erreur,
  canWrite,
}: {
  patientId: string;
  courriers: CourrierAvecDestinataire[];
  destinataires: OptionDestinataire[];
  consentement: EtatConsentement;
  erreur: string | null;
  canWrite: boolean;
}) {
  const [edite, setEdite] = useState<CourrierAvecDestinataire | "nouveau" | null>(
    null,
  );

  return (
    <section className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-slate-800">Courriers de liaison</h2>
        {canWrite && (
          <button
            type="button"
            onClick={() => setEdite("nouveau")}
            className="inline-flex items-center gap-1.5 text-sm text-brand-700 hover:text-brand-900"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Écrire
          </button>
        )}
      </div>

      {/* LE PRODUIT DIT CE QU'IL SAIT, IL NE BLOQUE PAS. Un accord retiré est
          signalé fortement ; son absence, simplement dite. Exiger un accord
          serait inventer une obligation ; la taire serait pire. */}
      <p
        className={`text-xs mt-2 rounded-lg px-3 py-2 ${
          consentement === "retire"
            ? "bg-rose-50 text-rose-800 ring-1 ring-rose-200"
            : "text-slate-500"
        }`}
      >
        {messageConsentement(consentement)}
      </p>

      {erreur && (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          {erreur}
        </p>
      )}

      {courriers.length === 0 ? (
        <p className="text-sm text-slate-500 mt-3">
          Aucun courrier. Un courrier de liaison est une page adressée à un
          professionnel nommé — une question, ou un élément à transmettre.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100 list-none p-0 m-0">
          {courriers.map((c) => (
            <LigneCourrier
              key={c.id}
              courrier={c}
              patientId={patientId}
              canWrite={canWrite}
              onEdit={() => setEdite(c)}
            />
          ))}
        </ul>
      )}

      {edite && (
        <DialogueCourrier
          patientId={patientId}
          courrier={edite === "nouveau" ? null : edite}
          destinataires={destinataires}
          onClose={() => setEdite(null)}
        />
      )}
    </section>
  );
}

function LigneCourrier({
  courrier: c,
  patientId,
  canWrite,
  onEdit,
}: {
  courrier: CourrierAvecDestinataire;
  patientId: string;
  canWrite: boolean;
  onEdit: () => void;
}) {
  const [pending, start] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [annulation, setAnnulation] = useState(false);

  const nom =
    c.destinataire?.organisation_name?.trim() ||
    `${c.destinataire?.first_name ?? ""} ${c.destinataire?.last_name ?? ""}`.trim() ||
    "Destinataire";

  const agir = (action: (fd: FormData) => Promise<{ ok: boolean; error?: string }>, fd: FormData) => {
    setErreur(null);
    start(async () => {
      const res = await action(fd);
      if (!res.ok) setErreur(res.error ?? "L'action a échoué.");
      else setAnnulation(false);
    });
  };

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <p className="text-sm text-slate-800">
            {c.subject}
            <span className="text-slate-500"> — {nom}</span>
            {c.destinataire?.profession && (
              <span className="text-slate-500"> ({c.destinataire.profession})</span>
            )}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {/* L'état est ÉCRIT, pas seulement coloré. */}
            <span
              className={
                c.status === "emis"
                  ? "text-brand-700"
                  : c.status === "annule"
                    ? "text-rose-700"
                    : "text-amber-700"
              }
            >
              {COURRIER_STATUS_LABELS[c.status]}
            </span>
            {c.issued_on && ` le ${frDate(c.issued_on)}`}
            {c.cancellation_reason && ` · ${c.cancellation_reason}`}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {c.status !== "brouillon" && (
            <Link
              href={`/courriers/${c.id}/document`}
              className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-brand-800"
            >
              <Printer className="h-3.5 w-3.5" aria-hidden="true" />
              Imprimer
            </Link>
          )}
          {canWrite && c.status === "brouillon" && (
            <>
              <button
                type="button"
                onClick={onEdit}
                className="text-xs text-brand-700 hover:underline"
              >
                Modifier
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  const fd = new FormData();
                  fd.set("id", c.id);
                  fd.set("patient_id", patientId);
                  agir(remettreCourrier, fd);
                }}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 border border-brand-200 rounded-lg px-2 py-1 hover:bg-brand-50 disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" aria-hidden="true" />
                Remettre
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  const fd = new FormData();
                  fd.set("id", c.id);
                  fd.set("patient_id", patientId);
                  agir(supprimerBrouillonCourrier, fd);
                }}
                className="text-xs text-slate-500 hover:text-rose-700 disabled:opacity-50"
              >
                Supprimer
              </button>
            </>
          )}
          {canWrite && c.status === "emis" && (
            <button
              type="button"
              onClick={() => setAnnulation(true)}
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-rose-700"
            >
              <Ban className="h-3.5 w-3.5" aria-hidden="true" />
              Annuler
            </button>
          )}
        </div>
      </div>

      {annulation && (
        <form
          className="mt-2 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            fd.set("id", c.id);
            fd.set("patient_id", patientId);
            agir(annulerCourrier, fd);
          }}
        >
          <div className="grow min-w-48">
            <label htmlFor={`motif-${c.id}`} className="block text-xs text-slate-600 mb-1">
              Pourquoi ce courrier est-il annulé ?
            </label>
            <input id={`motif-${c.id}`} name="reason" required className={CHAMP} />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="px-3 py-2 text-sm text-white bg-rose-700 hover:bg-rose-800 rounded-lg disabled:opacity-60"
          >
            Annuler le courrier
          </button>
          <button
            type="button"
            onClick={() => setAnnulation(false)}
            className="px-2 py-2 text-sm text-slate-600"
          >
            Revenir
          </button>
        </form>
      )}

      {erreur && (
        <p role="alert" className="text-xs text-red-700 mt-1">
          {erreur}
        </p>
      )}
    </li>
  );
}

function DialogueCourrier({
  patientId,
  courrier,
  destinataires,
  onClose,
}: {
  patientId: string;
  courrier: CourrierAvecDestinataire | null;
  destinataires: OptionDestinataire[];
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  const soumettre = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("patient_id", patientId);
    if (courrier) fd.set("id", courrier.id);
    setErreur(null);
    start(async () => {
      const res = await enregistrerCourrier(fd);
      if (!res.ok) {
        setErreur(res.error ?? "L'enregistrement a échoué.");
        return;
      }
      onClose();
    });
  };

  return (
    <Dialogue
      ouvert
      onFermer={onClose}
      titre={courrier ? "Modifier le courrier" : "Courrier de liaison"}
      description="Une page adressée à un professionnel nommé. Le courrier ne reprend rien d'un bilan : ce qu'il dit, c'est ce que vous écrivez."
    >
      <form onSubmit={soumettre} className="px-6 py-5 space-y-4">
        <div>
          <label htmlFor="recipient_contact_id" className="block text-sm text-slate-700 mb-1">
            Destinataire
          </label>
          <select
            id="recipient_contact_id"
            name="recipient_contact_id"
            required
            defaultValue={courrier?.recipient_contact_id ?? ""}
            className={CHAMP}
          >
            <option value="">Choisir un professionnel…</option>
            {(
              [
                ["dossier", "Entourage du dossier"],
                ["cabinet", "Autres contacts du cabinet"],
              ] as const
            ).map(([g, titre]) => {
              const liste = destinataires.filter((d) => d.groupe === g);
              if (liste.length === 0) return null;
              return (
                <optgroup key={g} label={titre}>
                  {liste.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nom}
                      {d.role ? ` — ${d.role}` : ""}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </div>

        <div>
          <label htmlFor="subject" className="block text-sm text-slate-700 mb-1">
            Objet
          </label>
          <input
            id="subject"
            name="subject"
            required
            defaultValue={courrier?.subject ?? ""}
            placeholder="Ex. Demande d'avis, Point de suivi"
            className={CHAMP}
          />
        </div>

        <div>
          <label htmlFor="body" className="block text-sm text-slate-700 mb-1">
            Courrier
          </label>
          <textarea
            id="body"
            name="body"
            rows={10}
            required
            defaultValue={courrier?.body ?? ""}
            aria-describedby="aide-courrier"
            className={CHAMP}
          />
          <p id="aide-courrier" className="text-xs text-slate-500 mt-1">
            Ce texte partira tel quel chez son destinataire. Écrivez ce qui lui
            est utile — une question, un élément à transmettre — et rien de plus.
          </p>
        </div>

        <div>
          <label htmlFor="internal_note" className="block text-sm text-slate-700 mb-1">
            Note interne (jamais imprimée)
          </label>
          <input
            id="internal_note"
            name="internal_note"
            defaultValue={courrier?.internal_note ?? ""}
            className={CHAMP}
          />
        </div>

        {erreur && (
          <p role="alert" className="text-sm text-red-700">
            {erreur}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600">
            Annuler
          </button>
          <button
            type="submit"
            disabled={pending}
            className="px-5 py-2 text-sm text-white bg-brand-600 hover:bg-brand-700 rounded-lg disabled:opacity-60"
          >
            {pending ? "Enregistrement…" : "Enregistrer le brouillon"}
          </button>
        </div>
      </form>
    </Dialogue>
  );
}
