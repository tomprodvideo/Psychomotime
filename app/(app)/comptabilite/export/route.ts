import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getCurrentPractice } from "@/lib/dossier/practice";
import { listCharges, listDocuments } from "@/lib/compta/queries";
import { construireCsv, nomFichierCsv } from "@/lib/compta/csv";
import { resoudrePeriode } from "../periode";

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
  const maintenant = new Date();
  const periode = resoudrePeriode(
    {
      mode: url.searchParams.get("mode") ?? undefined,
      mois: url.searchParams.get("mois") ?? undefined,
      annee: url.searchParams.get("annee") ?? undefined,
      du: url.searchParams.get("du") ?? undefined,
      au: url.searchParams.get("au") ?? undefined,
    },
    maintenant,
  );

  const [pieces, charges] = await Promise.all([
    listDocuments(practice, { du: periode.du, au: periode.au }),
    listCharges(practice, { du: periode.du, au: periode.au }),
  ]);

  const csv = construireCsv({
    libellePeriode: periode.libelle,
    exporteLe: maintenant.toLocaleDateString("fr-FR"),
    pieces: pieces.items,
    totaux: pieces.totaux,
    charges,
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
