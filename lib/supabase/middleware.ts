import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { estCheminPublic, estConsultationPublique, estSousChemin } from "./chemins";

// La liste des chemins ouverts sans session, et la règle qui décide si un
// chemin en relève, vivent dans `./chemins` : elles s'y vérifient sans avoir à
// fabriquer une requête. Voir le défaut qu'elles corrigent, expliqué là-bas.

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
  res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
  return enTetesDeBase(res);
}

/**
 * Les en-têtes posés sur TOUTE réponse du produit.
 *
 * LE DÉFAUT, constaté en production le 2026-09-13 : ces quatre en-têtes ne
 * couvraient QUE la consultation par jeton. Le reste de l'application — les
 * dossiers, les notes cliniques, les bilans, la comptabilité — n'en portait
 * aucun. `/login` répondait même `cache-control: public`.
 *
 * Trois conséquences, et aucune n'est théorique :
 *
 *  · SANS `X-Frame-Options`, une page portant un dossier patient s'encadre
 *    dans un site tiers. C'est le clic détourné, sur des écrans qui archivent
 *    un dossier ou remettent un document.
 *  · SANS `Referrer-Policy`, l'URL part dans l'en-tête `Referer` de la moindre
 *    ressource externe ou du moindre lien suivi. Or les URL du produit portent
 *    des identifiants directs — `/patients/<uuid>`, `/bilans/<uuid>` — et
 *    `docs/security/DATA_CLASSIFICATION.md` demande précisément d'éviter les
 *    identifiants sensibles dans les URL.
 *  · SANS `no-store`, un mandataire d'entreprise ou un poste partagé peut
 *    retenir une page clinique. C'est le même raisonnement que pour le
 *    document remis par jeton ; il vaut au moins autant pour le dossier
 *    complet.
 *
 * `nosniff` s'y ajoute : il manquait même à la page publique.
 *
 * ── UNE LIMITE, DITE PLUTÔT QUE TUE ───────────────────────────────────────
 *
 * Les trois en-têtes de sécurité arrivent sur TOUTE réponse. `Cache-Control`,
 * lui, ne tient que sur les routes RENDUES À LA DEMANDE — c'est-à-dire toutes
 * celles qui portent des données. Sur une page pré-rendue statiquement
 * (`/login`, `/mot-de-passe/oublie`), Next pose la sienne et elle l'emporte.
 * Ces pages-là ne contiennent rien de clinique ; la limite est donc sans
 * conséquence, mais elle ne doit pas être prise pour une couverture totale.
 */
function enTetesDeBase(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.headers.set("Referrer-Policy", "no-referrer");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  return res;
}

export async function updateSession(request: NextRequest) {
  // Tant que la clé Supabase n'est pas renseignée, on laisse passer
  // (l'app affiche un écran « configuration requise »).
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    // Même sans configuration, la réponse porte ses protections : l'écran
    // « configuration requise » n'a pas à être encadrable ni mis en cache.
    return enTetesDeBase(NextResponse.next({ request }));
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
  const isPublic = estCheminPublic(path);

  // La consultation par jeton sort ici, avec ses en-têtes : elle n'a besoin
  // d'aucune session, et la suite du traitement ne la concerne pas.
  if (estConsultationPublique(path)) {
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
    return enTetesDeBase(isMutating ? supabaseResponse : redirectTo("/login"));
  }

  /* Déjà connecté + page de login -> accueil.
   *
   * SEULEMENT `/login`. Ni `/auth`, qui est l'aboutissement de la connexion,
   * ni `/mot-de-passe/nouveau`, qu'on atteint précisément AVEC la session
   * ouverte par le lien de réinitialisation : y rediriger renverrait la
   * personne à l'accueil sans lui laisser changer son mot de passe. */
  if (user && estSousChemin(path, "/login")) {
    return enTetesDeBase(isMutating ? supabaseResponse : redirectTo("/"));
  }

  return enTetesDeBase(supabaseResponse);
}
