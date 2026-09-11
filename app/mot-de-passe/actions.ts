"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkPassword } from "@/lib/auth/password";
import { requireUser } from "@/lib/auth/guard";
import { siteOrigin } from "@/lib/siteOrigin";

export interface MotDePasseState {
  error?: string;
  message?: string;
}

/**
 * Demande de réinitialisation.
 *
 * La réponse est LA MÊME que l'adresse existe ou non. Répondre « aucun compte
 * avec cette adresse » transformerait ce formulaire en outil d'énumération :
 * on saurait, sans compte, qui utilise le produit. Pour un logiciel de santé,
 * c'est déjà une information à protéger.
 */
export async function demanderReinitialisation(
  _prev: MotDePasseState,
  formData: FormData,
): Promise<MotDePasseState> {
  const email = String(formData.get("email") ?? "").trim();
  const reponseNeutre: MotDePasseState = {
    message:
      "Si un compte existe avec cette adresse, un lien de réinitialisation vient d'être envoyé. Il est valable une heure. Pensez à regarder dans les indésirables.",
  };

  if (!email || !email.includes("@")) {
    return { error: "Indiquez une adresse e-mail." };
  }

  const supabase = await createClient();
  const origin = await siteOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirmer?next=/mot-de-passe/nouveau`,
  });

  if (error) {
    // Le détail reste côté serveur : il pourrait révéler l'existence du compte
    // ou l'état de la configuration d'envoi.
    console.error("[auth] réinitialisation refusée :", error.message);
  }
  return reponseNeutre;
}

/**
 * Définition d'un nouveau mot de passe.
 *
 * Exige une session : celle créée par le lien de récupération, ou celle d'un
 * utilisateur déjà connecté qui change son mot de passe depuis les paramètres.
 */
export async function definirMotDePasse(
  _prev: MotDePasseState,
  formData: FormData,
): Promise<MotDePasseState> {
  const session = await requireUser();
  if (!session.ok) return { error: session.error };

  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("password_confirmation") ?? "");

  if (password !== confirmation) {
    return { error: "Les deux saisies ne correspondent pas." };
  }

  const verdict = checkPassword(password, session.value.email);
  if (!verdict.ok) return { error: verdict.error };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    console.error("[auth] changement de mot de passe refusé :", error.message);
    return {
      error:
        "Le mot de passe n'a pas pu être modifié. Si vous êtes arrivé ici par un lien reçu par e-mail, il a peut-être expiré : redemandez-en un.",
    };
  }

  // Un changement de mot de passe doit fermer les autres sessions : c'est
  // précisément ce qu'on attend de lui quand on soupçonne un accès indu.
  await supabase.auth.signOut({ scope: "others" });

  redirect("/?motdepasse=modifie");
}
