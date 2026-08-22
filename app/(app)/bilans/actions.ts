"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function str(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

// Colonne inexistante (migration non appliquée) : PGRST204 (écriture) ou 42703.
const missingCol = (e: { code?: string } | null) =>
  e?.code === "PGRST204" || e?.code === "42703";

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
  if (missingCol(error)) {
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
  if (missingCol(error)) {
    const { tests: _t, ...rest } = payload;
    void _t;
    await supabase.from("bilans").update(rest).eq("id", id);
  }

  revalidatePath(`/bilans/${id}`);
  revalidatePath("/bilans");
}

export async function saveAdaptationLibrary(
  templates: {
    id: string;
    title: string;
    text: string;
    folder?: string | null;
  }[],
  folders: { id: string; name: string }[],
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: s } = await supabase
    .from("settings")
    .select("profile")
    .eq("user_id", user.id)
    .maybeSingle();

  const profile = {
    ...((s?.profile as Record<string, unknown>) ?? {}),
    adaptation_templates: templates,
    adaptation_folders: folders,
  };

  await supabase.from("settings").upsert({
    user_id: user.id,
    profile,
    updated_at: new Date().toISOString(),
  });

  revalidatePath("/bilans");
  revalidatePath("/parametres");
}

export async function deleteBilan(formData: FormData) {
  const supabase = await createClient();
  const id = str(formData.get("id"));
  if (id) await supabase.from("bilans").delete().eq("id", id);
  revalidatePath("/bilans");
  redirect("/bilans");
}
