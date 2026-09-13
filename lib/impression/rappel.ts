/**
 * LE RAPPEL DE PAGE : ce qu'une page isolée dit d'elle-même.
 *
 * ── LE DÉFAUT QU'IL CORRIGE ───────────────────────────────────────────────
 *
 * Quatre documents portaient un bloc `hidden print:block` présenté en
 * commentaire comme un rappel de page : « Sans ce rappel, la page 2
 * n'identifie ni le document, ni la personne, ni la période. » C'étaient des
 * paragraphes en flux normal, placés après la signature. Ils s'imprimaient UNE
 * fois, en bas de la dernière page. La page 2 d'une synthèse de trois pages
 * n'identifiait toujours rien. Trois documents sur neuf n'en avaient aucun.
 *
 * Une page qui ne dit pas de qui elle parle, ramassée seule sur une imprimante
 * partagée ou glissée dans le mauvais dossier, est le risque d'attribution que
 * `docs/clinical/CLINICAL_SAFETY.md` place en tête de liste.
 *
 * ── LE MÉCANISME, MESURÉ ET NON SUPPOSÉ ───────────────────────────────────
 *
 * Deux mécanismes ont été imprimés en PDF par Chrome 152 sans en-tête ni pied
 * de page du navigateur, puis relus page par page (`pdftotext`) :
 *
 *  · un élément en `position: fixed; bottom: -16mm` — la proposition de la
 *    revue de conception : le texte n'apparaît sur AUCUNE des quatre pages.
 *    Le décalage négatif le sort de la zone imprimée, et il est rogné. Il
 *    aurait reproduit exactement le défaut qu'il devait corriger ;
 *  · les boîtes de marge de `@page` : le texte apparaît sur les QUATRE pages,
 *    dans la marge, sans jamais chevaucher le corps — et avec « page 2 sur 4 ».
 *    La revue les disait indisponibles dans les navigateurs exportateurs ;
 *    c'est faux pour Chrome.
 *
 * NON VÉRIFIÉ, et dit comme tel : Safari et Firefox. Là où les boîtes de marge
 * ne sont pas prises en charge, le rappel n'apparaît simplement pas — la page
 * retombe sur l'état d'avant, sans rien casser ni chevaucher.
 *
 * ── CE QU'IL CONTIENT, ET CE QU'IL NE CONTIENDRA JAMAIS ───────────────────
 *
 * La nature du document, la personne, la date ou la période. Jamais une
 * adresse, jamais un numéro de dossier, jamais un contenu clinique : c'est la
 * ligne qu'on lit sur une page oubliée dans un bac d'imprimante. Le nom et la
 * date suffisent à rattacher ; c'est déjà le maximum acceptable pour une
 * donnée d'identité classée sensible.
 */

/**
 * Une chaîne de caractères CSS, sûre par construction.
 *
 * LISTE BLANCHE, pas liste noire. Tout ce qui n'est ni lettre ASCII ni chiffre
 * devient un échappement hexadécimal à six chiffres — l'espace compris. Aucun
 * guillemet, aucune barre oblique inverse, aucun chevron, aucune accolade ne
 * peut donc survivre dans la sortie : un nom contenant `"; } body{display:none}`
 * ou `</style><script>` s'imprime comme du texte, et ne peut ni fermer la
 * chaîne, ni la règle, ni l'élément `<style>`. Éprouvé dans un PDF : le corps
 * du document a survécu et le nom hostile s'est imprimé à la lettre.
 *
 * CHAQUE ÉCHAPPEMENT EST SUIVI D'UNE ESPACE. En CSS, une espace qui suit un
 * échappement hexadécimal est absorbée comme terminateur. Sans elle, l'espace
 * RÉELLE qui suivait disparaissait : « Zoé « » s'imprimait « Zoé« ». Trouvé en
 * relisant le PDF, pas en relisant le code.
 *
 * Itère par POINT DE CODE (`for…of`) : un emoji est un seul caractère, pas
 * deux demi-paires de substitution.
 */
export function chaineCss(s: string): string {
  let sortie = "";
  for (const c of s) {
    sortie += /^[A-Za-z0-9]$/.test(c)
      ? c
      : `\\${c.codePointAt(0)!.toString(16).toUpperCase().padStart(6, "0")} `;
  }
  return `"${sortie}"`;
}

export interface Rappel {
  /** Ce qu'est le document : « Synthèse de suivi », « Facture ». */
  nature: string;
  /** De qui il parle. Absent pour un document qui ne concerne personne. */
  personne?: string | null;
  /** La date de remise, ou la période couverte. */
  date?: string | null;
}

/** Le texte de gauche, tel qu'il s'imprimera. Exposé pour être contrôlé. */
export function texteRappel(r: Rappel): string {
  return [r.nature, r.personne, r.date]
    .map((x) => x?.trim())
    .filter((x): x is string => Boolean(x))
    .join(" · ");
}

const POLICE = "8pt/1.2 system-ui, -apple-system, Helvetica, sans-serif";

/**
 * La feuille à poser dans la page. Le seul texte variable passe par
 * `chaineCss` ; « page », « sur » et les compteurs sont écrits ici.
 */
export function cssRappelDePage(r: Rappel): string {
  return (
    "@media print{@page{" +
    `@bottom-left{content:${chaineCss(texteRappel(r))};font:${POLICE};color:#475569}` +
    `@bottom-right{content:"page " counter(page) " sur " counter(pages);font:${POLICE};color:#475569}` +
    "}}"
  );
}
