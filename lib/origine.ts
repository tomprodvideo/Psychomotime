/**
 * L'ADRESSE PUBLIQUE DU SITE, POUR LES LIENS ENVOYÉS PAR COURRIEL.
 *
 * ── POURQUOI CETTE RÈGLE EST MÉFIANTE ─────────────────────────────────────
 *
 * Elle déduisait l'adresse de `x-forwarded-host`, sans vérification. C'est un
 * EN-TÊTE DE REQUÊTE : sa valeur est proposée par qui appelle. Or les liens
 * construits ici partent dans des courriels, et l'un d'eux — la mise à
 * disposition d'un document — porte le jeton de consultation EN CLAIR, parce
 * que le destinataire n'a pas de compte et que le lien EST la clé.
 *
 * Un en-tête accepté sans contrôle suffisait donc, en théorie, à faire
 * fabriquer par le produit lui-même un courriel dont le lien — jeton compris —
 * pointe vers un hôte choisi par un tiers. Le jeton part alors chez lui dès que
 * le destinataire clique.
 *
 * L'hébergeur réécrit normalement cet en-tête. « Normalement » n'est pas une
 * garantie qu'on veut voir porter un jeton d'accès à une pièce de santé.
 *
 * ── LA RÈGLE ──────────────────────────────────────────────────────────────
 *
 *  1. `SITE_ORIGIN`, si elle est posée, fait foi. Une variable d'environnement
 *     n'est pas proposée par l'appelant. Elle n'est PAS préfixée
 *     `NEXT_PUBLIC_` : elle n'a rien à faire dans le navigateur.
 *  2. Sinon, l'hôte de la requête n'est retenu QUE s'il est attendu.
 *  3. Sinon, l'adresse canonique du produit — jamais celle de la requête.
 */

/**
 * Les adresses publiques sur lesquelles ce produit est servi. La première est
 * l'adresse canonique : c'est elle qu'on emploie quand la requête arrive d'un
 * hôte qu'on ne reconnaît pas.
 *
 * Ce ne sont pas des secrets — ce sont les adresses qu'on lit dans la barre
 * d'adresse. Les inscrire ici sert à ce qu'un lien reparte sur le domaine que
 * la personne utilise vraiment, plutôt que de la renvoyer vers une autre
 * adresse du même site : recevoir un lien vers un domaine inattendu, c'est
 * exactement ce à quoi ressemble un courriel de contrefaçon, au moment précis
 * où l'on hésite déjà à cliquer.
 *
 * Ajouter un domaine au produit, c'est l'ajouter ici — les prévisualisations,
 * elles, sont couvertes par les variables de la plateforme. `SITE_ORIGIN`
 * reste le moyen de trancher sans toucher au code.
 */
const HOTES_DU_PRODUIT = [
  // `www` d'abord : c'est l'hôte réellement servi. Vérifié — l'apex répond 308
  // vers celui-ci. Bâtir un lien sur l'apex coûterait un saut de plus, sur un
  // lien qu'on envoie par courriel et qui porte parfois un jeton.
  "www.psychomotime.com",
  "psychomotime.com",
  "psychomotime.vercel.app",
] as const;

/**
 * Réduit une valeur d'environnement — avec ou sans protocole — à un hôte.
 *
 * LE PROTOCOLE EST VÉRIFIÉ, et pas par excès de zèle : `new URL()` accepte
 * n'importe quel schéma, si bien que `javascript://cabinet-de-lattaquant.test`
 * rendait l'hôte `cabinet-de-lattaquant.test` — et cette valeur-là devient
 * l'adresse d'un lien qui porte un jeton d'accès à une pièce de santé. C'est
 * l'entrée de plus haut privilège du module : une faute de frappe dans une
 * variable d'environnement ne doit pas produire un lien vers un hôte tiers.
 */
function hoteDe(valeur: string | undefined): string | null {
  const v = (valeur ?? "").trim();
  if (!v) return null;
  try {
    const u = new URL(v.includes("://") ? v : `https://${v}`);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    // Ni identifiants, ni chemin, ni requête : une origine, rien de plus.
    if (u.username !== "" || u.password !== "") return null;
    return u.host.toLowerCase();
  } catch {
    return null;
  }
}

/** `localhost`, `127.0.0.1`, `[::1]`, avec ou sans port. */
function estPosteLocal(hote: string): boolean {
  return /^(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?$/.test(hote);
}

/**
 * La règle, isolée de `next/headers` pour être vérifiable telle quelle.
 *
 * @param hote      hôte proposé par la requête, tel qu'il arrive.
 * @param protocole protocole proposé par la requête.
 * @param env       environnement lu (injecté pour les contrôles).
 */
export function origineAutorisee(
  hote: string | null,
  protocole: string | null,
  env: Record<string, string | undefined>,
): string {
  // 1. La configuration explicite l'emporte, toujours.
  const configure = hoteDe(env.SITE_ORIGIN);
  if (configure) {
    return `${estPosteLocal(configure) ? "http" : "https"}://${configure}`;
  }

  const propose = (hote ?? "").trim().toLowerCase();

  // 2. L'hôte proposé n'est retenu que s'il est attendu. La comparaison est
  //    une ÉGALITÉ : un sous-domaine d'un hôte attendu n'est pas cet hôte, et
  //    un nom qui le contient encore moins.
  const attendus: string[] = [
    ...HOTES_DU_PRODUIT,
    hoteDe(env.VERCEL_PROJECT_PRODUCTION_URL),
    hoteDe(env.VERCEL_URL),
  ].filter((h): h is string => h !== null);

  if (propose && attendus.includes(propose)) return `https://${propose}`;

  if (propose && estPosteLocal(propose)) {
    /* Le protocole ne suit l'en-tête QUE sur le poste de développement. Un
     * `x-forwarded-proto: http` proposé par une requête ne doit pas pouvoir
     * faire partir en clair un lien qui porte un jeton. */
    return `${protocole === "https" ? "https" : "http"}://${propose}`;
  }

  // 3. À défaut, l'adresse canonique. Le lien reste valide — tous ces domaines
  //    servent le même produit — et il ne part jamais vers un hôte proposé.
  return `https://${HOTES_DU_PRODUIT[0]}`;
}
