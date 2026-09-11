"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/guard";
import { checkPassword } from "@/lib/auth/password";
import { siteOrigin } from "@/lib/siteOrigin";

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

  const existingProfile = (existing?.profile as Record<string, unknown>) ?? {};

  // Réglages d'apparence par type de bilan (thème, typo, conclusion, signature, courbe).
  const perType =
    (existingProfile.bilan_settings as Record<string, unknown>) ?? {};
  const psy = parseJson("bilan_settings_psychomoteur");
  const sen = parseJson("bilan_settings_sensoriel");
  const bilan_settings = {
    ...perType,
    ...(psy ? { psychomoteur: psy } : {}),
    ...(sen ? { sensoriel: sen } : {}),
  };

  const profile = {
    ...existingProfile,
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
    invoice_number_format: str("invoice_number_format"),
    recurring_expenses: parseJson("recurring_expenses"),
    bilan_settings,
    bilan_sections: parseJson("bilan_sections"),
    bilan_sections_sensoriel: parseJson("bilan_sections_sensoriel"),
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

/* ==========================================================================
 *  Sécurité du compte
 * ========================================================================== */

export interface CompteState {
  error?: string;
  message?: string;
}

/**
 * Change le mot de passe depuis l'application.
 *
 * Le mot de passe actuel est redemandé et REVÉRIFIÉ auprès du fournisseur. Sans
 * cela, un poste laissé déverrouillé quelques minutes suffirait à verrouiller
 * durablement le compte d'un tiers. C'est la même raison qui fera exiger une
 * ré-authentification avant la suppression de compte.
 */
export async function changerMotDePasse(
  _prev: CompteState,
  formData: FormData,
): Promise<CompteState> {
  const session = await requireUser();
  if (!session.ok) return { error: session.error };

  const actuel = String(formData.get("mot_de_passe_actuel") ?? "");
  const nouveau = String(formData.get("nouveau_mot_de_passe") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");

  if (nouveau !== confirmation) {
    return { error: "Les deux saisies du nouveau mot de passe ne correspondent pas." };
  }
  if (nouveau === actuel) {
    return { error: "Le nouveau mot de passe est identique à l'actuel." };
  }

  const verdict = checkPassword(nouveau, session.value.email);
  if (!verdict.ok) return { error: verdict.error };

  const supabase = await createClient();
  const { error: reauth } = await supabase.auth.signInWithPassword({
    email: session.value.email ?? "",
    password: actuel,
  });
  if (reauth) {
    return { error: "Le mot de passe actuel est incorrect." };
  }

  const { error } = await supabase.auth.updateUser({ password: nouveau });
  if (error) {
    console.error("[compte] changement de mot de passe refusé :", error.message);
    return { error: "Le mot de passe n'a pas pu être modifié. Réessayez." };
  }

  // Les autres appareils sont déconnectés : c'est ce qu'on attend d'un
  // changement de mot de passe quand on soupçonne un accès indu.
  await supabase.auth.signOut({ scope: "others" });

  return {
    message:
      "Mot de passe modifié. Les autres appareils connectés ont été déconnectés.",
  };
}

/**
 * Change l'adresse e-mail du compte.
 *
 * Supabase envoie une confirmation à la NOUVELLE adresse, et — si l'option
 * « Secure email change » est active dans le projet — également à l'ancienne.
 * Tant que la confirmation n'a pas eu lieu, l'adresse de connexion reste
 * l'ancienne : un changement non confirmé ne peut donc pas enfermer
 * l'utilisateur dehors.
 *
 * [À INSTRUIRE] L'état de l'option « Secure email change » côté projet Supabase
 * n'est pas observable depuis le dépôt. À vérifier dans la console avant mise
 * en service : sans elle, l'ancienne adresse n'est pas prévenue.
 */
export async function changerEmail(
  _prev: CompteState,
  formData: FormData,
): Promise<CompteState> {
  const session = await requireUser();
  if (!session.ok) return { error: session.error };

  const nouvelEmail = String(formData.get("nouvel_email") ?? "").trim();
  const motDePasse = String(formData.get("mot_de_passe") ?? "");

  if (!nouvelEmail.includes("@")) {
    return { error: "Indiquez une adresse e-mail valide." };
  }
  if (nouvelEmail.toLowerCase() === (session.value.email ?? "").toLowerCase()) {
    return { error: "C'est déjà l'adresse de votre compte." };
  }

  const supabase = await createClient();
  const { error: reauth } = await supabase.auth.signInWithPassword({
    email: session.value.email ?? "",
    password: motDePasse,
  });
  if (reauth) {
    return { error: "Le mot de passe est incorrect." };
  }

  const origin = await siteOrigin();
  const { error } = await supabase.auth.updateUser(
    { email: nouvelEmail },
    { emailRedirectTo: `${origin}/auth/confirmer?next=/parametres` },
  );
  if (error) {
    console.error("[compte] changement d'adresse refusé :", error.message);
    return {
      error:
        "Le changement n'a pas pu être demandé. Vérifiez l'adresse saisie, ou réessayez.",
    };
  }

  return {
    message: `Un lien de confirmation vient d'être envoyé à ${nouvelEmail}. Votre adresse de connexion reste l'ancienne tant que vous ne l'avez pas ouvert.`,
  };
}
