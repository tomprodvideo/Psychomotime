"use client";

import { useState, useTransition } from "react";
import { AlertTriangle } from "lucide-react";
import { deleteAccount } from "./actions";

/**
 * Suppression de son propre compte.
 *
 * CE QUI EST DIT ICI DOIT ÊTRE CE QUI SE PASSE. La version précédente
 * promettait que « toutes vos données seront supprimées » alors que l'appel
 * échouait silencieusement pour toute praticienne seule : elle était
 * déconnectée en croyant son compte supprimé, et il ne l'était pas.
 *
 * Une promesse d'effacement non tenue est pire qu'un effacement impossible :
 * la personne croit l'avoir obtenu et ne le redemande jamais.
 */
export default function DeleteAccountCard() {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [pending, start] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [motDePasse, setMotDePasse] = useState("");

  return (
    <div className="bg-white rounded-xl border border-rose-200 shadow-sm p-5">
      <h2 className="font-semibold text-rose-700 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" />
        Supprimer mon compte
      </h2>
      <p className="text-sm text-slate-500 mt-1">
        Cette action est <strong>définitive</strong>. Votre cabinet et tout ce
        qu&apos;il contient seront supprimés : dossiers patients, entourage,
        rendez-vous, bilans, factures, devis, avoirs, règlements, charges et
        documents. Rien ne pourra être récupéré.
      </p>
      <p className="text-sm text-slate-500 mt-2">
        Vos pièces comptables partent avec le reste.{" "}
        <strong>Exportez-les avant si vous en avez besoin</strong> — depuis
        Comptabilité, bouton « Exporter ».
      </p>
      <p className="text-xs text-slate-500 mt-2">
        Si d&apos;autres praticiens partagent votre cabinet, il n&apos;est pas
        supprimé : seule votre appartenance est retirée, et leurs données
        restent les leurs.
      </p>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 text-sm font-medium text-rose-600 hover:bg-rose-50 border border-rose-200 px-4 py-2 rounded-lg"
        >
          Supprimer mon compte
        </button>
      ) : (
        <div className="mt-4 bg-rose-50 border border-rose-200 rounded-lg p-4">
          <p className="text-sm text-slate-700 mb-2">
            Pour confirmer, tapez <strong>SUPPRIMER</strong> ci-dessous :
          </p>
          <label className="sr-only" htmlFor="confirmation-suppression">
            Tapez SUPPRIMER pour confirmer
          </label>
          <input
            id="confirmation-suppression"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="SUPPRIMER"
            className="w-full max-w-xs rounded-lg border border-slate-300 py-2 px-3 text-sm outline-none focus:border-rose-400 mb-3"
          />

          {/* Le mot recopié est un garde-fou d'attention, pas une preuve
              d'identité : une session laissée ouverte suffirait. Le mot de
              passe est redemandé, comme pour le changer. */}
          <label
            htmlFor="mot-de-passe-suppression"
            className="block text-sm text-slate-700 mb-1"
          >
            Puis votre mot de passe :
          </label>
          <input
            id="mot-de-passe-suppression"
            type="password"
            autoComplete="current-password"
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            className="w-full max-w-xs rounded-lg border border-slate-300 py-2 px-3 text-sm outline-none focus:border-rose-400 mb-3"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={
                confirmText.trim() !== "SUPPRIMER" ||
                motDePasse === "" ||
                pending
              }
              onClick={() => {
                setErreur(null);
                start(async () => {
                  // En cas de succès, l'action redirige et ne rend jamais la
                  // main. Ce qui revient ici est donc toujours un échec.
                  const fd = new FormData();
                  fd.set("mot_de_passe", motDePasse);
                  const r = await deleteAccount(fd);
                  setMotDePasse("");
                  setErreur(r.error);
                });
              }}
              className="text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 px-4 py-2 rounded-lg disabled:opacity-50"
            >
              {pending ? "Suppression…" : "Confirmer la suppression définitive"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setConfirmText("");
              }}
              className="text-sm text-slate-600 hover:bg-slate-100 px-4 py-2 rounded-lg"
            >
              Annuler
            </button>
          </div>
          {erreur && (
            <p
              role="alert"
              className="mt-3 rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm text-rose-800"
            >
              {erreur}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
