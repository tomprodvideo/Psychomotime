import { headers } from "next/headers";

/**
 * Origine publique du site, déduite de la requête en cours.
 *
 * Sert à construire les liens absolus envoyés par e-mail — réinitialisation de
 * mot de passe, mise à disposition d'une facture. On la déduit de la requête
 * plutôt que de la figer dans une variable d'environnement : le même code sert
 * ainsi le développement local, les prévisualisations et la production, sans
 * qu'un lien ne parte jamais vers le mauvais environnement.
 */
export async function siteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}
