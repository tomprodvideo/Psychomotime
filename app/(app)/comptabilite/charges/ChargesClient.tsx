"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { formatCents } from "@/lib/money";
import { frDate } from "@/lib/format";
import {
  CATEGORIE_LABELS,
  type CategorieCharge,
  type Charge,
  type Recurrence,
} from "@/lib/compta/types";
import {
  enregistrerCharge,
  enregistrerRecurrence,
  supprimerCharge,
  supprimerRecurrence,
} from "../actions";

/**
 * Charges constatées et charges récurrentes.
 *
 * ELLES NE SONT PAS DE MÊME NATURE, et l'écran ne les mélange jamais : une
 * charge est un décaissement qui a eu lieu, une récurrence est un modèle qui
 * dit ce qui est dû. Les additionner dans un même total ferait passer une
 * prévision pour une dépense.
 */
export default function ChargesClient({
  charges,
  recurrences,
  modifiable,
  aujourdhui,
}: {
  charges: Charge[];
  recurrences: Recurrence[];
  modifiable: boolean;
  aujourdhui: string;
}) {
  const [ongletRecurrence, setOngletRecurrence] = useState(false);

  return (
    <div className="space-y-8">
      <section aria-labelledby="titre-constatees">
        <div className="flex items-center justify-between mb-3">
          <h2 id="titre-constatees" className="font-semibold text-slate-800">
            Charges de la période
          </h2>
          <span className="text-sm text-slate-500 tabular-nums">
            {formatCents(charges.reduce((s, c) => s + c.amount_cents, 0))}
          </span>
        </div>

        {charges.length === 0 ? (
          <p className="text-sm text-slate-500">
            Aucune charge saisie sur cette période.
          </p>
        ) : (
          <ul className="list-none p-0 m-0 space-y-2">
            {charges.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm text-slate-800 truncate">
                    {c.label ?? CATEGORIE_LABELS[c.category]}
                  </p>
                  <p className="text-xs text-slate-500">
                    {CATEGORIE_LABELS[c.category]} · {frDate(c.spent_on)}
                  </p>
                  {c.note && (
                    <p className="text-xs text-slate-400 mt-0.5">{c.note}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm text-slate-700 tabular-nums">
                    {formatCents(c.amount_cents)}
                  </span>
                  {modifiable && (
                    <Supprimer
                      libelle={c.label ?? "cette charge"}
                      action={() => {
                        const fd = new FormData();
                        fd.set("charge_id", c.id);
                        return supprimerCharge(fd);
                      }}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {modifiable && (
          <div className="mt-3">
            <FormulaireCharge aujourdhui={aujourdhui} />
          </div>
        )}
      </section>

      <section aria-labelledby="titre-recurrentes">
        <h2 id="titre-recurrentes" className="font-semibold text-slate-800 mb-1">
          Charges récurrentes
        </h2>
        <p className="text-sm text-slate-500 mb-3">
          Ce sont des <strong>modèles</strong> : ils disent ce qui est dû, à
          partir de quand. Ils n&apos;entrent pas dans le total ci-dessus, qui ne
          compte que des décaissements constatés.
        </p>

        {recurrences.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune charge récurrente.</p>
        ) : (
          <ul className="list-none p-0 m-0 space-y-2">
            {recurrences.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm text-slate-800 truncate">
                    {r.label}
                    {!r.active && (
                      <span className="ml-2 text-xs text-slate-400">
                        suspendue
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">
                    {r.period === "mensuel" ? "chaque mois" : "chaque année"} ·
                    depuis le {frDate(r.starts_on)}
                    {r.ends_on && ` · jusqu'au ${frDate(r.ends_on)}`}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm text-slate-700 tabular-nums">
                    {formatCents(r.amount_cents)}
                  </span>
                  {modifiable && (
                    <Supprimer
                      libelle={r.label}
                      action={() => {
                        const fd = new FormData();
                        fd.set("recurrence_id", r.id);
                        return supprimerRecurrence(fd);
                      }}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {modifiable && (
          <div className="mt-3">
            {ongletRecurrence ? (
              <FormulaireRecurrence
                aujourdhui={aujourdhui}
                onFerme={() => setOngletRecurrence(false)}
              />
            ) : (
              <button
                type="button"
                onClick={() => setOngletRecurrence(true)}
                className="inline-flex items-center gap-2 text-sm font-medium text-brand-700 hover:text-brand-800"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Ajouter une charge récurrente
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function Supprimer({
  libelle,
  action,
}: {
  libelle: string;
  action: () => Promise<{ ok: boolean; error?: string }>;
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [confirme, setConfirme] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  if (!confirme) {
    return (
      <button
        type="button"
        onClick={() => setConfirme(true)}
        aria-label={`Supprimer ${libelle}`}
        className="text-slate-400 hover:text-rose-600"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2 text-xs">
      {erreur ? (
        <span role="alert" className="text-rose-600">{erreur}</span>
      ) : (
        <span className="text-slate-500">Supprimer ?</span>
      )}
      <button
        type="button"
        disabled={enCours}
        onClick={() =>
          demarrer(async () => {
            const r = await action();
            if (!r.ok) setErreur(r.error ?? "Échec.");
            else router.refresh();
          })
        }
        className="text-rose-600 font-medium disabled:opacity-50"
      >
        Oui
      </button>
      <button
        type="button"
        onClick={() => setConfirme(false)}
        className="text-slate-500"
      >
        Non
      </button>
    </span>
  );
}

function FormulaireCharge({ aujourdhui }: { aujourdhui: string }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="inline-flex items-center gap-2 text-sm font-medium text-brand-700 hover:text-brand-800"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Ajouter une charge
      </button>
    );
  }

  return (
    <form
      action={(fd) => {
        setErreur(null);
        demarrer(async () => {
          const r = await enregistrerCharge(fd);
          if (!r.ok) setErreur(r.error ?? "Échec.");
          else {
            setOuvert(false);
            router.refresh();
          }
        });
      }}
      className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-700">Nouvelle charge</h3>
        <button
          type="button"
          onClick={() => setOuvert(false)}
          aria-label="Fermer"
          className="text-slate-400 hover:text-slate-600"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="grid sm:grid-cols-4 gap-3">
        <div>
          <label htmlFor="category" className="block text-xs font-medium text-slate-500 mb-1">
            Catégorie
          </label>
          <select id="category" name="category" className={styleChamp}>
            {(Object.keys(CATEGORIE_LABELS) as CategorieCharge[]).map((c) => (
              <option key={c} value={c}>
                {CATEGORIE_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="label" className="block text-xs font-medium text-slate-500 mb-1">
            Libellé
          </label>
          <input id="label" name="label" className={styleChamp} />
        </div>
        <div>
          <label htmlFor="amount" className="block text-xs font-medium text-slate-500 mb-1">
            Montant €
          </label>
          <input
            id="amount"
            name="amount"
            required
            inputMode="decimal"
            className={styleChamp}
            placeholder="383,33"
          />
        </div>
        <div>
          <label htmlFor="spent_on" className="block text-xs font-medium text-slate-500 mb-1">
            Payée le
          </label>
          <input
            id="spent_on"
            name="spent_on"
            type="date"
            required
            defaultValue={aujourdhui}
            className={styleChamp}
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={enCours}
          className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50"
        >
          {enCours ? "Enregistrement…" : "Enregistrer"}
        </button>
        {erreur && (
          <p role="alert" className="text-sm text-rose-700">{erreur}</p>
        )}
      </div>
    </form>
  );
}

function FormulaireRecurrence({
  aujourdhui,
  onFerme,
}: {
  aujourdhui: string;
  onFerme: () => void;
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  return (
    <form
      action={(fd) => {
        setErreur(null);
        demarrer(async () => {
          const r = await enregistrerRecurrence(fd);
          if (!r.ok) setErreur(r.error ?? "Échec.");
          else {
            onFerme();
            router.refresh();
          }
        });
      }}
      className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-700">
          Nouvelle charge récurrente
        </h3>
        <button
          type="button"
          onClick={onFerme}
          aria-label="Fermer"
          className="text-slate-400 hover:text-slate-600"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="grid sm:grid-cols-5 gap-3">
        <div>
          <label htmlFor="r_category" className="block text-xs font-medium text-slate-500 mb-1">
            Catégorie
          </label>
          <select id="r_category" name="category" className={styleChamp}>
            {(Object.keys(CATEGORIE_LABELS) as CategorieCharge[]).map((c) => (
              <option key={c} value={c}>
                {CATEGORIE_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="r_label" className="block text-xs font-medium text-slate-500 mb-1">
            Libellé
          </label>
          <input id="r_label" name="label" required className={styleChamp} />
        </div>
        <div>
          <label htmlFor="r_amount" className="block text-xs font-medium text-slate-500 mb-1">
            Montant €
          </label>
          <input
            id="r_amount"
            name="amount"
            required
            inputMode="decimal"
            className={styleChamp}
          />
        </div>
        <div>
          <label htmlFor="r_period" className="block text-xs font-medium text-slate-500 mb-1">
            Rythme
          </label>
          <select id="r_period" name="period" className={styleChamp}>
            <option value="mensuel">Mensuel</option>
            <option value="annuel">Annuel</option>
          </select>
        </div>
        <div>
          <label htmlFor="r_starts" className="block text-xs font-medium text-slate-500 mb-1">
            À partir du
          </label>
          <input
            id="r_starts"
            name="starts_on"
            type="date"
            required
            defaultValue={aujourdhui}
            className={styleChamp}
          />
        </div>
      </div>
      <p className="text-xs text-slate-400">
        La date de début est obligatoire : sans elle, modifier ce montant
        changerait rétroactivement les années déjà closes.
      </p>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={enCours}
          className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50"
        >
          {enCours ? "Enregistrement…" : "Enregistrer"}
        </button>
        {erreur && (
          <p role="alert" className="text-sm text-rose-700">{erreur}</p>
        )}
      </div>
    </form>
  );
}

const styleChamp =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-200";
