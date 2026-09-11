import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// /facture/<jeton>   : consultation par le patient, qui n'a pas de compte.
// /mot-de-passe/...  : on y arrive justement parce qu'on ne peut plus se
//                      connecter. Les écrans eux-mêmes exigent ce qu'il faut :
//                      /nouveau redirige sans la session créée par le lien.
const PUBLIC_PATHS = ["/login", "/auth", "/facture", "/mot-de-passe"];

export async function updateSession(request: NextRequest) {
  // Tant que la clé Supabase n'est pas renseignée, on laisse passer
  // (l'app affiche un écran « configuration requise »).
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

  // Une Server Action arrive en POST. Une redirection depuis le proxy renvoie
  // un 307, qui REJOUE le corps de la requête ET l'en-tête « Next-Action » sur
  // l'URL cible : l'action est alors ré-exécutée à chaque saut de redirection
  // (d'où des bilans créés en rafale). On ne redirige donc jamais une requête
  // mutative — ce sont les actions elles-mêmes qui vérifient la session.
  const isMutating = request.method !== "GET" && request.method !== "HEAD";

  // Une redirection crée une NOUVELLE réponse : il faut y recopier les cookies
  // de session rafraîchis par getUser(), sinon ils sont perdus et la requête
  // suivante repart déconnectée (ping-pong /login <-> /).
  const redirectTo = (pathname: string) => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    const res = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => res.cookies.set(cookie));
    return res;
  };

  // Non connecté + page privée -> login
  if (!user && !isPublic) {
    return isMutating ? supabaseResponse : redirectTo("/login");
  }

  // Déjà connecté + page de login -> accueil
  if (user && path.startsWith("/login")) {
    return isMutating ? supabaseResponse : redirectTo("/");
  }

  return supabaseResponse;
}
