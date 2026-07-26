import { createClient } from "@/lib/supabase/server";
import type { Access, Settings, Subscription } from "@/lib/types";

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

const TRIAL_MS = 7 * 24 * 60 * 60 * 1000;

/** Détermine si le compte connecté a accès (admin, essai en cours, ou abonnement actif). */
export async function getAccess(): Promise<Access> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      active: false,
      isAdmin: false,
      status: "none",
      trialEnd: null,
      trialDaysLeft: null,
    };
  }

  let { data } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  // Filet de sécurité si la ligne n'existe pas encore.
  if (!data) {
    const { data: created } = await supabase
      .from("subscriptions")
      .insert({
        user_id: user.id,
        email: user.email,
        status: "trialing",
        trial_end: new Date(Date.now() + TRIAL_MS).toISOString(),
      })
      .select("*")
      .maybeSingle();
    data = created ?? null;
  }

  const sub = data as Subscription | null;
  const isAdmin = !!sub?.is_admin;
  const now = Date.now();
  const trialEnd = sub?.trial_end ?? null;
  const trialActive =
    sub?.status === "trialing" && trialEnd
      ? new Date(trialEnd).getTime() > now
      : false;

  const active =
    isAdmin ||
    !!sub?.manual_override ||
    sub?.status === "active" ||
    trialActive;

  const trialDaysLeft =
    trialActive && trialEnd
      ? Math.max(0, Math.ceil((new Date(trialEnd).getTime() - now) / 86400000))
      : null;

  return {
    active,
    isAdmin,
    status: sub?.status ?? "inactive",
    trialEnd,
    trialDaysLeft,
  };
}
