/**
 * Ce que le produit lit d'un `jsonb` n'est pas garanti par TypeScript.
 *
 * Les types déclarés pour l'instantané d'une pièce — `{ type, valeur }[]` et
 * ses voisins — décrivent ce que la base est CENSÉE rendre. Ils ne sont
 * vérifiés nulle part à l'exécution : un `jsonb` arrive tel qu'il a été écrit,
 * et une partie de ces instantanés vient d'une reprise dont la forme n'a jamais
 * été contrainte.
 *
 * Un `?? []` ne protège que du `null`. Si la valeur est un objet ou une chaîne,
 * `.map` et `.filter` n'existent pas et la page entière échoue — y compris la
 * page de consultation publique, la seule que le destinataire d'un document
 * puisse ouvrir, et la seule qu'il ne saura pas contourner.
 *
 * `liste` rend donc un tableau dans tous les cas. Ce qui n'est pas un tableau
 * devient un tableau vide : le document s'affiche amputé de cette rubrique
 * plutôt que pas du tout. Les rubriques vides sont déjà OMISES du rendu — le
 * produit n'a jamais converti une absence en valeur neutre, et ce choix-ci ne
 * le fait pas non plus.
 */
export function liste<T>(valeur: unknown): T[] {
  return Array.isArray(valeur) ? (valeur as T[]) : [];
}
