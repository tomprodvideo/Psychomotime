"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function str(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

// Code d'erreur Postgres pour « colonne inexistante » (migration non appliquée).
const UNDEFINED_COLUMN = "42703";

export async function createBilan(formData: FormData) {
  const supabase = await createClient();
  const payload = {
    patient_id: str(formData.get("patient_id")),
    patient_name: String(formData.get("patient_name") ?? "").trim(),
    title: str(formData.get("title")) ?? "Bilan psychomoteur",
    bilan_date: str(formData.get("bilan_date")),
    author: str(formData.get("author")),
    content: {},
    tests: {},
  };

  let { data, error } = await supabase
    .from("bilans")
    .insert(payload)
    .select("id")
    .single();

  // Repli si la colonne "tests" n'existe pas encore (migration_003 non lancée).
  if (error?.code === UNDEFINED_COLUMN) {
    const { tests: _t, ...rest } = payload;
    void _t;
    ({ data, error } = await supabase
      .from("bilans")
      .insert(rest)
      .select("id")
      .single());
  }

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

  let tests: Record<string, unknown> = {};
  try {
    tests = JSON.parse(String(formData.get("tests") ?? "{}"));
  } catch {
    tests = {};
  }

  const payload = {
    patient_id: str(formData.get("patient_id")),
    patient_name: String(formData.get("patient_name") ?? "").trim(),
    title: str(formData.get("title")) ?? "Bilan psychomoteur",
    bilan_date: str(formData.get("bilan_date")),
    author: str(formData.get("author")),
    status: str(formData.get("status")) ?? "brouillon",
    content,
    tests,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("bilans").update(payload).eq("id", id);

  // Repli si la colonne "tests" n'existe pas encore (migration_003 non lancée).
  if (error?.code === UNDEFINED_COLUMN) {
    const { tests: _t, ...rest } = payload;
    void _t;
    await supabase.from("bilans").update(rest).eq("id", id);
  }

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
