"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PATIENT_DOSSIER_FIELDS } from "@/lib/constants";
import type { PatientContact } from "@/lib/types";

function str(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

/** Enregistre un patient (création ou édition) et renvoie son id, pour que
 *  l'appelant puisse le sélectionner aussitôt (ex. dialogue de facture). */
export async function savePatient(
  formData: FormData,
): Promise<{ id: string | null; patient: PatientContact | null }> {
  const supabase = await createClient();
  const id = str(formData.get("id"));

  const guardian = {
    relation: str(formData.get("guardian_relation")),
    first_name: str(formData.get("guardian_first_name")),
    last_name: str(formData.get("guardian_last_name")),
    phone: str(formData.get("guardian_phone")),
    email: str(formData.get("guardian_email")),
    address: str(formData.get("guardian_address")),
  };

  const dossier: Record<string, string | null> = {};
  for (const f of PATIENT_DOSSIER_FIELDS) {
    dossier[f.id] = str(formData.get(`dossier_${f.id}`));
  }

  const base = {
    first_name: String(formData.get("first_name") ?? "").trim(),
    last_name: String(formData.get("last_name") ?? "").trim(),
    birth_date: str(formData.get("birth_date")),
    email: str(formData.get("email")),
    phone: str(formData.get("phone")),
    address: str(formData.get("address")),
    notes: str(formData.get("notes")),
  };

  const run = async (data: Record<string, unknown>) =>
    id
      ? supabase
          .from("patients")
          .update(data)
          .eq("id", id)
          .select("id, first_name, last_name, birth_date, email, phone, address")
          .single()
      : supabase.from("patients").insert(data).select("id, first_name, last_name, birth_date, email, phone, address").single();

  // Repli progressif si guardian/dossier n'existent pas encore (migrations 006/007).
  // PostgREST renvoie PGRST204 (écriture) ou 42703 (colonne inconnue).
  const missingCol = (e: { code?: string } | null) =>
    e?.code === "PGRST204" || e?.code === "42703";

  let { data, error } = await run({ ...base, guardian, dossier });
  if (missingCol(error)) {
    ({ data, error } = await run({ ...base, guardian }));
  }
  if (missingCol(error)) {
    ({ data, error } = await run(base));
  }

  const patient = (data as PatientContact | null) ?? null;
  const savedId = patient?.id ?? id ?? null;

  revalidatePath("/patients");
  revalidatePath("/comptabilite");
  if (savedId) revalidatePath(`/patients/${savedId}`);
  return { id: savedId, patient };
}

export async function deletePatient(formData: FormData) {
  const supabase = await createClient();
  const id = str(formData.get("id"));
  if (id) await supabase.from("patients").delete().eq("id", id);
  revalidatePath("/patients");
  redirect("/patients");
}
