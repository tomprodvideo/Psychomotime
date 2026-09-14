"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { MOIS, type ModePeriode } from "@/lib/compta/periode";
import { CHAMP_AUTO } from "@/components/Champ";

/**
 * Choix de la période.
 *
 * Le choix vit dans l'URL, pas dans un état React : la page est ainsi
 * partageable, rechargeable, et le bouton « précédent » du navigateur fait ce
 * qu'on attend de lui.
 */
export default function SelecteurPeriode({
  mode,
  annee,
  mois,
  du,
  au,
  anneesDisponibles,
}: {
  mode: ModePeriode;
  annee: number;
  mois: number;
  du?: string;
  au?: string;
  anneesDisponibles: number[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  function aller(modif: Record<string, string | null>) {
    const u = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(modif)) {
      if (v === null) u.delete(k);
      else u.set(k, v);
    }
    router.push(`/comptabilite?${u.toString()}`);
  }

  const onglet = (m: ModePeriode, libelle: string) => (
    <button
      key={m}
      type="button"
      onClick={() => aller({ mode: m })}
      aria-current={mode === m ? "true" : undefined}
      className={`px-3 py-1.5 text-sm rounded-lg transition ${
        mode === m
          ? "bg-brand-600 text-white shadow-sm"
          : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      {libelle}
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 bg-white rounded-xl border border-slate-100 p-1 shadow-sm">
        {onglet("mois", "Mois")}
        {onglet("annee", "Année")}
        {onglet("intervalle", "Période")}
        {onglet("tout", "Tout")}
      </div>

      {mode === "mois" && (
        <select
          aria-label="Mois"
          value={mois}
          onChange={(e) => aller({ mois: e.target.value })}
          className={CHAMP_AUTO}
        >
          {MOIS.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
      )}

      {(mode === "mois" || mode === "annee") && (
        <select
          aria-label="Année"
          value={annee}
          onChange={(e) => aller({ annee: e.target.value })}
          className={CHAMP_AUTO}
        >
          {anneesDisponibles.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      )}

      {mode === "intervalle" && (
        <div className="flex items-center gap-1.5">
          <label className="sr-only" htmlFor="periode-du">
            Date de début
          </label>
          <input
            id="periode-du"
            type="date"
            value={du ?? ""}
            onChange={(e) => aller({ du: e.target.value })}
            className={CHAMP_AUTO}
          />
          <span className="text-slate-500 text-sm">au</span>
          <label className="sr-only" htmlFor="periode-au">
            Date de fin
          </label>
          <input
            id="periode-au"
            type="date"
            value={au ?? ""}
            onChange={(e) => aller({ au: e.target.value })}
            className={CHAMP_AUTO}
          />
        </div>
      )}
    </div>
  );
}
