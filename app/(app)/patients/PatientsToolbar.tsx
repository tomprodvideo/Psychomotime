"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Search } from "lucide-react";

/**
 * Recherche et filtre de la liste des dossiers.
 *
 * La recherche passe par l'URL, et non par un état local : un résultat est
 * alors partageable, revenir en arrière fonctionne, et la pagination reste
 * cohérente avec le filtre. Le filtrage lui-même se fait côté serveur — la page
 * ne charge jamais tous les dossiers pour en cacher une partie.
 */
export default function PatientsToolbar({
  search,
  statut,
}: {
  search: string;
  statut: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [terme, setTerme] = useState(search);
  const [dernierSearch, setDernierSearch] = useState(search);
  const champId = useId();
  const premierRendu = useRef(true);

  // Synchronise si l'URL change ailleurs — retour arrière, lien partagé. On
  // ajuste PENDANT le rendu plutôt que dans un effet : c'est le motif que React
  // recommande pour dériver un état d'une propriété, et il évite le rendu en
  // cascade qu'un effet provoquerait.
  if (search !== dernierSearch) {
    setDernierSearch(search);
    setTerme(search);
  }

  // Débounce : on ne relance pas une requête à chaque frappe.
  useEffect(() => {
    if (premierRendu.current) {
      premierRendu.current = false;
      return;
    }
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (terme.trim()) next.set("q", terme.trim());
      else next.delete("q");
      next.delete("page"); // un nouveau filtre repart de la première page
      router.replace(`/patients?${next.toString()}`);
    }, 300);
    return () => clearTimeout(t);
  }, [terme, params, router]);

  const changerStatut = (valeur: string) => {
    const next = new URLSearchParams(params.toString());
    if (valeur === "actif") next.delete("statut");
    else next.set("statut", valeur);
    next.delete("page");
    router.replace(`/patients?${next.toString()}`);
  };

  const onglets = [
    { id: "actif", label: "Actifs" },
    { id: "archive", label: "Archivés" },
    { id: "tous", label: "Tous" },
  ];

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
      <div className="relative flex-1">
        <label htmlFor={champId} className="sr-only">
          Rechercher un dossier par nom ou prénom
        </label>
        <span
          aria-hidden="true"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
        >
          <Search className="h-4 w-4" />
        </span>
        <input
          id={champId}
          type="search"
          value={terme}
          onChange={(e) => setTerme(e.target.value)}
          placeholder="Rechercher un nom ou un prénom"
          className="w-full rounded-lg border border-slate-500 bg-white py-2 pl-10 pr-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition"
        />
      </div>

      <div
        role="group"
        aria-label="Filtrer par statut de dossier"
        className="flex gap-1 p-1 bg-slate-100 rounded-lg"
      >
        {onglets.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={statut === o.id}
            onClick={() => changerStatut(o.id)}
            className={`text-sm font-medium px-3 py-1.5 rounded-md transition ${
              statut === o.id
                ? "bg-white shadow-sm text-brand-700"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
