"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Ban, PenLine, Trash2 } from "lucide-react";
import type { Attestation } from "@/lib/attestations/types";
import {
  annulerAttestation,
  emettreAttestation,
  supprimerBrouillonAttestation,
} from "../actions";

/**
 * Signer, annuler, supprimer.
 *
 * SIGNER EST PRÉSENTÉ COMME UN ACTE, parce que c'en est un : le nom et le
 * numéro professionnel du praticien partiront sur le document. La confirmation
 * n'est pas une politesse d'interface, c'est la dernière relecture.
 */
export default function ActionsAttestation({
  attestation,
  nbFaits,
  aujourdhui,
}: {
  attestation: Attestation;
  nbFaits: number;
  aujourdhui: string;
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<
    null | "signer" | "supprimer" | "annuler"
  >(null);
  const [dateEmission, setDateEmission] = useState(aujourdhui);
  const [motif, setMotif] = useState("");

  function agir(
    action: () => Promise<{ ok: boolean; error?: string }>,
    apres?: () => void,
  ) {
    setErreur(null);
    demarrer(async () => {
      const r = await action();
      if (!r.ok) {
        setErreur(r.error ?? "L'opération a échoué.");
        return;
      }
      setConfirmation(null);
      apres?.();
      router.refresh();
    });
  }

  const brouillon = attestation.status === "brouillon";

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {brouillon && (
          <>
            <button
              type="button"
              onClick={() => setConfirmation("supprimer")}
              disabled={enCours}
              className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-rose-700 border border-slate-200 px-3 py-2 rounded-lg disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Supprimer
            </button>
            <button
              type="button"
              onClick={() => setConfirmation("signer")}
              disabled={enCours || nbFaits === 0}
              title={
                nbFaits === 0
                  ? "Sans fait rattaché, l'attestation n'affirmerait rien de vérifiable."
                  : undefined
              }
              className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition shadow-sm disabled:opacity-40"
            >
              <PenLine className="h-4 w-4" aria-hidden="true" />
              Signer et numéroter
            </button>
          </>
        )}

        {attestation.status === "emis" && (
          <button
            type="button"
            onClick={() => setConfirmation("annuler")}
            disabled={enCours}
            className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-amber-700 border border-slate-200 px-3 py-2 rounded-lg disabled:opacity-50"
          >
            <Ban className="h-4 w-4" aria-hidden="true" />
            Annuler l&apos;attestation
          </button>
        )}
      </div>

      {confirmation === "signer" && (
        <Encadre titre="Signer cette attestation">
          <p className="text-sm text-slate-600">
            Elle recevra son numéro et sa date, et{" "}
            <strong>ne pourra plus être modifiée</strong>. Votre nom, votre titre
            et votre numéro professionnel y figureront. Une erreur constatée
            après coup s&apos;annule, avec un motif, et s&apos;atteste à nouveau.
          </p>
          <div className="flex items-end gap-2 mt-3">
            <div>
              <label
                htmlFor="issued_on"
                className="block text-xs font-medium text-slate-500 mb-1"
              >
                Date de signature
              </label>
              <input
                id="issued_on"
                type="date"
                value={dateEmission}
                onChange={(e) => setDateEmission(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
              />
            </div>
            <button
              type="button"
              disabled={enCours}
              onClick={() =>
                agir(() => {
                  const fd = new FormData();
                  fd.set("attestation_id", attestation.id);
                  fd.set("issued_on", dateEmission);
                  return emettreAttestation(fd);
                })
              }
              className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50"
            >
              {enCours ? "Signature…" : "Confirmer la signature"}
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
            Ce brouillon n&apos;a pas été signé : rien n&apos;en a été remis à
            personne.
          </p>
          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              disabled={enCours}
              onClick={() =>
                agir(
                  () => {
                    const fd = new FormData();
                    fd.set("attestation_id", attestation.id);
                    return supprimerBrouillonAttestation(fd);
                  },
                  () => router.push("/comptabilite/attestations"),
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

      {confirmation === "annuler" && (
        <Encadre titre="Annuler cette attestation">
          <p className="text-sm text-slate-600">
            Elle sera marquée annulée et <strong>restera consultable</strong> :
            son destinataire en détient peut-être une copie, et faire
            disparaître le document ferait disparaître la trace de ce qui a été
            affirmé.
          </p>
          <div className="mt-3">
            <label
              htmlFor="motif-annulation"
              className="block text-xs font-medium text-slate-500 mb-1"
            >
              Motif — il reste attaché à l&apos;attestation
            </label>
            <input
              id="motif-annulation"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="Erreur de période attestée"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
            />
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              disabled={enCours || motif.trim() === ""}
              onClick={() =>
                agir(() => {
                  const fd = new FormData();
                  fd.set("attestation_id", attestation.id);
                  fd.set("reason", motif);
                  return annulerAttestation(fd);
                })
              }
              className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-40"
            >
              {enCours ? "Annulation…" : "Confirmer l'annulation"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmation(null)}
              className="text-sm text-slate-500 px-3 py-2"
            >
              Revenir
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
