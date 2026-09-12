/**
 * INSÉRER UN FRAGMENT LÀ OÙ LE CURSEUR SE TROUVE.
 *
 * Les modèles réutilisables et la dictée concaténaient l'un et l'autre EN FIN
 * DE CHAMP. Un modèle n'était donc utilisable qu'au tout début d'un paragraphe
 * ou en queue : dès qu'un texte existait, il fallait insérer puis remonter le
 * fragment à la main. Le mécanisme censé faire gagner du temps en reprenait
 * une partie aussitôt. Et l'on ne pouvait pas dicter un complément au milieu
 * d'un paragraphe déjà écrit.
 *
 * Cette fonction est pure pour être vérifiable : le découpage d'un texte
 * clinique à une position numérique est exactement le genre de calcul qui
 * échoue d'un caractère sans que cela se voie, et l'écran où il s'emploie
 * n'est pas atteignable sans session.
 */
export interface Insertion {
  /** Le texte obtenu. */
  texte: string;
  /** Où replacer le curseur : juste après ce qui vient d'être inséré. */
  curseur: number;
}

export function insererAuCurseur(
  texte: string,
  debut: number,
  fin: number,
  fragment: string,
): Insertion {
  /* Une position hors du texte, ou inversée, ne doit pas produire un
   * découpage fantaisiste : on la ramène dans les bornes. `slice` tolérerait
   * n'importe quoi en silence, et c'est précisément ce qu'on ne veut pas. */
  const n = texte.length;
  const d = Math.min(Math.max(debut, 0), n);
  const f = Math.min(Math.max(Math.max(fin, d), 0), n);

  const avant = texte.slice(0, d);
  const apres = texte.slice(f);

  /* Une espace de part et d'autre quand le voisinage en manque : sans cela,
   * insérer entre deux mots les colle. À droite, on ne l'ajoute pas devant une
   * ponctuation — « fatigué ., » serait pire que le défaut qu'on corrige. */
  const gaucheColle = avant !== "" && !/\s$/.test(avant);
  const droiteColle = apres !== "" && !/^[\s.,;:!?)\]»]/.test(apres);
  const insere = (gaucheColle ? " " : "") + fragment + (droiteColle ? " " : "");

  return { texte: avant + insere + apres, curseur: (avant + insere).length };
}
