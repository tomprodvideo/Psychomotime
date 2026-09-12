"use client";

import { useState, useTransition } from "react";
import { Plus, Users, X } from "lucide-react";
import { frDate } from "@/lib/format";
import { endContactRole, linkContact } from "../actions";
import {
  contactName,
  LEGAL_BASIS_LABELS,
  ROLE_LABELS,
  type Contact,
  type PatientContactRole,
  type PatientContactWithContact,
} from "@/lib/dossier/types";

/**
 * Entourage du dossier : qui gravite autour du patient, et à quel titre.
 *
 * L'affichage sépare les rôles ACTIFS des rôles CLOS. Les seconds ne sont pas
 * du bruit : savoir à qui l'on a légitimement écrit l'an dernier fait partie de
 * la trace, et c'est exactement ce qu'un champ écrasé faisait disparaître.
 */
export default function EntourageSection({
  patientId,
  liens,
  contacts,
  canWrite,
}: {
  patientId: string;
  liens: PatientContactWithContact[];
  contacts: Contact[];
  canWrite: boolean;
}) {
  const [ouvert, setOuvert] = useState(false);

  const actifs = liens.filter((l) => !l.valid_to);
  const clos = liens.filter((l) => l.valid_to);

  // Regroupement par rôle, dans l'ordre d'importance pour le praticien.
  const ordre: PatientContactRole[] = [
    "responsable_legal", "destinataire", "payeur", "assure",
    "parent_sans_autorite", "proche", "adresseur", "professionnel",
    "etablissement", "autre",
  ];
  const groupes = ordre
    .map((role) => ({ role, liens: actifs.filter((l) => l.role === role) }))
    .filter((g) => g.liens.length > 0);

  return (
    <section
      aria-labelledby="titre-entourage"
      className="bg-white rounded-xl border border-slate-100 shadow-sm p-5"
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <h2 id="titre-entourage" className="font-semibold text-slate-800">
          Entourage et rôles
        </h2>
        {canWrite && (
          <button
            type="button"
            onClick={() => setOuvert(true)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50 px-3 py-1.5 rounded-lg"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Rattacher
          </button>
        )}
      </div>

      {actifs.length === 0 ? (
        <div className="flex items-start gap-3 py-4">
          <Users className="h-5 w-5 shrink-0 text-slate-300 mt-0.5" aria-hidden="true" />
          <p className="text-sm text-slate-500">
            Personne n&apos;est encore rattaché. Un même contact peut tenir
            plusieurs rôles — responsable légal, destinataire, payeur — et ces
            rôles sont indépendants les uns des autres.
          </p>
        </div>
      ) : (
        <div className="space-y-4 mt-3">
          {groupes.map((g) => (
            <div key={g.role}>
              <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-1.5">
                {ROLE_LABELS[g.role]}
              </h3>
              <ul className="space-y-2 list-none p-0 m-0">
                {g.liens.map((l) => (
                  <LigneLien
                    key={l.id}
                    lien={l}
                    patientId={patientId}
                    canWrite={canWrite}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {clos.length > 0 && (
        <details className="mt-4 pt-4 border-t border-slate-100">
          <summary className="text-sm text-slate-500 cursor-pointer hover:text-slate-700">
            {clos.length} rôle{clos.length > 1 ? "s" : ""} terminé
            {clos.length > 1 ? "s" : ""}
          </summary>
          <ul className="mt-3 space-y-2 list-none p-0">
            {clos.map((l) => (
              <li key={l.id} className="text-sm text-slate-500">
                <span className="font-medium">{contactName(l.contact)}</span> —{" "}
                {ROLE_LABELS[l.role]}, jusqu&apos;au {frDate(l.valid_to!)}
                {l.note && <span className="block text-xs">{l.note}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}

      {ouvert && (
        <DialogueRattachement
          patientId={patientId}
          contacts={contacts}
          onClose={() => setOuvert(false)}
        />
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ ligne */

function LigneLien({
  lien,
  patientId,
  canWrite,
}: {
  lien: PatientContactWithContact;
  patientId: string;
  canWrite: boolean;
}) {
  const [pending, start] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const c = lien.contact;

  const coordonnees = [c.phone, c.email].filter(Boolean).join(" · ");
  const adresse = [c.address_line1, [c.postal_code, c.city].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");

  const terminer = () => {
    if (
      !confirm(
        `Mettre fin au rôle « ${ROLE_LABELS[lien.role]} » de ${contactName(c)} ?\n\n` +
          "Le lien est conservé avec sa date de fin : la trace de qui a tenu ce rôle reste lisible.",
      )
    )
      return;
    const fd = new FormData();
    fd.set("link_id", lien.id);
    fd.set("patient_id", patientId);
    setErreur(null);
    start(async () => {
      const res = await endContactRole(fd);
      if (!res.ok) setErreur(res.error);
    });
  };

  return (
    <li className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
      <div className="min-w-0 text-sm">
        <p className="font-medium text-slate-800">
          {contactName(c)}
          {lien.is_primary && (
            <span className="ml-2 text-xs font-normal text-brand-700 bg-brand-50 rounded-full px-2 py-0.5">
              principal
            </span>
          )}
        </p>
        <p className="text-xs text-slate-500">
          {[
            lien.relationship,
            lien.legal_basis ? LEGAL_BASIS_LABELS[lien.legal_basis] : null,
            c.profession,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {coordonnees && <p className="text-xs text-slate-500">{coordonnees}</p>}
        {adresse && <p className="text-xs text-slate-500">{adresse}</p>}
        {lien.note && (
          <p className="text-xs text-slate-500 italic mt-1">{lien.note}</p>
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
          onClick={terminer}
          disabled={pending}
          aria-label={`Mettre fin au rôle de ${contactName(c)}`}
          className="shrink-0 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded p-1 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-rose-200"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </li>
  );
}

/* --------------------------------------------------------------- dialogue */

const CHAMP =
  "w-full rounded-lg border border-slate-500 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100 transition";

function DialogueRattachement({
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
  const [role, setRole] = useState<PatientContactRole>("responsable_legal");
  const [existant, setExistant] = useState("");
  const [kind, setKind] = useState<"personne" | "organisation">("personne");

  const soumettre = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setErreur(null);
    start(async () => {
      const res = await linkContact(fd);
      if (!res.ok) {
        setErreur(res.error);
        return;
      }
      onClose();
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="titre-rattachement"
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-slate-900/40 p-4 overflow-y-auto"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 id="titre-rattachement" className="font-semibold text-slate-800">
            Rattacher une personne ou une organisation
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="text-slate-500 hover:text-slate-600 rounded p-1"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={soumettre} className="px-6 py-5 space-y-4">
          <input type="hidden" name="patient_id" value={patientId} />

          <div>
            <label htmlFor="role" className="block text-sm text-slate-700 mb-1">
              Rôle
            </label>
            <select
              id="role"
              name="role"
              value={role}
              onChange={(e) => setRole(e.target.value as PatientContactRole)}
              className={CHAMP}
            >
              {(Object.keys(ROLE_LABELS) as PatientContactRole[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">
              Chaque rôle est indépendant. Une même personne peut être
              rattachée plusieurs fois, à des titres différents.
            </p>
          </div>

          {role === "responsable_legal" && (
            <div>
              <label
                htmlFor="legal_basis"
                className="block text-sm text-slate-700 mb-1"
              >
                À quel titre
              </label>
              <select id="legal_basis" name="legal_basis" className={CHAMP}>
                <option value="">Non précisé</option>
                {Object.entries(LEGAL_BASIS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">
                L&apos;autorité parentale sur un mineur et une mesure de
                protection d&apos;un majeur sont deux régimes différents.
              </p>
            </div>
          )}

          <div>
            <label htmlFor="contact_id" className="block text-sm text-slate-700 mb-1">
              Contact existant
            </label>
            <select
              id="contact_id"
              name="contact_id"
              value={existant}
              onChange={(e) => setExistant(e.target.value)}
              className={CHAMP}
            >
              <option value="">— Créer un nouveau contact —</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {contactName(c)}
                  {c.profession ? ` (${c.profession})` : ""}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">
              Réutiliser un contact évite d&apos;avoir deux adresses à tenir à
              jour — utile pour une fratrie suivie au même cabinet.
            </p>
          </div>

          {!existant && (
            <fieldset className="space-y-3 rounded-lg bg-slate-50 p-3">
              <legend className="text-sm font-medium text-slate-700 px-1">
                Nouveau contact
              </legend>

              <div className="flex gap-2">
                {(["personne", "organisation"] as const).map((k) => (
                  <label key={k} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="radio"
                      name="kind"
                      value={k}
                      checked={kind === k}
                      onChange={() => setKind(k)}
                    />
                    {k === "personne" ? "Personne" : "Organisation"}
                  </label>
                ))}
              </div>

              {kind === "personne" ? (
                <div className="grid grid-cols-2 gap-2">
                  <PetitChamp name="contact_first_name" label="Prénom" />
                  <PetitChamp name="contact_last_name" label="Nom" />
                  <PetitChamp name="profession" label="Profession" />
                  <PetitChamp name="rpps" label="RPPS" />
                </div>
              ) : (
                <PetitChamp name="organisation_name" label="Raison sociale" />
              )}

              <div className="grid grid-cols-2 gap-2">
                <PetitChamp name="contact_phone" label="Téléphone" type="tel" />
                <PetitChamp name="contact_email" label="E-mail" type="email" />
              </div>
              <PetitChamp name="contact_address_line1" label="Adresse" />
              <div className="grid grid-cols-2 gap-2">
                <PetitChamp name="contact_postal_code" label="Code postal" />
                <PetitChamp name="contact_city" label="Ville" />
              </div>
            </fieldset>
          )}

          <div className="grid grid-cols-2 gap-2">
            <PetitChamp
              name="relationship"
              label="Lien"
              placeholder="Mère, père, curatrice…"
            />
            <PetitChamp name="valid_from" label="Depuis le" type="date" />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="is_primary" />
            Contact principal pour ce rôle
          </label>

          <div>
            <label htmlFor="link_note" className="block text-sm text-slate-700 mb-1">
              Précision
            </label>
            <textarea id="link_note" name="link_note" rows={2} className={CHAMP} />
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
              {pending ? "Enregistrement…" : "Rattacher"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PetitChamp({
  name,
  label,
  type = "text",
  placeholder,
}: {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-xs text-slate-600 mb-1">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-500 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition"
      />
    </div>
  );
}
