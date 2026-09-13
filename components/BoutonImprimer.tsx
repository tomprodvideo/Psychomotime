"use client";

import { Printer } from "lucide-react";
import { Bouton } from "@/components/Bouton";

/**
 * LE bouton d'impression.
 *
 * Il en existait TROIS : `BoutonImprimer` (« Imprimer »), `PrintButton`
 * (« Imprimer / Enregistrer en PDF », sans `type`, icône non masquée aux
 * lecteurs d'écran) et un troisième en ligne dans les actions du bilan. Et
 * l'attestation importait celui de la facture à travers
 * `../../../[id]/document/`, d'une fonctionnalité à l'autre.
 *
 * Le libellé retenu dit ce que le bouton permet réellement : il n'existe pas
 * d'export PDF côté serveur, l'impression du navigateur EST l'export
 * (`DEC-008`). Le dire évite de chercher un bouton « PDF » qui n'existe pas.
 */
export function BoutonImprimer() {
  return (
    <Bouton variante="principal" onClick={() => window.print()}>
      <Printer className="h-4 w-4" aria-hidden="true" />
      Imprimer / Enregistrer en PDF
    </Bouton>
  );
}
