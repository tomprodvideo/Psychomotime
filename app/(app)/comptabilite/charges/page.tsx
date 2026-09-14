import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { getCurrentPractice } from "@/lib/dossier/practice";
import { listCharges, listRecurrences } from "@/lib/compta/queries";
import { resoudrePeriode } from "@/lib/compta/periode";
import ChargesClient from "./ChargesClient";

import type { Metadata } from "next";
import { dateCivile } from "@/lib/dateCivile";
/* LE TITRE EST STATIQUE, ET C'EST DÉLIBÉRÉ. Un titre qui porterait le nom du
   patient le ferait entrer dans l'historique du navigateur, parfois synchronisé
   entre appareils, parfois affiché devant quelqu'un d'autre. C'est le même
   raisonnement que celui de la page de consultation publique, et il vaut
   autant ici. Distinguer les pages entre elles suffit. */
export const metadata: Metadata = { title: "Charges · Psychomotime" };


export default async function ChargesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const practice = await getCurrentPractice();
  if (!practice) notFound();

  const aujourdhui = dateCivile(new Date(), practice.timezone);
  const periode = resoudrePeriode(params, aujourdhui);

  const [charges, recurrences] = await Promise.all([
    listCharges(practice, { du: periode.du, au: periode.au }),
    listRecurrences(practice),
  ]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
      <Link
        href="/comptabilite"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Comptabilité
      </Link>

      <PageHeader title="Charges du cabinet" subtitle={periode.libelle} />

      {charges.erreur && (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 mb-5">
          {charges.erreur}
        </p>
      )}

      <ChargesClient
        charges={charges.items}
        recurrences={recurrences}
        modifiable={practice.canWrite}
        aujourdhui={aujourdhui}
      />
    </div>
  );
}
