"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { formatCents, centsToEuros } from "@/lib/money";
import { frDate } from "@/lib/format";
import {
  PRICING_LABELS,
  type BillingLine,
  type CatalogItem,
  type ServicePricing,
} from "@/lib/compta/types";
import type { SeanceFacturable } from "@/lib/compta/queries";
import { enregistrerLigne, supprimerLigne } from "../actions";

/**
 * Les lignes d'un brouillon.
 *
 * DEUX PROTECTIONS TENUES ICI, et la base les tient aussi.
 *
 * 1. **Le montant n'est jamais posté.** Il est recalculé côté serveur à partir
 *    du prix, du mode de tarification et de la quantité. Ce que l'écran affiche
 *    est un aperçu, pas une valeur d'autorité.
 *
 * 2. **Une séance déjà facturée n'est pas reproposée.** La liste ci-dessous ne
 *    contient que des rendez-vous honorés, facturables, et rattachés à aucune
 *    ligne. Facturer deux fois la même séance est le défaut le plus coûteux de
 *    ce domaine, et il ne peut pas reposer sur la mémoire.
 */
export default function LignesEditeur({
  documentId,
  lignes,
  catalogue,
  seances,
  modifiable,
}: {
  documentId: string;
  lignes: BillingLine[];
  catalogue: CatalogItem[];
  seances: SeanceFacturable[];
  modifiable: boolean;
}) {
  const [ouvert, setOuvert] = useState(false);
  const total = lignes.reduce((s, l) => s + l.amount_cents, 0);

  return (
    <div>
      {lignes.length === 0 ? (
        <p className="text-sm text-slate-500 px-5 py-4">
          Aucune ligne. Une pièce sans ligne ne peut pas être émise.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Lignes de la pièce</caption>
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                <th scope="col" className="px-5 py-2 font-medium">Prestation</th>
                <th scope="col" className="px-3 py-2 font-medium text-right">P.U.</th>
                <th scope="col" className="px-3 py-2 font-medium text-right">Qté</th>
                <th scope="col" className="px-3 py-2 font-medium text-right">Montant</th>
                {modifiable && <th scope="col" className="px-3 py-2 w-10" />}
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => (
                <Ligne
                  key={l.id}
                  ligne={l}
                  documentId={documentId}
                  modifiable={modifiable}
                />
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-100">
                <td colSpan={3} className="px-5 py-3 text-right font-medium text-slate-600">
                  Total
                </td>
                <td className="px-3 py-3 text-right font-semibold text-slate-800 tabular-nums">
                  {formatCents(total)}
                </td>
                {modifiable && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {modifiable && (
        <div className="px-5 py-4 border-t border-slate-100">
          {ouvert ? (
            <FormulaireLigne
              documentId={documentId}
              catalogue={catalogue}
              seances={seances}
              onFerme={() => setOuvert(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setOuvert(true)}
              className="inline-flex items-center gap-2 text-sm font-medium text-brand-700 hover:text-brand-800"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Ajouter une prestation
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Ligne({
  ligne,
  documentId,
  modifiable,
}: {
  ligne: BillingLine;
  documentId: string;
  modifiable: boolean;
}) {
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  function supprimer() {
    const fd = new FormData();
    fd.set("line_id", ligne.id);
    fd.set("document_id", documentId);
    setErreur(null);
    demarrer(async () => {
      const r = await supprimerLigne(fd);
      if (!r.ok) setErreur(r.error ?? "La suppression a échoué.");
    });
  }

  return (
    <tr className="border-b border-slate-50 last:border-0 align-top">
      <td className="px-5 py-3">
        <span className="text-slate-700">{ligne.label}</span>
        {ligne.intro && (
          <span className="block text-xs text-slate-500 mt-0.5">{ligne.intro}</span>
        )}
        {ligne.service_dates.length > 0 && (
          <span className="block text-xs text-slate-500 mt-0.5">
            {ligne.service_dates.map((d) => frDate(d)).join(" · ")}
          </span>
        )}
        {erreur && (
          <span role="alert" className="block text-xs text-rose-600 mt-1">
            {erreur}
          </span>
        )}
      </td>
      <td className="px-3 py-3 text-right text-slate-600 tabular-nums">
        {formatCents(ligne.unit_price_cents)}
      </td>
      <td className="px-3 py-3 text-right text-slate-600 tabular-nums">
        {ligne.pricing === "forfait" ? "forfait" : ligne.quantity}
      </td>
      <td className="px-3 py-3 text-right font-medium text-slate-700 tabular-nums">
        {formatCents(ligne.amount_cents)}
      </td>
      {modifiable && (
        <td className="px-3 py-3">
          <button
            type="button"
            onClick={supprimer}
            disabled={enCours}
            aria-label={`Supprimer la ligne ${ligne.label}`}
            /* 16 × 16 px sans rembourrage : la cible était à la limite de ce
               qu'un trackpad atteint, pour une action destructive. Le
               rembourrage la porte à 32 px sans changer la mise en page. */
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:text-rose-700 hover:bg-rose-50 disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </td>
      )}
    </tr>
  );
}

function FormulaireLigne({
  documentId,
  catalogue,
  seances,
  onFerme,
}: {
  documentId: string;
  catalogue: CatalogItem[];
  seances: SeanceFacturable[];
  onFerme: () => void;
}) {
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  const [catalogId, setCatalogId] = useState("");
  const [libelle, setLibelle] = useState("");
  const [prix, setPrix] = useState("");
  const [pricing, setPricing] = useState<ServicePricing>("unitaire");
  const [quantite, setQuantite] = useState(1);
  const [intro, setIntro] = useState("");
  const [choisies, setChoisies] = useState<string[]>([]);

  const apercu = useMemo(() => {
    const valeur = Number(prix.replace(",", "."));
    if (!Number.isFinite(valeur)) return null;
    const centimes = Math.round(valeur * 100);
    return pricing === "forfait" ? centimes : centimes * quantite;
  }, [prix, pricing, quantite]);

  /** Choisir une entrée du catalogue RECOPIE ses valeurs. Elle ne les relie pas. */
  function choisirCatalogue(id: string) {
    setCatalogId(id);
    const item = catalogue.find((c) => c.id === id);
    if (!item) return;
    setLibelle(item.label);
    setPrix(centsToEuros(item.unit_price_cents).toFixed(2).replace(".", ","));
    setPricing(item.pricing);
    // La phrase d'introduction et le style d'impression étaient saisis dans le
    // catalogue, enregistrés en base… et jamais repris ici. Champs morts.
    setIntro(item.default_intro ?? "");
  }

  function basculerSeance(id: string, date: string) {
    setChoisies((avant) => {
      const apres = avant.includes(id)
        ? avant.filter((x) => x !== id)
        : [...avant, id];
      // La quantité suit les séances cochées : c'est le sens même du choix.
      if (pricing === "unitaire") setQuantite(Math.max(1, apres.length));
      return apres;
    });
    void date;
  }

  function soumettre(fd: FormData) {
    setErreur(null);
    fd.set("document_id", documentId);
    const dates = seances
      .filter((s) => choisies.includes(s.id))
      .map((s) => s.starts_at.slice(0, 10))
      .sort();
    fd.set("service_dates", dates.join(" "));
    if (dates.length > 0) fd.set("date_render", "par_date");
    for (const id of choisies) fd.append("appointment_id", id);

    demarrer(async () => {
      const r = await enregistrerLigne(fd);
      if (r.ok) onFerme();
      else setErreur(r.error ?? "L'ajout a échoué.");
    });
  }

  return (
    <form action={soumettre} className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-700">Nouvelle prestation</h3>
        <button
          type="button"
          onClick={onFerme}
          aria-label="Fermer"
          className="text-slate-500 hover:text-slate-600"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {catalogue.length > 0 && (
        <div>
          <label htmlFor="catalogue" className="block text-xs font-medium text-slate-500 mb-1">
            Depuis le catalogue
          </label>
          <select
            id="catalogue"
            value={catalogId}
            onChange={(e) => choisirCatalogue(e.target.value)}
            className={styleChamp}
          >
            <option value="">Saisie libre</option>
            {catalogue.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label} — {formatCents(c.unit_price_cents)}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500 mt-1">
            Le tarif est recopié maintenant. Le modifier plus tard dans le
            catalogue ne changera aucune pièce déjà établie.
          </p>
        </div>
      )}
      <input type="hidden" name="catalog_item_id" value={catalogId} />

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="label" className="block text-xs font-medium text-slate-500 mb-1">
            Libellé imprimé
          </label>
          <input
            id="label"
            name="label"
            required
            value={libelle}
            onChange={(e) => setLibelle(e.target.value)}
            className={styleChamp}
            placeholder="Séance de psychomotricité"
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label htmlFor="unit_price" className="block text-xs font-medium text-slate-500 mb-1">
              Tarif €
            </label>
            <input
              id="unit_price"
              name="unit_price"
              required
              inputMode="decimal"
              value={prix}
              onChange={(e) => setPrix(e.target.value)}
              className={styleChamp}
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
              value={pricing}
              onChange={(e) => setPricing(e.target.value as ServicePricing)}
              className={styleChamp}
            >
              {(Object.keys(PRICING_LABELS) as ServicePricing[]).map((p) => (
                <option key={p} value={p}>
                  {p === "unitaire" ? "Unitaire" : "Forfait"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="quantity" className="block text-xs font-medium text-slate-500 mb-1">
              Quantité
            </label>
            <input
              id="quantity"
              name="quantity"
              type="number"
              min={1}
              value={pricing === "forfait" ? 1 : quantite}
              disabled={pricing === "forfait"}
              onChange={(e) => setQuantite(Math.max(1, Number(e.target.value)))}
              className={`${styleChamp} disabled:bg-slate-50 disabled:text-slate-500`}
            />
          </div>
        </div>
      </div>

      {seances.length > 0 && (
        <fieldset className="rounded-lg border border-slate-100 p-3">
          <legend className="text-xs font-medium text-slate-600 px-1">
            Séances à facturer
          </legend>
          <p className="text-xs text-slate-500 mb-2">
            Seules apparaissent les séances honorées, marquées facturables, et
            pas encore portées sur une facture en vigueur.{" "}
            <strong className="font-medium text-slate-500">
              La quantité suit les séances que vous cochez.
            </strong>
          </p>
          <ul className="grid sm:grid-cols-3 gap-1.5 list-none p-0 m-0 max-h-40 overflow-y-auto">
            {seances.map((s) => (
              <li key={s.id}>
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={choisies.includes(s.id)}
                    onChange={() => basculerSeance(s.id, s.starts_at)}
                    className="rounded border-slate-300"
                  />
                  {frDate(s.starts_at.slice(0, 10))}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      <div>
        <label htmlFor="intro" className="block text-xs font-medium text-slate-500 mb-1">
          Phrase d&apos;introduction (facultative)
        </label>
        <input
          id="intro"
          name="intro"
          value={intro}
          onChange={(e) => setIntro(e.target.value)}
          className={styleChamp}
          placeholder="Séances réalisées aux dates suivantes :"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={enCours}
          className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {enCours ? "Ajout…" : "Ajouter"}
        </button>
        {apercu !== null && (
          <span className="text-sm text-slate-500">
            Montant de la ligne : <strong>{formatCents(apercu)}</strong>
            <span className="text-xs text-slate-500">
              {" "}
              — recalculé à l&apos;enregistrement
            </span>
          </span>
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
  "w-full rounded-lg border border-slate-500 px-3 py-2 text-sm bg-white focus:border-brand-400 focus:ring-2 focus:ring-brand-100";
