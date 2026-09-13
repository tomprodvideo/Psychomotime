"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, FileMinus, FileSignature, Send, Trash2 } from "lucide-react";
import type { BillingDocument } from "@/lib/compta/types";
import { CHAMP, CHAMP_AUTO } from "@/components/Champ";
import {
  changerEtatDevis,
  creerRectification,
  emettrePiece,
  supprimerBrouillon,
} from "../actions";

/**
 * Les actions d'une pièce.
 *
 * L'ÉMISSION EST PRÉSENTÉE COMME UN POINT DE NON-RETOUR, parce qu'elle en est
 * un : après elle, plus rien ne se modifie. La confirmation n'est pas une
 * politesse d'interface — c'est la dernière occasion de relire.
 */
export default function BarreActions({
  document,
  nbLignes,
  aujourdhui,
}: {
  document: BillingDocument;
  nbLignes: number;
  aujourdhui: string;
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<null | "emettre" | "supprimer" | "avoir" | "remplacement">(null);
  const [dateEmission, setDateEmission] = useState(aujourdhui);
  const [motif, setMotif] = useState("");

  function agir(action: () => Promise<{ ok: boolean; error?: string; id?: string }>, apres?: (id?: string) => void) {
    setErreur(null);
    demarrer(async () => {
      const r = await action();
      if (!r.ok) {
        setErreur(r.error ?? "L'opération a échoué.");
        return;
      }
      setConfirmation(null);
      apres?.(r.id);
      router.refresh();
    });
  }

  const brouillon = document.status === "brouillon";
  const estDevis = document.kind === "devis";
  const rectifiable =
    !brouillon &&
    !estDevis &&
    document.status !== "annule_par_avoir" &&
    document.status !== "remplace";

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {brouillon && (
          <>
            <button
              type="button"
              onClick={() => setConfirmation("supprimer")}
              disabled={enCours}
              className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-rose-700 border border-slate-500 px-3 py-2 rounded-lg disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Supprimer
            </button>
            <button
              type="button"
              onClick={() => setConfirmation("emettre")}
              disabled={enCours || nbLignes === 0}
              title={nbLignes === 0 ? "Une pièce sans ligne ne peut pas être émise." : undefined}
              className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition shadow-sm disabled:opacity-40"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              Émettre
            </button>
          </>
        )}

        {estDevis && document.status === "emis" && (
          <>
            <button
              type="button"
              onClick={() =>
                agir(() => {
                  const fd = new FormData();
                  fd.set("document_id", document.id);
                  fd.set("status", "refuse");
                  return changerEtatDevis(fd);
                })
              }
              disabled={enCours}
              className="inline-flex items-center gap-1.5 text-sm text-slate-600 border border-slate-500 px-3 py-2 rounded-lg disabled:opacity-50"
            >
              Marquer refusé
            </button>
            <button
              type="button"
              onClick={() =>
                agir(() => {
                  const fd = new FormData();
                  fd.set("document_id", document.id);
                  fd.set("status", "accepte");
                  return changerEtatDevis(fd);
                })
              }
              disabled={enCours}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Marquer accepté
            </button>
          </>
        )}

        {rectifiable && (
          <>
            <button
              type="button"
              onClick={() => setConfirmation("remplacement")}
              disabled={enCours}
              className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-800 border border-slate-500 px-3 py-2 rounded-lg disabled:opacity-50"
            >
              <FileSignature className="h-4 w-4" aria-hidden="true" />
              Facture de remplacement
            </button>
            <button
              type="button"
              onClick={() => setConfirmation("avoir")}
              disabled={enCours}
              className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-800 border border-slate-500 px-3 py-2 rounded-lg disabled:opacity-50"
            >
              <FileMinus className="h-4 w-4" aria-hidden="true" />
              Créer un avoir
            </button>
          </>
        )}
      </div>

      {confirmation === "emettre" && (
        <Encadre titre="Émettre cette pièce">
          <p className="text-sm text-slate-600">
            Elle recevra son numéro et sa date, et{" "}
            <strong>ne pourra plus être modifiée ni supprimée</strong>. Une
            correction passera par un avoir ou une facture de remplacement.
          </p>
          <div className="flex items-end gap-2 mt-3">
            <div>
              <label
                htmlFor="issued_on"
                className="block text-xs font-medium text-slate-500 mb-1"
              >
                Date d&apos;émission
              </label>
              <input
                id="issued_on"
                type="date"
                value={dateEmission}
                onChange={(e) => setDateEmission(e.target.value)}
                className={CHAMP_AUTO}
              />
            </div>
            <button
              type="button"
              disabled={enCours}
              onClick={() =>
                agir(() => {
                  const fd = new FormData();
                  fd.set("document_id", document.id);
                  fd.set("issued_on", dateEmission);
                  return emettrePiece(fd);
                })
              }
              className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50"
            >
              {enCours ? "Émission…" : "Confirmer l'émission"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmation(null)}
              className="text-sm text-slate-500 px-3 py-2"
            >
              Annuler
            </button>
          </div>
        </Encadre>
      )}

      {confirmation === "supprimer" && (
        <Encadre titre="Supprimer ce brouillon">
          <p className="text-sm text-slate-600">
            Un brouillon n&apos;a consommé aucun numéro : le supprimer ne laisse
            aucun trou dans la série.
          </p>
          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              disabled={enCours}
              onClick={() =>
                agir(
                  () => {
                    const fd = new FormData();
                    fd.set("document_id", document.id);
                    return supprimerBrouillon(fd);
                  },
                  () => router.push("/comptabilite"),
                )
              }
              className="bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50"
            >
              Supprimer
            </button>
            <button
              type="button"
              onClick={() => setConfirmation(null)}
              className="text-sm text-slate-500 px-3 py-2"
            >
              Annuler
            </button>
          </div>
        </Encadre>
      )}

      {(confirmation === "avoir" || confirmation === "remplacement") && (
        <Encadre
          titre={
            confirmation === "avoir"
              ? "Créer un avoir"
              : "Créer une facture de remplacement"
          }
        >
          <p className="text-sm text-slate-600">
            {confirmation === "avoir"
              ? "L'avoir annule tout ou partie de cette facture. La facture initiale est conservée : c'est l'avoir qui la corrige."
              : "La facture de remplacement se substitue à celle-ci, qui est conservée et marquée remplacée."}{" "}
            Les lignes sont recopiées pour vous éviter de les ressaisir ; vous
            pourrez les ajuster tant que la pièce reste au brouillon.
          </p>
          <div className="mt-3">
            <label
              htmlFor="motif"
              className="block text-xs font-medium text-slate-500 mb-1"
            >
              Motif de la rectification — il figurera sur la pièce
            </label>
            <input
              id="motif"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="Erreur de tarif sur la séance du 12 mars"
              className={CHAMP}
            />
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              disabled={enCours || motif.trim() === ""}
              onClick={() =>
                agir(
                  () => {
                    const fd = new FormData();
                    fd.set("document_id", document.id);
                    fd.set(
                      "kind",
                      confirmation === "avoir" ? "avoir" : "facture_de_remplacement",
                    );
                    fd.set("rectification_reason", motif);
                    return creerRectification(fd);
                  },
                  (id) => id && router.push(`/comptabilite/${id}`),
                )
              }
              className="bg-slate-700 hover:bg-slate-800 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-40"
            >
              {enCours ? "Création…" : "Créer le brouillon"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmation(null)}
              className="text-sm text-slate-500 px-3 py-2"
            >
              Annuler
            </button>
          </div>
        </Encadre>
      )}

      {erreur && (
        <p role="alert" className="text-sm text-rose-700 max-w-md text-right">
          {erreur}
        </p>
      )}
    </div>
  );
}

function Encadre({
  titre,
  children,
}: {
  titre: string;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full sm:w-[30rem] rounded-xl border border-slate-200 bg-white shadow-sm p-4 text-left">
      <h3 className="font-medium text-slate-800 mb-1">{titre}</h3>
      {children}
    </div>
  );
}
