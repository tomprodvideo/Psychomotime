import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { getCurrentPractice } from "@/lib/dossier/practice";
import { listCharges, listRecurrences } from "@/lib/compta/queries";
import { resoudrePeriode } from "../periode";
import ChargesClient from "./ChargesClient";

export default async function ChargesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const practice = await getCurrentPractice();
  if (!practice) notFound();

  const aujourdhui = new Date();
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

      <ChargesClient
        charges={charges}
        recurrences={recurrences}
        modifiable={practice.canWrite}
        aujourdhui={aujourdhui.toISOString().slice(0, 10)}
      />
    </div>
  );
}
