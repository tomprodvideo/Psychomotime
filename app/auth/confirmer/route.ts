import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Point d'atterrissage des liens envoyés par e-mail — réinitialisation de mot
 * de passe, confirmation d'adresse.
 *
 * Supabase redirige ici avec un `code` à échanger contre une session. Tant que
 * cet échange n'a pas eu lieu, l'utilisateur n'est pas connecté : c'est ce qui
 * fait que le lien seul, sans ce passage, ne donne accès à rien.
 *
 * `next` détermine la page d'arrivée. Elle est contrainte à un chemin interne :
 * un `next` absolu permettrait à quiconque forge un lien de faire rebondir
 * l'utilisateur vers un site tiers avec une session fraîche — c'est une
 * redirection ouverte, et elle sert à l'hameçonnage.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const demande = searchParams.get("next") ?? "/";

  // Chemin interne uniquement : commence par « / » et pas par « // » ni « /\ ».
  const next = /^\/(?![/\\])/.test(demande) ? demande : "/";

  if (!code) {
    return NextResponse.redirect(
      `${origin}/login?erreur=lien-invalide`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // Lien expiré, déjà utilisé, ou forgé. Le motif exact reste côté serveur.
    console.error("[auth] échange de code refusé :", error.message);
    return NextResponse.redirect(`${origin}/login?erreur=lien-expire`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
