/**
 * Origine publique du site, pour les liens absolus envoyés par e-mail.
 *
 * ── POURQUOI CE FICHIER EST DEVENU MÉFIANT ────────────────────────────────
 *
 * Il déduisait l'origine de `x-forwarded-host`, sans vérification. C'est un
 * EN-TÊTE DE REQUÊTE : sa valeur est proposée par qui appelle. Les liens
 * construits ici partent dans des e-mails, et l'un d'eux — la mise à
 * disposition d'un document — porte le jeton de consultation EN CLAIR, parce
 * que le destinataire n'a pas de compte et que le lien est la clé.
 *
 * Un en-tête accepté sans contrôle suffisait donc, en théorie, à faire
 * fabriquer par le produit lui-même un courriel dont le lien — jeton compris —
 * pointe vers un hôte choisi par un tiers. Le jeton part alors chez lui dès que
 * le destinataire clique.
 *
 * L'hébergeur réécrit normalement cet en-tête. « Normalement » n'est pas une
 * garantie qu'on veut voir porter un jeton d'accès à une pièce de santé.
 *
 * ── CE QU'ON FAIT À LA PLACE ──────────────────────────────────────────────
 *
 *  1. `SITE_ORIGIN`, si elle est posée, fait foi. Une variable d'environnement
 *     n'est pas proposée par l'appelant. Elle n'est PAS préfixée `NEXT_PUBLIC_`
 *     — elle n'a rien à faire dans le navigateur.
 *  2. Sinon, l'hôte de la requête n'est retenu QUE s'il figure dans la liste
 *     des hôtes attendus : ceux que la plateforme déclare elle-même, et le
 *     poste de développement.
 *  3. Sinon, on refuse. Émettre un lien vers un hôte inconnu, c'est le cas
 *     qu'on cherche précisément à empêcher ; échouer bruyamment vaut mieux
 *     qu'envoyer un jeton à une adresse qu'on n'a pas reconnue.
 */

/** Réduit une valeur d'environnement — avec ou sans protocole — à un hôte. */
function hoteDe(valeur: string | undefined): string | null {
  const v = (valeur ?? "").trim();
  if (!v) return null;
  try {
    return new URL(v.includes("://") ? v : `https://${v}`).host.toLowerCase();
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
  const attendus = [
    hoteDe(env.VERCEL_PROJECT_PRODUCTION_URL),
    hoteDe(env.VERCEL_URL),
  ].filter((h): h is string => h !== null);

  // 2. L'hôte proposé n'est retenu que s'il est attendu.
  if (propose && (attendus.includes(propose) || estPosteLocal(propose))) {
    // Le protocole suit l'hôte, il ne se déduit pas d'un en-tête : en clair en
    // local, chiffré partout ailleurs. Un `http` proposé par la requête ne doit
    // pas pouvoir dégrader un lien qui porte un jeton.
    if (estPosteLocal(propose)) {
      return `${protocole === "https" ? "https" : "http"}://${propose}`;
    }
    return `https://${propose}`;
  }

  // 3. À défaut, l'hôte que la plateforme déclare — jamais celui de la requête.
  if (attendus.length > 0) return `https://${attendus[0]}`;

  throw new Error(
    "L'adresse publique du site n'a pas pu être établie. Renseignez la variable d'environnement SITE_ORIGIN (par exemple https://exemple.fr) : sans elle, un lien envoyé par courriel pourrait pointer vers un hôte inattendu.",
  );
}
