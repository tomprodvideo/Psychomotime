"use client";

import { useState, useTransition } from "react";
import { Building2 } from "lucide-react";
import { createPractice } from "./actions";
import { CHAMP_AUTO } from "@/components/Champ";
import { Bouton } from "@/components/Bouton";

/**
 * Création du cabinet, pour un compte qui n'en a pas encore.
 *
 * Le cabinet est le locataire du système : patients, bilans et factures lui
 * appartiennent, pas au compte. C'est ce qui permettra un jour d'accueillir un
 * remplaçant ou un collaborateur sans réécrire chaque table.
 */
export default function CreatePracticeCard() {
  const [nom, setNom] = useState("");
  const [pending, start] = useTransition();

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center">
          <Building2 className="h-5 w-5" aria-hidden="true" />
        </div>
        <h2 className="font-semibold text-slate-800">Nommez votre cabinet</h2>
      </div>

      <p className="text-sm text-slate-500 mt-3">
        Vos dossiers, vos bilans et votre comptabilité appartiendront à ce
        cabinet. Vous en serez le propriétaire, et vous pourrez le renommer à
        tout moment dans les paramètres.
      </p>

      <form
        className="mt-5 flex flex-col sm:flex-row gap-2"
        action={(fd) => start(() => createPractice(fd))}
      >
        <label htmlFor="nom-cabinet" className="sr-only">
          Nom du cabinet
        </label>
        <input
          id="nom-cabinet"
          name="name"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          required
          maxLength={200}
          placeholder="Cabinet de psychomotricité"
          className={`${CHAMP_AUTO} flex-1`}
        />
        <Bouton
          variante="libre"
          type="submit"
          pending={pending}
          pendingLabel="Création…"
          /* Masqué : le champ vide est juste à gauche. Un motif affiché
             accueillerait la personne comme une erreur avant la première
             frappe. */
          motifMasque
          empeche={!nom.trim() ? "Donnez d'abord un nom au cabinet." : null}
          className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-5 py-2 rounded-lg"
        >
          Créer le cabinet
        </Bouton>
      </form>
    </div>
  );
}
