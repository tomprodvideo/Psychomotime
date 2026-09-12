/**
 * D'OÙ VIENT CE PARAGRAPHE.
 *
 * ── LA RÈGLE QUE CE FICHIER FAIT RESPECTER ────────────────────────────────
 *
 * `CLAUDE.md`, règle absolue n° 5 : « Toute synthèse clinique générée doit
 * indiquer sa provenance, rester modifiable et exiger une validation humaine
 * avant partage ou inscription définitive au dossier. »
 *
 * Elle n'était pas tenue. Le texte reformulé remplaçait le champ SANS AUCUNE
 * MARQUE : après enregistrement, plus rien — ni en base, ni à l'écran — ne
 * permettait de savoir qu'une section avait été reformulée. L'annulation, elle,
 * vivait dans un seul emplacement en mémoire, détruit à la première frappe et
 * perdu au rechargement. Le texte sortait ensuite sous la signature de la
 * praticienne, indiscernable du sien.
 *
 * ── CE QUI EST CONSIGNÉ, ET CE QUI NE L'EST PAS ───────────────────────────
 *
 * Pour chaque section reformulée : la date, le modèle qui a produit le texte,
 * le texte AVANT, et le texte rendu. Le « avant » est ce qui rend l'annulation
 * durable — elle survit au rechargement, ce qui est la moindre des choses pour
 * un geste qu'on regrette souvent après coup.
 *
 * Rien n'est écrit ailleurs que dans le bilan lui-même : la provenance vit dans
 * le même enregistrement que le texte qu'elle décrit, et disparaît avec lui.
 *
 * ── CE QUE CE FICHIER NE PRÉTEND PAS FAIRE ────────────────────────────────
 *
 * Il ne VALIDE rien. Savoir qu'un paragraphe a été reformulé n'est pas la même
 * chose que l'avoir relu : la validation reste un geste de la praticienne, et
 * le produit ne la simule pas.
 */

export interface Provenance {
  /** Date ISO de la reformulation. */
  le: string;
  /** Modèle qui a produit le texte, tel que l'action l'a rendu. */
  modele: string;
  /** Le texte tel qu'il était avant. C'est lui qui rend l'annulation durable. */
  avant: string;
  /** Le texte tel que le modèle l'a rendu. Comparé au texte courant, il dit si
   *  la praticienne a repris la main depuis. */
  apres: string;
}

export type Provenances = Record<string, Provenance>;

/** Le texte courant a-t-il été retouché depuis la reformulation ? */
export function repriseEnMain(p: Provenance, courant: string): boolean {
  return courant.trim() !== p.apres.trim();
}

/**
 * La mention affichée à la praticienne.
 *
 * Elle dit ce qui s'est passé, pas ce qu'il faut en penser. « Relu » ou
 * « validé » seraient des affirmations que le produit n'est pas en position de
 * faire — il sait qu'un texte a été retouché, pas qu'il a été jugé juste.
 */
export function mentionProvenance(p: Provenance, courant: string): string {
  /* DATE LOCALE, pas UTC. `slice(0, 10)` sur un horodatage ISO rend le jour
   * UTC : une reformulation faite à 00 h 30 à Paris s'affichait la veille. Sur
   * une trace qui accompagne un document clinique, une date fausse d'un jour
   * est une date fausse. */
  const d = new Date(p.le);
  const jour = Number.isNaN(d.getTime())
    ? p.le.slice(0, 10).split("-").reverse().join("/")
    : `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  return repriseEnMain(p, courant)
    ? `Reformulé par l'assistant le ${jour}, puis modifié.`
    : `Reformulé par l'assistant le ${jour}. Texte non modifié depuis.`;
}

/**
 * Les sections telles que l'assistant les a écrites, sans retouche depuis.
 *
 * C'est la liste que la praticienne doit reconnaître avant de finaliser — le
 * troisième tiers de la règle absolue n° 5, « exiger une validation humaine
 * avant partage ou inscription définitive », qui n'était pas même amorcé : le
 * chemin reformuler → enregistrer → finaliser → imprimer se parcourait sans un
 * seul geste reconnaissant qu'un modèle avait écrit.
 *
 * UNE SECTION RETOUCHÉE N'EST PAS LISTÉE. La praticienne y est déjà passée ;
 * la lui redemander banaliserait la question, et une question qu'on banalise
 * cesse d'être lue.
 *
 * Une section VIDÉE n'est pas listée non plus, et elle l'est SANS CONDITION
 * SUPPLÉMENTAIRE : un champ vide diffère forcément du texte rendu, donc
 * `repriseEnMain` le classe déjà comme retouché. J'avais d'abord ajouté un
 * test explicite du vide ; le retirer ne faisait échouer aucun contrôle,
 * parce qu'il ne pouvait rien décider. Il est parti — une condition qu'aucun
 * cas ne distingue est une décoration qui se donne l'air d'un garde-fou.
 */
export function sectionsGenereesNonRetouchees(
  provenances: Provenances,
  contenu: Record<string, string>,
): string[] {
  return Object.entries(provenances)
    .filter(([cle, p]) => !repriseEnMain(p, contenu[cle] ?? ""))
    .map(([cle]) => cle);
}
