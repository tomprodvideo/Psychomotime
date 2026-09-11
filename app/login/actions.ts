"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkPassword } from "@/lib/auth/password";

export interface AuthState {
  error?: string;
  message?: string;
}

export async function signIn(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Email ou mot de passe incorrect." };
  }
  redirect("/");
}

export async function signUp(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("display_name") ?? "").trim();

  const verdict = checkPassword(password, email);
  if (!verdict.ok) return { error: verdict.error };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });

  if (error) {
    // Le message brut du fournisseur peut révéler qu'une adresse est déjà
    // enregistrée, ou nommer une contrainte de configuration. Il reste côté
    // serveur ; l'utilisateur reçoit un motif utile et non bavard.
    console.error("[auth] inscription refusée :", error.message);
    return {
      error:
        "La création du compte a échoué. Vérifiez l'adresse saisie, ou réessayez dans quelques instants.",
    };
  }

  // Si la confirmation par email est désactivée, une session est créée -> on entre directement.
  if (data.session) {
    redirect("/");
  }

  return {
    message:
      "Compte créé. Vérifiez votre boîte mail pour confirmer l'adresse, puis connectez-vous.",
  };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
