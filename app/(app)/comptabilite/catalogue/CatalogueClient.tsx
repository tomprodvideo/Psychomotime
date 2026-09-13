"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { centsToEuros, formatCents } from "@/lib/money";
import {
  NATURE_LABELS,
  type CatalogItem,
  type ServiceNature,
} from "@/lib/compta/types";
import { enregistrerPrestation, supprimerPrestation } from "../actions";
import { CHAMP } from "@/components/Champ";
import { Bouton } from "@/components/Bouton";

/**
 * Le catalogue de prestations.
 *
 * C'EST UN RÉFÉRENTIEL, PAS UNE SOURCE DE VÉRITÉ. Une ligne de facture recopie
 * ses valeurs au moment où elle est créée et ne les relit plus jamais :
 * modifier un tarif ici ne change aucune pièce déjà établie. C'est ce que
 * l'écran dit, parce que l'inverse — un historique qui bougerait avec les
 * tarifs — serait la plus grave des erreurs possibles à cet endroit.
 */
export default function CatalogueClient({
  items,
  modifiable,
}: {
  items: CatalogItem[];
  modifiable: boolean;
}) {
  const [edite, setEdite] = useState<string | null>(null);
  const [nouveau, setNouveau] = useState(false);

  return (
    <div className="space-y-4">
      {items.length === 0 && !nouveau && (
        <p className="text-sm text-slate-500">
          Aucune prestation. Le catalogue évite de retaper un libellé et un tarif
          à chaque facture ; il n&apos;est pas obligatoire.
        </p>
      )}

      <ul className="list-none p-0 m-0 space-y-2">
        {items.map((item) =>
          edite === item.id ? (
            <li key={item.id}>
              <Formulaire
                item={item}
                onFerme={() => setEdite(null)}
              />
            </li>
          ) : (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">
                  {item.label}
                  {!item.active && (
                    <span className="ml-2 text-xs font-normal text-slate-500">
                      inactive
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-500">
                  {formatCents(item.unit_price_cents)}
                  {item.pricing === "forfait" ? " au forfait" : " par unité"}
                  {" · "}
                  {NATURE_LABELS[item.nature] ?? item.nature}
                </p>
              </div>
              {modifiable && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setEdite(item.id)}
                    aria-label={`Modifier ${item.label}`}
                    className="p-2 text-slate-500 hover:text-slate-700"
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <BoutonSupprimer item={item} />
                </div>
              )}
            </li>
          ),
        )}
      </ul>

      {modifiable &&
        (nouveau ? (
          <Formulaire onFerme={() => setNouveau(false)} />
        ) : (
          <button
            type="button"
            onClick={() => setNouveau(true)}
            className="inline-flex items-center gap-2 text-sm font-medium text-brand-700 hover:text-brand-800"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Ajouter une prestation
          </button>
        ))}
    </div>
  );
}

function BoutonSupprimer({ item }: { item: CatalogItem }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [confirme, setConfirme] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  if (!confirme) {
    return (
      <button
        type="button"
        onClick={() => setConfirme(true)}
        aria-label={`Supprimer ${item.label}`}
        className="p-2 text-slate-500 hover:text-rose-600"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      {erreur ? (
        <span role="alert" className="text-rose-600">
          {erreur}
        </span>
      ) : (
        <span className="text-slate-500">Supprimer ?</span>
      )}
      <Bouton variante="libre"
        type="button"
        pending={enCours}
        onClick={() =>
          demarrer(async () => {
            const fd = new FormData();
            fd.set("item_id", item.id);
            const r = await supprimerPrestation(fd);
            if (!r.ok) setErreur(r.error ?? "Échec.");
            else router.refresh();
          })
        }
        className="text-rose-600 font-medium"
      >
        Oui
      </Bouton>
      <button
        type="button"
        onClick={() => {
          setConfirme(false);
          setErreur(null);
        }}
        className="text-slate-500"
      >
        Non
      </button>
    </div>
  );
}

function Formulaire({
  item,
  onFerme,
}: {
  item?: CatalogItem;
  onFerme: () => void;
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  function soumettre(fd: FormData) {
    setErreur(null);
    demarrer(async () => {
      const r = await enregistrerPrestation(fd);
      if (!r.ok) {
        setErreur(r.error ?? "L'enregistrement a échoué.");
        return;
      }
      onFerme();
      router.refresh();
    });
  }

  return (
    <form
      action={soumettre}
      className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"
    >
      {item && <input type="hidden" name="item_id" value={item.id} />}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-700">
          {item ? "Modifier la prestation" : "Nouvelle prestation"}
        </h3>
        <button
          type="button"
          onClick={onFerme}
          aria-label="Fermer"
          className="text-slate-500 hover:text-slate-600"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="grid sm:grid-cols-4 gap-3">
        <div className="sm:col-span-2">
          <label htmlFor="label" className="block text-xs font-medium text-slate-500 mb-1">
            Libellé
          </label>
          <input
            id="label"
            name="label"
            required
            defaultValue={item?.label ?? ""}
            className={CHAMP}
            placeholder="Séance de psychomotricité"
          />
        </div>
        <div>
          <label htmlFor="unit_price" className="block text-xs font-medium text-slate-500 mb-1">
            Tarif €
          </label>
          <input
            id="unit_price"
            name="unit_price"
            required
            inputMode="decimal"
            defaultValue={
              item ? centsToEuros(item.unit_price_cents).toFixed(2).replace(".", ",") : ""
            }
            className={CHAMP}
            placeholder="45,00"
          />
        </div>
        <div>
          <label htmlFor="pricing" className="block text-xs font-medium text-slate-500 mb-1">
            Mode
          </label>
          <select
            id="pricing"
            name="pricing"
            defaultValue={item?.pricing ?? "unitaire"}
            className={CHAMP}
          >
            <option value="unitaire">Unitaire</option>
            <option value="forfait">Forfait</option>
          </select>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="nature" className="block text-xs font-medium text-slate-500 mb-1">
            Nature de l&apos;acte
          </label>
          <select
            id="nature"
            name="nature"
            defaultValue={item?.nature ?? "seance"}
            className={CHAMP}
          >
            {(Object.keys(NATURE_LABELS) as ServiceNature[]).map((n) => (
              <option key={n} value={n}>
                {NATURE_LABELS[n]}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500 mt-1">
            Sert à distinguer ce qui peut nourrir une attestation de présence.
          </p>
        </div>
        <div>
          <label htmlFor="default_intro" className="block text-xs font-medium text-slate-500 mb-1">
            Phrase d&apos;introduction proposée
          </label>
          <input
            id="default_intro"
            name="default_intro"
            defaultValue={item?.default_intro ?? ""}
            className={CHAMP}
            placeholder="Séances réalisées aux dates suivantes :"
          />
        </div>
      </div>

      {/* La valeur « false » est postée en premier ; la case, quand elle est
          cochée, poste « true » par-dessus. Sans ce champ caché, décocher
          n'envoyait RIEN et la prestation restait proposée. */}
      <input type="hidden" name="active" value="false" />
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="active"
          value="true"
          defaultChecked={item?.active ?? true}
          className="rounded border-slate-300"
        />
        Proposée à la saisie
      </label>

      <div className="flex items-center gap-3">
        <Bouton variante="libre"
          type="submit"
          pending={enCours}
          className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
              pendingLabel="Enregistrement…"
            >
          Enregistrer
        </Bouton>
        {erreur && (
          <p role="alert" className="text-sm text-rose-700">
            {erreur}
          </p>
        )}
      </div>
    </form>
  );
}

