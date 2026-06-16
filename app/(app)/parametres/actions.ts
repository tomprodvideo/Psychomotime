"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function pctToRate(v: FormDataEntryValue | null): number {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return isNaN(n) ? 0 : n / 100;
}

function num(v: FormDataEntryValue | null): number {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return isNaN(n) ? 0 : n;
}

export async function updateSettings(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const charge_mode =
    String(formData.get("charge_mode")) === "loyer" ? "loyer" : "retrocession";

  await supabase.from("settings").upsert({
    user_id: user.id,
    display_name: String(formData.get("display_name") ?? "").trim() || null,
    retrocession_rate: pctToRate(formData.get("retrocession_rate")),
    urssaf_rate: pctToRate(formData.get("urssaf_rate")),
    charge_mode,
    monthly_rent: num(formData.get("monthly_rent")),
    updated_at: new Date().toISOString(),
  });

  revalidatePath("/parametres");
  revalidatePath("/comptabilite");
  revalidatePath("/");
}
