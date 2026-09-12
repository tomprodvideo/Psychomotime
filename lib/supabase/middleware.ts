import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// /document/<jeton> : consultation par un destinataire qui n'a pas de compte.
// /mot-de-passe/...  : on y arrive justement parce qu'on ne peut plus se
//                      connecter. Les écrans eux-mêmes exigent ce qu'il faut :
//                      /nouveau redirige sans la session créée par le lien.
const PUBLIC_PATHS = ["/login", "/auth", "/document", "/mot-de-passe"];

/**
 * Le chemin de consultation par jeton.
 *
 * LE JETON EST DANS L'URL, et c'est inévitable : le destinataire n'a pas de
 * compte, le lien EST la clé. Tout ce qui suit vise donc à l'empêcher de
 * fuiter ailleurs que dans la barre d'adresse de qui l'a reçu.
 */
const CHEMIN_PUBLIC_JETON = "/document";

/**
 * En-têtes posés sur la consultation par jeton.
 *
 *  · `no-store` — rien de ce document ne doit rester dans un cache partagé, ni
 *    dans celui d'un mandataire d'entreprise, ni sur un poste prêté.
 *  · `no-referrer` — sans quoi le jeton complet part dans l'en-tête `Referer`
 *    de la moindre ressource externe ou du moindre lien suivi. C'est la fuite
 *    la plus facile à provoquer et la plus difficile à voir.
 *  · `noindex, nofollow, noarchive` — un lien qui atterrit dans un moteur de
 *    recherche cesse d'être un secret. L'en-tête double la balise de la page :
 *    elle couvre aussi le PDF et les réponses d'erreur.
 *  · `DENY` en cadre — un document remis ne s'encadre pas dans une page tierce.
 */
function enTetesDocumentPublic(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.headers.set("Referrer-Policy", "no-referrer");
  res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
  res.headers.set("X-Frame-Options", "DENY");
  return res;
}

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

  // La consultation par jeton sort ici, avec ses en-têtes : elle n'a besoin
  // d'aucune session, et la suite du traitement ne la concerne pas.
  if (path.startsWith(CHEMIN_PUBLIC_JETON)) {
    return enTetesDocumentPublic(supabaseResponse);
  }

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
