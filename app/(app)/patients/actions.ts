"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  const payload = {
    first_name: String(formData.get("first_name") ?? "").trim(),
    last_name: String(formData.get("last_name") ?? "").trim(),
    birth_date: str(formData.get("birth_date")),
    email: str(formData.get("email")),
    phone: str(formData.get("phone")),
    address: str(formData.get("address")),
    notes: str(formData.get("notes")),
    guardian,
  };

  const run = async (data: Record<string, unknown>) =>
    id
      ? supabase.from("patients").update(data).eq("id", id)
      : supabase.from("patients").insert(data);

  const { error } = await run(payload);
  // Repli si la colonne guardian n'existe pas encore (migration_006 non lancée).
  if (error?.code === "42703") {
    const { guardian: _g, ...rest } = payload;
    void _g;
    await run(rest);
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
