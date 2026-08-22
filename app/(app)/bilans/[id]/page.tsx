import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data";
import { resolveBilanSections } from "@/lib/constants";
import type { Bilan } from "@/lib/types";
import BilanEditor from "./BilanEditor";

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
  const templates = settings.profile?.adaptation_templates ?? [];
  const folders = settings.profile?.adaptation_folders ?? [];
  const sections = resolveBilanSections(settings.profile, bilanType);

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
    />
  );
}
