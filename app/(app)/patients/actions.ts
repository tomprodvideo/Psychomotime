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
  const payload = {
    first_name: String(formData.get("first_name") ?? "").trim(),
    last_name: String(formData.get("last_name") ?? "").trim(),
    birth_date: str(formData.get("birth_date")),
    email: str(formData.get("email")),
    phone: str(formData.get("phone")),
    notes: str(formData.get("notes")),
  };
  if (id) {
    await supabase.from("patients").update(payload).eq("id", id);
  } else {
    await supabase.from("patients").insert(payload);
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
