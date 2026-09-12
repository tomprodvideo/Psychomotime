"use client";

import { useState, useTransition } from "react";
import { Dialogue } from "@/components/Dialogue";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { savePatient } from "./actions";
import type { Patient } from "@/lib/dossier/types";

/**
 * Création et modification d'un dossier.
 *
 * CE QUI A CHANGÉ. Le formulaire ne contient plus le responsable légal ni le
 * dossier de suivi : ce sont des objets à part entière, qui vivent sur la fiche.
 * Un responsable légal n'est pas un champ du patient — c'est une personne, qui
 * peut suivre une fratrie et tenir plusieurs rôles.
 *
 * Ce qui reste ici est ce qui décrit LA PERSONNE et rien d'autre.
 */
export default function PatientFormDialog({
  patient,
  label,
}: {
  patient?: Patient;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setErreur(null);
    start(async () => {
      const res = await savePatient(fd);
      // On ne referme QUE si l'enregistrement a abouti : refermer sur un échec
      // ferait disparaître la saisie sans rien dire.
      if (res.error || !res.id) {
        setErreur(res.error ?? "Le dossier n'a pas pu être enregistré.");
        return;
      }
      setOpen(false);
      if (!patient) router.push(`/patients/${res.id}`);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          patient
            ? "text-sm font-medium text-brand-700 hover:bg-brand-50 px-3 py-1.5 rounded-lg"
            : "inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition shadow-sm"
        }
      >
        {!patient && <Plus className="h-4 w-4" aria-hidden="true" />}
        {label ?? (patient ? "Modifier" : "Nouveau dossier")}
      </button>

      <Dialogue
        ouvert={open}
        onFermer={() => setOpen(false)}
        titre={patient ? "Modifier le dossier" : "Nouveau dossier"}
      >
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {patient && <input type="hidden" name="id" value={patient.id} />}

          <fieldset className="space-y-4">
            <legend className="text-sm font-medium text-slate-700">Identité</legend>
            <div className="grid sm:grid-cols-2 gap-3">
              <Champ
                name="first_name"
                label="Prénom"
                defaultValue={patient?.first_name}
                autoComplete="off"
              />
              <Champ
                name="last_name"
                label="Nom"
                defaultValue={patient?.last_name}
                autoComplete="off"
              />
              <Champ
                name="preferred_name"
                label="Prénom d'usage"
                defaultValue={patient?.preferred_name ?? ""}
                aide="S'il diffère du prénom d'état civil."
              />
              <Champ
                name="birth_name"
                label="Nom de naissance"
                defaultValue={patient?.birth_name ?? ""}
                aide="À ne renseigner que s'il diffère et qu'il sert."
              />
              <Champ
                name="birth_date"
                label="Date de naissance"
                type="date"
                defaultValue={patient?.birth_date ?? ""}
              />
              <div>
                <label
                  htmlFor="norm_reference_sex"
                  className="block text-sm text-slate-700 mb-1"
                >
                  Sexe de référence
                </label>
                <select
                  id="norm_reference_sex"
                  name="norm_reference_sex"
                  defaultValue={patient?.norm_reference_sex ?? ""}
                  aria-describedby="aide-sexe"
                  className={CHAMP}
                >
                  <option value="">Non renseigné</option>
                  <option value="f">Féminin</option>
                  <option value="m">Masculin</option>
                  <option value="autre">Autre</option>
                </select>
                <p id="aide-sexe" className="text-xs text-slate-500 mt-1">
                  Sert uniquement à lire l&apos;étalonnage d&apos;un
                  instrument qui distingue les normes. Facultatif : un bilan
                  sans score n&apos;en a aucun besoin.
                </p>
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-sm font-medium text-slate-700">
              Coordonnées du patient
            </legend>
            <p className="text-xs text-slate-500">
              Pour un enfant, laissez ces champs vides : les coordonnées des
              parents se saisissent dans l&apos;entourage, sur la fiche. Les
              recopier ici était le défaut de la version précédente.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <Champ
                name="email"
                label="Adresse e-mail"
                type="email"
                defaultValue={patient?.email ?? ""}
              />
              <Champ
                name="phone"
                label="Téléphone"
                type="tel"
                defaultValue={patient?.phone ?? ""}
              />
              <Champ
                name="address_line1"
                label="Adresse"
                defaultValue={patient?.address_line1 ?? ""}
                className="sm:col-span-2"
              />
              <Champ
                name="postal_code"
                label="Code postal"
                defaultValue={patient?.postal_code ?? ""}
              />
              <Champ
                name="city"
                label="Ville"
                defaultValue={patient?.city ?? ""}
              />
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-slate-700 mb-1">
              Notes d&apos;organisation
            </legend>
            <label htmlFor="administrative_notes" className="sr-only">
              Notes d&apos;organisation
            </label>
            <textarea
              id="administrative_notes"
              name="administrative_notes"
              rows={3}
              defaultValue={patient?.administrative_notes ?? ""}
              aria-describedby="aide-notes"
              placeholder="Accès au cabinet, contrainte d'horaire, langue…"
              className={CHAMP}
            />
            <p id="aide-notes" className="text-xs text-slate-500 mt-1">
              Informations pratiques. Les observations cliniques se
              saisissent dans les notes de la fiche, qui portent leur date et
              leur auteur.
            </p>
          </fieldset>

          {erreur && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200"
            >
              {erreur}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setOpen(false)}
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
    </>
  );
}

const CHAMP =
  "w-full rounded-lg border border-slate-500 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100 transition";

function Champ({
  name,
  label,
  type = "text",
  defaultValue,
  aide,
  autoComplete,
  className = "",
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string;
  aide?: string;
  autoComplete?: string;
  className?: string;
}) {
  const aideId = aide ? `${name}-aide` : undefined;
  return (
    <div className={className}>
      <label htmlFor={name} className="block text-sm text-slate-700 mb-1">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        autoComplete={autoComplete}
        aria-describedby={aideId}
        className={CHAMP}
      />
      {aide && (
        <p id={aideId} className="text-xs text-slate-500 mt-1">
          {aide}
        </p>
      )}
    </div>
  );
}
