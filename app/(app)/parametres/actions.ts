"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

  const str = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v === "" ? undefined : v;
  };

  const parseJson = <T,>(k: string): T | undefined => {
    const v = String(formData.get(k) ?? "").trim();
    if (!v) return undefined;
    try {
      return JSON.parse(v) as T;
    } catch {
      return undefined;
    }
  };

  // Récupère le profil existant pour préserver les champs non gérés par ce
  // formulaire (ex. adaptation_templates, enregistrés à part).
  const { data: existing } = await supabase
    .from("settings")
    .select("profile")
    .eq("user_id", user.id)
    .maybeSingle();

  const profile = {
    ...((existing?.profile as Record<string, unknown>) ?? {}),
    logo_url: str("logo_url"),
    address: str("address"),
    postal_code: str("postal_code"),
    city: str("city"),
    siret: str("siret"),
    adeli: str("adeli"),
    rpps: str("rpps"),
    business_email: str("business_email"),
    business_phone: str("business_phone"),
    legal_mentions: str("legal_mentions"),
    theme_color: str("theme_color"),
    bilan_font: str("bilan_font"),
    bilan_title_style: str("bilan_title_style"),
    gaussian_curve_url: str("gaussian_curve_url"),
    conclusion_top: formData.get("conclusion_top") === "on",
    closing_note: str("closing_note"),
    bilan_sections: parseJson("bilan_sections"),
  };

  await supabase.from("settings").upsert({
    user_id: user.id,
    display_name: String(formData.get("display_name") ?? "").trim() || null,
    retrocession_rate: pctToRate(formData.get("retrocession_rate")),
    urssaf_rate: pctToRate(formData.get("urssaf_rate")),
    charge_mode,
    monthly_rent: num(formData.get("monthly_rent")),
    profile,
    updated_at: new Date().toISOString(),
  });

  revalidatePath("/parametres");
  revalidatePath("/comptabilite");
  revalidatePath("/");
}

/** Suppression définitive de son propre compte et de toutes ses données. */
export async function deleteAccount() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // Nettoyage des fichiers stockés (le cascade DB ne couvre pas le storage).
  const { data: files } = await supabase.storage
    .from("documents")
    .list(user.id, { limit: 1000 });
  if (files && files.length) {
    await supabase.storage
      .from("documents")
      .remove(files.map((f) => `${user.id}/${f.name}`));
  }

  // Supprime le compte (cascade sur toutes les tables liées).
  await supabase.rpc("delete_my_account");
  await supabase.auth.signOut();
  redirect("/login");
}

/** Résiliation de son propre abonnement (l'utilisateur ne peut que résilier). */
export async function cancelSubscription() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("subscriptions")
    .update({
      status: "canceled",
      manual_override: false,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  revalidatePath("/parametres");
  revalidatePath("/");
}
