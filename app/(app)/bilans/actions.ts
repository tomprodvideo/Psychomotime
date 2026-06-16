"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function str(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

export async function createBilan(formData: FormData) {
  const supabase = await createClient();
  const payload = {
    patient_id: str(formData.get("patient_id")),
    patient_name: String(formData.get("patient_name") ?? "").trim(),
    title: str(formData.get("title")) ?? "Bilan psychomoteur",
    bilan_date: str(formData.get("bilan_date")),
    author: str(formData.get("author")),
    content: {},
  };
  const { data } = await supabase
    .from("bilans")
    .insert(payload)
    .select("id")
    .single();

  revalidatePath("/bilans");
  if (data?.id) redirect(`/bilans/${data.id}`);
  redirect("/bilans");
}

export async function saveBilan(formData: FormData) {
  const supabase = await createClient();
  const id = str(formData.get("id"));
  if (!id) return;

  let content: Record<string, string> = {};
  try {
    content = JSON.parse(String(formData.get("content") ?? "{}"));
  } catch {
    content = {};
  }

  const payload = {
    patient_id: str(formData.get("patient_id")),
    patient_name: String(formData.get("patient_name") ?? "").trim(),
    title: str(formData.get("title")) ?? "Bilan psychomoteur",
    bilan_date: str(formData.get("bilan_date")),
    author: str(formData.get("author")),
    status: str(formData.get("status")) ?? "brouillon",
    content,
    updated_at: new Date().toISOString(),
  };

  await supabase.from("bilans").update(payload).eq("id", id);
  revalidatePath(`/bilans/${id}`);
  revalidatePath("/bilans");
}

export async function deleteBilan(formData: FormData) {
  const supabase = await createClient();
  const id = str(formData.get("id"));
  if (id) await supabase.from("bilans").delete().eq("id", id);
  revalidatePath("/bilans");
  redirect("/bilans");
}
