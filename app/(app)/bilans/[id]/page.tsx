import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data";
import { resolveBilanSections } from "@/lib/constants";
import type { Bilan } from "@/lib/types";
import BilanEditor from "./BilanEditor";
import { getCurrentPractice } from "@/lib/dossier/practice";
import { dateCivile } from "@/lib/dateCivile";

import type { Metadata } from "next";
/* LE TITRE EST STATIQUE, ET C'EST DÉLIBÉRÉ. Un titre qui porterait le nom du
   patient le ferait entrer dans l'historique du navigateur, parfois synchronisé
   entre appareils, parfois affiché devant quelqu'un d'autre. C'est le même
   raisonnement que celui de la page de consultation publique, et il vaut
   autant ici. Distinguer les pages entre elles suffit. */
export const metadata: Metadata = { title: "Rédaction d'un bilan · Psychomotime" };


export default async function BilanEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("bilans")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();
  const bilan = data as Bilan;

  const bilanType =
    bilan.content?.__type__ === "sensoriel" ? "sensoriel" : "psychomoteur";

  const settings = await getSettings();
  const templates =
    (bilanType === "sensoriel"
      ? settings.profile?.adaptation_templates_sensoriel
      : settings.profile?.adaptation_templates) ?? [];
  const folders =
    (bilanType === "sensoriel"
      ? settings.profile?.adaptation_folders_sensoriel
      : settings.profile?.adaptation_folders) ?? [];
  const sections = resolveBilanSections(settings.profile, bilanType);

  /* Le moteur de bilans relève encore du modèle v1, clé sur le compte : il ne
     lisait pas le cabinet. Sans cabinet rattaché, `dateCivile` retombe sur le
     fuseau par défaut de la base. */
  const practice = await getCurrentPractice();

  let patientBirthDate: string | null = null;
  if (bilan.patient_id) {
    const { data: p } = await supabase
      .from("patients")
      .select("birth_date")
      .eq("id", bilan.patient_id)
      .maybeSingle();
    patientBirthDate = (p?.birth_date as string) ?? null;
  }

  return (
    <BilanEditor
      bilan={bilan}
      templates={templates}
      folders={folders}
      sections={sections}
      patientBirthDate={patientBirthDate}
      aujourdhui={dateCivile(new Date(), practice?.timezone)}
    />
  );
}
