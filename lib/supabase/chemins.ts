/**
 * QUELS CHEMINS S'OUVRENT SANS COMPTE.
 *
 * Ce fichier ne contient qu'une comparaison de chaînes, et c'est pour cela
 * qu'il existe séparément : la règle qu'il porte décide si une page s'affiche
 * à un visiteur sans session, et une règle pareille doit être vérifiable sans
 * fabriquer une requête, une session et un client Supabase.
 *
 * LE DÉFAUT QU'IL CORRIGE. La liste des chemins publics était comparée par
 * `path.startsWith(p)`. `/document` est public — c'est la consultation par
 * jeton. Mais `"/documents".startsWith("/document")` vaut `true` : le module
 * Documents du cabinet, authentifié, était donc classé public par le
 * filtre. Un préfixe n'est pas un segment de chemin.
 *
 * Trouvé par la relecture de sécurité du lot des transmissions.
 */

/**
 * Vrai lorsque `chemin` EST `prefixe`, ou descend de lui par un segment
 * complet. `/document` couvre `/document/abc` mais pas `/documents`.
 */
export function estSousChemin(chemin: string, prefixe: string): boolean {
  return chemin === prefixe || chemin.startsWith(prefixe + "/");
}

/**
 * Les chemins ouverts sans session.
 *
 *  · `/login`, `/auth` — s'y rendre est la seule façon d'obtenir une session.
 *  · `/document/<jeton>` — le destinataire n'a pas de compte ; le lien est la
 *    clé. C'est la seule porte du produit ouverte sur l'extérieur.
 *  · `/mot-de-passe/...` — on y arrive justement parce qu'on ne peut plus se
 *    connecter. Les écrans eux-mêmes exigent ce qu'il faut : `/nouveau`
 *    redirige sans la session créée par le lien de réinitialisation.
 */
export const CHEMINS_PUBLICS = ["/login", "/auth", "/document", "/mot-de-passe"] as const;

/** Le chemin de consultation par jeton, qui reçoit des en-têtes à lui. */
export const CHEMIN_PUBLIC_JETON = "/document";

export function estCheminPublic(chemin: string): boolean {
  return CHEMINS_PUBLICS.some((p) => estSousChemin(chemin, p));
}

export function estConsultationPublique(chemin: string): boolean {
  return estSousChemin(chemin, CHEMIN_PUBLIC_JETON);
}
