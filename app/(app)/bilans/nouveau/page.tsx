import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data";
import type { Patient } from "@/lib/types";
import { Card } from "@/components/ui";
import NouveauBilanForm from "./NouveauBilanForm";
import { getCurrentPractice } from "@/lib/dossier/practice";
import { dateCivile } from "@/lib/dateCivile";

import type { Metadata } from "next";
/* LE TITRE EST STATIQUE, ET C'EST DÉLIBÉRÉ. Un titre qui porterait le nom du
   patient le ferait entrer dans l'historique du navigateur, parfois synchronisé
   entre appareils, parfois affiché devant quelqu'un d'autre. C'est le même
   raisonnement que celui de la page de consultation publique, et il vaut
   autant ici. Distinguer les pages entre elles suffit. */
export const metadata: Metadata = { title: "Nouveau bilan · Psychomotime" };


export default async function NouveauBilanPage({
  searchParams,
}: {
  searchParams: Promise<{ patient?: string }>;
}) {
  const { patient } = await searchParams;
  const supabase = await createClient();
  const settings = await getSettings();

  const { data } = await supabase
    .from("patients")
    .select("id, first_name, last_name, birth_date")
    .order("last_name");

  const patients = (data ?? []) as Pick<
    Patient,
    "id" | "first_name" | "last_name" | "birth_date"
  >[];

  /* LE JOUR CIVIL DU CABINET. En UTC, entre minuit et une heure du matin
     l'hiver — deux heures l'été —, le formulaire proposait la date de la VEILLE,
     et affichait l'âge de ce jour-là. Aucune garde en base ne compare la date
     d'un bilan à `current_date` : la corriger ne peut rien faire refuser. */
  const practice = await getCurrentPractice();
  const today = dateCivile(new Date(), practice?.timezone);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
      <Link
        href="/bilans"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-700 mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux bilans
      </Link>
      <h1 className="text-2xl font-semibold text-slate-800 mb-1">
        Nouveau bilan
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        Renseignez les informations de base, puis remplissez le modèle structuré.
      </p>
      <Card className="p-6">
        <NouveauBilanForm
          patients={patients}
          defaultAuthor={settings.display_name ?? ""}
          defaultPatientId={patient}
          today={today}
        />
      </Card>
    </div>
  );
}
