import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/guard";
import { getCurrentPractice } from "@/lib/dossier/practice";
import { listCharges, listDocuments } from "@/lib/compta/queries";
import { construireCsv, nomFichierCsv } from "@/lib/compta/csv";
import { resoudrePeriode } from "@/lib/compta/periode";
import { dateCivile } from "@/lib/dateCivile";
import { frDate } from "@/lib/format";

/**
 * Export comptable de la période.
 *
 * POURQUOI UNE ROUTE ET NON UN BOUTON CLIENT. Construire le fichier dans le
 * navigateur obligerait à lui transmettre l'intégralité des pièces, y compris
 * ce que l'export ne contient pas. Le fichier est donc assemblé côté serveur,
 * à partir des mêmes lectures que l'écran.
 *
 * LA GARDE EST ICI, PAS AILLEURS. Une route est un point d'entrée HTTP public :
 * elle refait ses propres contrôles, sans supposer qu'un écran a été traversé.
 * La RLS, elle, refuse de toute façon les pièces d'un autre cabinet.
 *
 * L'export est autorisé sans abonnement actif : ce sont les données du cabinet,
 * et lui couper l'accès à sa propre comptabilité serait disproportionné.
 */
export async function GET(requete: Request) {
  const session = await requireUser();
  if (!session.ok) {
    return NextResponse.json({ error: session.error }, { status: 401 });
  }

  const practice = await getCurrentPractice();
  if (!practice) {
    return NextResponse.json(
      { error: "Aucun cabinet n'est rattaché à votre compte." },
      { status: 403 },
    );
  }

  const url = new URL(requete.url);
  // Le jour du cabinet : il choisit l'année par défaut, et il date le fichier.
  const aujourdhui = dateCivile(new Date(), practice.timezone);
  const periode = resoudrePeriode(
    {
      mode: url.searchParams.get("mode") ?? undefined,
      mois: url.searchParams.get("mois") ?? undefined,
      annee: url.searchParams.get("annee") ?? undefined,
      du: url.searchParams.get("du") ?? undefined,
      au: url.searchParams.get("au") ?? undefined,
    },
    aujourdhui,
  );

  const [pieces, charges] = await Promise.all([
    listDocuments(practice, { du: periode.du, au: periode.au }),
    listCharges(practice, { du: periode.du, au: periode.au }),
  ]);

  // UN EXPORT FAUX EST PIRE QU'UN EXPORT ABSENT. S'il manque une lecture, on ne
  // produit AUCUN fichier : ce fichier part chez un tiers, et rien ne dirait à
  // celui qui l'ouvre que ses montants sont incomplets.
  const echec = pieces.erreur ?? charges.erreur;
  if (echec) {
    return NextResponse.json({ error: echec }, { status: 503 });
  }

  /* UN EXPORT SE JOURNALISE. C'est une sortie de données personnelles hors du
   * logiciel : ce qui a été extrait, quand, et par qui doit rester constatable.
   * La trace ne porte AUCUN nom — période et nombre de pièces, rien d'autre.
   *
   * Elle est posée AVANT l'envoi : un échec de journalisation ne doit pas
   * empêcher le cabinet d'accéder à sa comptabilité, mais un fichier parti
   * sans trace ne doit pas être le cas ordinaire. */
  const supabase = await createClient();
  const { error: erreurTrace } = await supabase.rpc("log_audit_event", {
    p_practice_id: practice.practiceId,
    p_action: "billing.export",
    p_subject_type: "periode",
    p_subject_id: null,
    p_metadata: {
      periode: periode.libelle,
      du: periode.du ?? null,
      au: periode.au ?? null,
      pieces: pieces.items.length,
      charges: charges.items.length,
    },
  });
  if (erreurTrace) {
    console.error("[compta] journalisation de l'export refusée :", erreurTrace);
  }

  const csv = construireCsv({
    libellePeriode: periode.libelle,
    cabinet: practice.practiceName,
    exporteLe: frDate(aujourdhui),
    pieces: pieces.items,
    totaux: pieces.totaux,
    charges: charges.items,
    tronque: pieces.tronque,
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomFichierCsv(periode.libelle)}"`,
      // Une comptabilité ne se met pas en cache dans un intermédiaire.
      "Cache-Control": "no-store, private",
    },
  });
}
