"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PATIENT_DOSSIER_FIELDS } from "@/lib/constants";

function str(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

export async function savePatient(formData: FormData) {
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
      ? supabase.from("patients").update(data).eq("id", id)
      : supabase.from("patients").insert(data);

  // Repli progressif si guardian/dossier n'existent pas encore (migrations 006/007).
  let { error } = await run({ ...base, guardian, dossier });
  if (error?.code === "42703") {
    ({ error } = await run({ ...base, guardian }));
  }
  if (error?.code === "42703") {
    await run(base);
  }

  revalidatePath("/patients");
  if (id) revalidatePath(`/patients/${id}`);
}

export async function deletePatient(formData: FormData) {
  const supabase = await createClient();
  const id = str(formData.get("id"));
  if (id) await supabase.from("patients").delete().eq("id", id);
  revalidatePath("/patients");
  redirect("/patients");
}
