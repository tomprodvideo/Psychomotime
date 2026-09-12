import { createHash, randomBytes } from "node:crypto";

/**
 * Le jeton d'un lien de transmission.
 *
 * MODULE PUR au sens où il ne lit ni base ni requête : il ne fait que produire
 * un secret et son empreinte. C'est le seul endroit du dépôt qui manipule un
 * jeton en clair, et il ne le stocke nulle part.
 *
 * LA RÈGLE DE FOND. Le jeton existe en clair exactement le temps de l'afficher
 * à qui vient de le créer. La base n'en garde que l'empreinte SHA-256 : elle ne
 * peut donc pas le redonner, et aucune liste, aucune charge de page, aucun
 * export ne peut le faire fuiter. La version précédente le stockait en clair,
 * et la liste des factures les envoyait tous au navigateur à chaque affichage.
 */

/** Durée de validité par défaut, en jours. */
export const EXPIRATION_PAR_DEFAUT_JOURS = 30;

/** Durées proposées. Au-delà d'un an, un lien cesse d'être un lien de partage. */
export const EXPIRATIONS_PROPOSEES = [7, 30, 90, 365] as const;

/**
 * 32 octets tirés au sort, en base64url.
 *
 * 256 bits : le tâtonnement est hors de question, et c'est ce qui permet de ne
 * pas avoir à distinguer un jeton inconnu d'un jeton expiré — les deux rendent
 * la même réponse sans qu'on affaiblisse quoi que ce soit.
 */
export function nouveauJeton(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Empreinte stockée.
 *
 * DOIT CONCORDER AVEC LA BASE, qui calcule
 * `encode(sha256(convert_to(jeton, 'UTF8')), 'hex')`. Les deux côtés sont
 * épinglés sur un même vecteur d'essai, ici et dans `100_transmissions.sql` :
 * si l'un des deux changeait d'algorithme ou d'encodage, tous les liens déjà
 * transmis cesseraient de fonctionner en silence.
 */
export function empreinte(jeton: string): string {
  return createHash("sha256").update(jeton, "utf8").digest("hex");
}

/**
 * Les quatre derniers caractères, pour reconnaître un lien dans une liste.
 *
 * Quatre caractères base64url font moins de 24 bits : ils n'aident en rien à
 * retrouver les 256 autres, et ils suffisent à savoir lequel révoquer.
 */
export function indice(jeton: string): string {
  return jeton.slice(-4);
}

/** Date d'expiration, à partir d'une date de référence fournie. */
export function expiration(jours: number, depuis: Date): Date {
  const d = new Date(depuis);
  d.setDate(d.getDate() + jours);
  return d;
}
