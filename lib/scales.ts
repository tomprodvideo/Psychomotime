/**
 * Classement d'une valeur dans une bande — SOURCE UNIQUE.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  RÈGLE D'ARCHITECTURE, NON NÉGOCIABLE
 *
 *  Le formulaire, le tableau, le graphique et le document imprimé appellent
 *  `classer()` et RIEN D'AUTRE. Aucune de ces quatre surfaces ne contient de
 *  borne, de couleur ni de libellé de bande.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  POURQUOI. Trois implémentations concurrentes de la même règle cohabitent
 *  aujourd'hui dans le produit : la couleur du tableau d'épreuves, le texte de
 *  la légende imprimée et la courbe. Elles divergent aux valeurs 4, 7 et 17, et
 *  une même teinte y signifie « très supérieur » d'un côté et « moyenne » de
 *  l'autre — sur la même page d'un compte rendu remis à une famille.
 *
 *  Aucun correctif ponctuel ne tiendrait : tant que trois endroits décident,
 *  ils finiront par diverger à nouveau. Ce module est le seul qui décide.
 *
 *  CE QU'IL NE FAIT PAS, et ce n'est pas un oubli :
 *   · il ne convertit aucune échelle vers une autre — une conversion est propre
 *     à une version d'instrument et suppose une autorisation de son éditeur ;
 *   · il ne devine aucune borne — un découpage absent rend `non_classable`,
 *     jamais une valeur par défaut ;
 *   · il ne transforme pas une valeur illisible en zéro. Une donnée absente
 *     n'est jamais convertie en résultat.
 */

export type ResultType =
  | "brut"
  | "note_standard"
  | "note_t"
  | "percentile"
  | "ecart_type"
  | "age_developpement"
  | "categorie"
  | "autre";

export type ScaleDirection =
  | "croissant_favorable"
  | "decroissant_favorable"
  | "non_oriente";

export interface Scale {
  id: string;
  name: string;
  result_type: ResultType;
  mean: number | null;
  sd: number | null;
  min_value: number | null;
  max_value: number | null;
  decimals: number;
  direction: ScaleDirection;
}

export interface Band {
  id: string;
  position: number;
  lower_bound: number | null;
  lower_inclusive: boolean;
  upper_bound: number | null;
  upper_inclusive: boolean;
  label_key: string;
  colour: string | null;
}

export interface BandSet {
  id: string;
  version: string;
  source: string;
  active: boolean;
  vocabulary_usage: "interne" | "document_remis";
  /** Un vocabulaire destiné à un document remis doit être validé par quelqu'un. */
  vocabulary_validated: boolean;
  /** Clé de libellé → texte, tel que le praticien l'a écrit. */
  labels: Record<string, string>;
  bands: Band[];
}

/** Où la valeur est affichée. Le document remis est plus exigeant que l'outil. */
export type Surface = "editeur" | "tableau" | "graphique" | "document";

export type MotifNonClassable =
  | "resultat_non_saisi"
  | "valeur_non_numerique"
  | "hors_bornes_echelle"
  | "aucun_jeu_de_bandes_actif"
  | "echelle_non_orientee"
  | "aucune_bande_correspondante";

export type Classement =
  | {
      statut: "classe";
      valeur: number;
      bandId: string;
      /** `null` si le vocabulaire n'est pas validé pour cette surface. */
      libelle: string | null;
      couleur: string | null;
      bandSetId: string;
      bandSetVersion: string;
      source: string;
      /** L'intervalle reconstruit des bornes, tel qu'on peut l'écrire. */
      comparateur: string;
    }
  | {
      statut: "non_classable";
      motif: MotifNonClassable;
      /** Ce que l'utilisateur a saisi, conservé tel quel. */
      saisie: string | null;
    };

/**
 * Lit une valeur saisie.
 *
 * Rend `null` sur tout ce qui n'est pas un nombre — « < 1 », « NC », « 7 ? »,
 * une case vide. Ces saisies sont LÉGITIMES : elles disent quelque chose que le
 * praticien a voulu dire. Elles ne doivent ni être converties, ni disparaître,
 * ni recevoir une couleur.
 */
