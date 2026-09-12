/**
 * Le nom saisi est-il une simple retouche de celui du dossier choisi ?
 *
 * On compare sur une forme réduite — sans accents, sans ponctuation, sans
 * casse, sans espaces superflus — et on accepte qu'un des deux contienne
 * l'autre. Corriger « Zephyr » en « Zéphyr », ajouter un second prénom,
 * retirer un trait d'union : le dossier reste. Saisir un nom entièrement
 * différent : le lien tombe, et l'écran le dit.
 */
function reduire(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function estUneRetouche(saisi: string, duDossier: string): boolean {
  const a = reduire(saisi);
  const b = reduire(duDossier);
  if (a === "" || b === "") return false;
  return a === b || a.startsWith(b) || b.startsWith(a);
}
