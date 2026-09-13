"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Unlink } from "lucide-react";
import { centsToEuros, formatCents } from "@/lib/money";
import { frDate } from "@/lib/format";
import { METHOD_LABELS, type PaymentMethod } from "@/lib/compta/types";
import type { ReglementAffecte } from "@/lib/compta/queries";
import { enregistrerReglement, retirerAffectation } from "../actions";
import { CHAMP } from "@/components/Champ";
import { Bouton } from "@/components/Bouton";

/**
 * Les règlements imputés sur une pièce.
 *
 * UN RÈGLEMENT EXISTE PAR LUI-MÊME, puis s'impute. C'est ce qui permet un
 * paiement groupé, un règlement partiel, et de voir un trop-perçu pour ce
 * qu'il est : une part non affectée, et non un solde négatif inexpliqué.
 *
 * Retirer une imputation ne supprime pas le règlement : l'argent a été reçu, et
 * l'effacer pour corriger une affectation ferait disparaître une recette.
 */
export default function ReglementsSection({
  documentId,
  reglements,
  solde,
  modifiable,
  aujourdhui,
}: {
  documentId: string;
  reglements: ReglementAffecte[];
  solde: number;
  modifiable: boolean;
  aujourdhui: string;
}) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function soumettre(fd: FormData) {
    setErreur(null);
    setMessage(null);
    fd.set("document_id", documentId);
    demarrer(async () => {
      const r = await enregistrerReglement(fd);
      if (!r.ok) {
        setErreur(r.error ?? "L'enregistrement a échoué.");
        return;
      }
      setMessage(r.message ?? null);
      setOuvert(false);
      router.refresh();
    });
  }

  function retirer(allocationId: string) {
    setErreur(null);
    demarrer(async () => {
      const fd = new FormData();
      fd.set("allocation_id", allocationId);
      fd.set("document_id", documentId);
      const r = await retirerAffectation(fd);
      if (!r.ok) setErreur(r.error ?? "Le retrait a échoué.");
      else {
        setMessage(r.message ?? null);
        router.refresh();
      }
    });
  }

  return (
    <section
      aria-labelledby="titre-reglements"
      className="bg-white rounded-xl border border-slate-100 shadow-sm"
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <h2 id="titre-reglements" className="font-semibold text-slate-800">
          Règlements
        </h2>
        <span
          className={`text-sm font-medium ${
            solde > 0 ? "text-amber-600" : solde < 0 ? "text-rose-600" : "text-emerald-600"
          }`}
        >
          {solde > 0
            ? `Reste dû ${formatCents(solde)}`
            : solde < 0
              ? `Trop-perçu ${formatCents(-solde)}`
              : "Soldée"}
        </span>
      </div>

      {reglements.length === 0 ? (
        <p className="px-5 py-4 text-sm text-slate-500">
          Aucun règlement imputé sur cette pièce.
        </p>
      ) : (
        <ul className="list-none p-0 m-0 divide-y divide-slate-50">
          {reglements.map((r) => (
            <li
              key={r.allocation_id}
              className="flex items-center justify-between px-5 py-3 text-sm"
            >
              <span className="text-slate-700">
                {formatCents(r.amount_cents)}
                <span className="text-slate-500">
                  {" "}
                  · {METHOD_LABELS[r.method]} · {frDate(r.received_on)}
                  {r.reference && ` · ${r.reference}`}
                </span>
              </span>
              {modifiable && (
                <Bouton variante="libre"
                  type="button"
                  onClick={() => retirer(r.allocation_id)}
                  pending={enCours}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-rose-600"
                >
                  <Unlink className="h-3.5 w-3.5" aria-hidden="true" />
                  Retirer l&apos;imputation
                </Bouton>
              )}
            </li>
          ))}
        </ul>
      )}

      {modifiable && (
        <div className="px-5 py-4 border-t border-slate-100">
          {ouvert ? (
            <form action={soumettre} className="space-y-3">
              <div className="grid sm:grid-cols-4 gap-3">
                <div>
                  <label htmlFor="amount" className="block text-xs font-medium text-slate-500 mb-1">
                    Montant €
                  </label>
                  <input
                    id="amount"
                    name="amount"
                    required
                    inputMode="decimal"
                    defaultValue={
                      solde > 0
                        ? centsToEuros(solde).toFixed(2).replace(".", ",")
                        : ""
                    }
                    className={CHAMP}
                  />
                </div>
                <div>
                  <label htmlFor="received_on" className="block text-xs font-medium text-slate-500 mb-1">
                    Reçu le
                  </label>
                  <input
                    id="received_on"
                    name="received_on"
                    type="date"
                    defaultValue={aujourdhui}
                    className={CHAMP}
                  />
                </div>
                <div>
                  <label htmlFor="method" className="block text-xs font-medium text-slate-500 mb-1">
                    Moyen
                  </label>
                  <select id="method" name="method" className={CHAMP}>
                    {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map((m) => (
                      <option key={m} value={m}>
                        {METHOD_LABELS[m]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="reference" className="block text-xs font-medium text-slate-500 mb-1">
                    Référence
                  </label>
                  <input
                    id="reference"
                    name="reference"
                    className={CHAMP}
                    placeholder="N° de chèque…"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Bouton variante="libre"
                  type="submit"
                  pending={enCours}
                  className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
              pendingLabel="Enregistrement…"
            >
                  Enregistrer le règlement
                </Bouton>
                <button
                  type="button"
                  onClick={() => setOuvert(false)}
                  className="text-sm text-slate-500"
                >
                  Annuler
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setOuvert(true)}
              className="inline-flex items-center gap-2 text-sm font-medium text-brand-700 hover:text-brand-800"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Enregistrer un règlement
            </button>
          )}
        </div>
      )}

      {message && (
        <p role="status" className="px-5 pb-4 text-sm text-emerald-700">
          {message}
        </p>
      )}
      {erreur && (
        <p role="alert" className="px-5 pb-4 text-sm text-rose-700">
          {erreur}
        </p>
      )}
    </section>
  );
}

