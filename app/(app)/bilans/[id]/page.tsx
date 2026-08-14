import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data";
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

  const settings = await getSettings();
  const templates = settings.profile?.adaptation_templates ?? [];

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
      patientBirthDate={patientBirthDate}
      anamneseNoteDefault={settings.profile?.anamnese_note}
      anamneseNoteOn={settings.profile?.anamnese_note_on}
    />
  );
}
