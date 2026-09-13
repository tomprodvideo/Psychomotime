"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Ban, PenLine, Trash2 } from "lucide-react";
import type { Attestation } from "@/lib/attestations/types";
import { CHAMP, CHAMP_AUTO } from "@/components/Champ";
import { Bouton } from "@/components/Bouton";
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
            <Bouton pending={enCours} onClick={() => setConfirmation("supprimer")}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Supprimer
            </Bouton>
            {/* MÊME DÉFAUT QUE SUR LA PIÈCE COMPTABLE, avec un message qui pèse
                plus lourd : il dit que le document n'AFFIRMERAIT RIEN. Il
                vivait dans un `title`, sur un bouton `disabled`. */}
            <Bouton
              variante="principal"
              pending={enCours}
              empeche={
                nbFaits === 0
                  ? "Cochez au moins une séance ou un règlement : sans cela, l'attestation n'affirme rien."
                  : null
              }
              onClick={() => setConfirmation("signer")}
            >
              <PenLine className="h-4 w-4" aria-hidden="true" />
              Signer et numéroter
            </Bouton>
          </>
        )}

        {attestation.status === "emis" && (
          <Bouton pending={enCours} onClick={() => setConfirmation("annuler")}>
            <Ban className="h-4 w-4" aria-hidden="true" />
            Annuler l&apos;attestation
          </Bouton>
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
                className={CHAMP_AUTO}
              />
            </div>
            <Bouton
              variante="principal"
              pending={enCours}
              pendingLabel="Signature en cours…"
              onClick={() =>
                agir(() => {
                  const fd = new FormData();
                  fd.set("attestation_id", attestation.id);
                  fd.set("issued_on", dateEmission);
                  return emettreAttestation(fd);
                })
              }
            >
              Confirmer la signature
            </Bouton>
            <Bouton
              variante="texte"
              onClick={() => setConfirmation(null)}
            >
              Annuler
            </Bouton>
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
            <Bouton
              variante="destructif"
              pending={enCours}
              pendingLabel="Suppression en cours…"
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
            >
              Supprimer
            </Bouton>
            <Bouton
              variante="texte"
              onClick={() => setConfirmation(null)}
            >
              Annuler
            </Bouton>
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
              className={CHAMP}
            />
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Bouton
              variante="principal"
              pending={enCours}
              pendingLabel="Annulation en cours…"
              empeche={
                motif.trim() === ""
                  ? "Écrivez d'abord pourquoi cette attestation est annulée."
                  : null
              }
              onClick={() =>
                agir(() => {
                  const fd = new FormData();
                  fd.set("attestation_id", attestation.id);
                  fd.set("reason", motif);
                  return annulerAttestation(fd);
                })
              }
            >
              Confirmer l&apos;annulation
            </Bouton>
            <Bouton
              variante="texte"
              onClick={() => setConfirmation(null)}
            >
              Revenir
            </Bouton>
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
