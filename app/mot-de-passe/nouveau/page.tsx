import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AuthShell from "../AuthShell";
import NouveauMotDePasseForm from "./NouveauMotDePasseForm";

import type { Metadata } from "next";
/* LE TITRE EST STATIQUE, ET C'EST DÉLIBÉRÉ. Un titre qui porterait le nom du
   patient le ferait entrer dans l'historique du navigateur, parfois synchronisé
   entre appareils, parfois affiché devant quelqu'un d'autre. C'est le même
   raisonnement que celui de la page de consultation publique, et il vaut
   autant ici. Distinguer les pages entre elles suffit. */
export const metadata: Metadata = { title: "Nouveau mot de passe · Psychomotime" };


/**
 * Écran de choix d'un nouveau mot de passe.
 *
 * Il exige une session : celle que `/auth/confirmer` vient de créer à partir du
 * lien reçu par e-mail. Sans elle, le lien seul ne mène nulle part.
 */
export default async function NouveauMotDePassePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/mot-de-passe/oublie?erreur=lien-expire");

  return (
    <AuthShell
      titre="Nouveau mot de passe"
      sousTitre={`Compte ${user.email ?? ""}. Les autres appareils connectés seront déconnectés.`}
      retour={false}
    >
      <NouveauMotDePasseForm />
    </AuthShell>
  );
}