export function lireValeur(brut: unknown): number | null {
  if (typeof brut === "number") {
    return Number.isFinite(brut) ? brut : null;
  }
  if (typeof brut !== "string") return null;

  const s = brut.trim().replace(",", ".");
  if (s === "") return null;
  // Strictement un nombre, éventuellement signé. « 7 ? » et « < 1 » sortent.
  if (!/^[+-]?\d+(\.\d+)?$/.test(s)) return null;

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Vrai si la valeur tombe dans la bande, inclusivités comprises. */
function dansLaBande(b: Band, v: number): boolean {
  if (b.lower_bound !== null) {
    if (b.lower_inclusive ? v < b.lower_bound : v <= b.lower_bound) return false;
  }
  if (b.upper_bound !== null) {
    if (b.upper_inclusive ? v > b.upper_bound : v >= b.upper_bound) return false;
  }
  return true;
}

/** L'intervalle d'une bande, écrit comme on l'écrirait à la main. */
export function comparateur(b: Band): string {
  const bas =
    b.lower_bound === null
      ? null
      : `${b.lower_bound} ${b.lower_inclusive ? "≤" : "<"} v`;
  const haut =
    b.upper_bound === null
      ? null
      : `v ${b.upper_inclusive ? "≤" : "<"} ${b.upper_bound}`;

  if (bas && haut) return `${b.lower_bound} ${b.lower_inclusive ? "≤" : "<"} v ${b.upper_inclusive ? "≤" : "<"} ${b.upper_bound}`;
  return bas ?? haut ?? "toute valeur";
}

/**
 * Classe une valeur.
 *
 * `surface` détermine si le libellé peut être rendu : un vocabulaire non validé
 * s'affiche dans l'outil de travail, jamais sur un document qui sort du
 * cabinet. La différence est assumée, elle n'est pas un défaut.
 */
export function classer(
  scale: Scale | null,
  bandSet: BandSet | null,
  brut: unknown,
  surface: Surface = "editeur",
): Classement {
  const saisie = typeof brut === "string" ? brut : brut == null ? null : String(brut);

  if (brut === null || brut === undefined || (typeof brut === "string" && brut.trim() === "")) {
    return { statut: "non_classable", motif: "resultat_non_saisi", saisie };
  }

  const valeur = lireValeur(brut);
  if (valeur === null) {
    return { statut: "non_classable", motif: "valeur_non_numerique", saisie };
  }

  // Une échelle sans direction déclarée ne peut pas être colorée : rien ne dit
  // de quel côté se trouve « mieux ». Le chiffre s'affiche nu.
  if (!scale || scale.direction === "non_oriente") {
    return { statut: "non_classable", motif: "echelle_non_orientee", saisie };
  }

  if (
    (scale.min_value !== null && valeur < scale.min_value) ||
    (scale.max_value !== null && valeur > scale.max_value)
  ) {
    return { statut: "non_classable", motif: "hors_bornes_echelle", saisie };
  }

  if (!bandSet || !bandSet.active || bandSet.bands.length === 0) {
    return { statut: "non_classable", motif: "aucun_jeu_de_bandes_actif", saisie };
  }

  const bande = bandSet.bands.find((b) => dansLaBande(b, valeur));
  if (!bande) {
    return { statut: "non_classable", motif: "aucune_bande_correspondante", saisie };
  }

  // Le libellé ne sort du cabinet que s'il a été validé par quelqu'un.
  const libelleAutorise =
    surface !== "document" ||
    (bandSet.vocabulary_usage === "document_remis" && bandSet.vocabulary_validated);

  return {
    statut: "classe",
    valeur,
    bandId: bande.id,
    libelle: libelleAutorise ? (bandSet.labels[bande.label_key] ?? null) : null,
    couleur: bande.colour,
    bandSetId: bandSet.id,
    bandSetVersion: bandSet.version,
    source: bandSet.source,
    comparateur: comparateur(bande),
  };
}

/** Ce qu'on affiche à l'utilisateur quand une valeur n'est pas classable. */
export const MOTIF_LABELS: Record<MotifNonClassable, string> = {
  resultat_non_saisi: "Non renseigné",
  valeur_non_numerique: "Valeur non chiffrée : affichée telle quelle, non interprétée",
  hors_bornes_echelle: "Hors des bornes déclarées de l'échelle",
  aucun_jeu_de_bandes_actif: "Aucun découpage actif pour cette échelle",
  echelle_non_orientee: "Échelle sans direction déclarée : aucune interprétation",
  aucune_bande_correspondante: "Aucune bande ne couvre cette valeur",
};

/**
 * Contrôle de cohérence entre l'âge à la passation et la plage annoncée.
 *
 * AVERTIT, ne bloque jamais. Un instrument est parfois employé hors de sa plage
 * en connaissance de cause ; ce qui doit être impossible, c'est de le faire
 * sans que cela se voie sur le document.
 */
export function verifierTrancheAge(
  ageEnMoisALaPassation: number | null,
  instrument: { age_min_months: number | null; age_max_months: number | null; name: string },
): string | null {
  if (ageEnMoisALaPassation === null) return null;
  const { age_min_months: min, age_max_months: max, name } = instrument;
  if (min === null && max === null) return null;

  const ans = (m: number) => {
    const a = Math.floor(m / 12);
    const r = m % 12;
    return r === 0 ? `${a} ans` : `${a} ans ${r} mois`;
  };

  if (min !== null && ageEnMoisALaPassation < min) {
    return `À la date de passation, l'âge (${ans(ageEnMoisALaPassation)}) est inférieur à la plage annoncée de ${name} (à partir de ${ans(min)}). L'étalonnage ne s'applique pas ; la limite doit figurer au compte rendu.`;
  }
  if (max !== null && ageEnMoisALaPassation > max) {
    return `À la date de passation, l'âge (${ans(ageEnMoisALaPassation)}) dépasse la plage annoncée de ${name} (jusqu'à ${ans(max)}). L'étalonnage ne s'applique pas ; la limite doit figurer au compte rendu.`;
  }
  return null;
}
