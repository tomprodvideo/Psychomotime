import { createClient } from "@/lib/supabase/server";
import type { Settings } from "@/lib/types";

const DEFAULT_SETTINGS: Omit<Settings, "user_id" | "created_at" | "updated_at"> =
  {
    display_name: null,
    retrocession_rate: 0.25,
    urssaf_rate: 0.232,
    charge_mode: "retrocession",
    monthly_rent: 0,
    profile: {},
  };

/** Récupère (ou crée) la ligne de paramètres de l'utilisateur connecté. */
export async function getSettings(): Promise<Settings> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Non authentifié");

  const { data } = await supabase
    .from("settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (data) return data as Settings;

  // Filet de sécurité si le trigger n'a pas créé la ligne.
  const { data: created } = await supabase
    .from("settings")
    .insert({ user_id: user.id, ...DEFAULT_SETTINGS })
    .select("*")
    .single();

  return (created ?? {
    user_id: user.id,
    ...DEFAULT_SETTINGS,
    created_at: "",
    updated_at: "",
  }) as Settings;
}
