export const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

export const PAYMENT_METHODS = [
  "Virement",
  "Chèque",
  "Espèces",
  "Carte bancaire",
  "PCO",
  "Autre",
];

/* ============================================================
 *  BILAN PSYCHOMOTEUR
 * ============================================================ */

/** Champs d'en-tête (encadré anamnèse). Stockés dans content jsonb. */
export interface BilanMetaField {
  id: string;
  label: string;
  placeholder?: string;
}

export const BILAN_META: BilanMetaField[] = [
  { id: "scolarite", label: "Scolarité", placeholder: "Ex. CE1 (2025-2026)" },
  {
    id: "passation",
    label: "Dates de passation",
    placeholder: "Ex. 20/02, 27/02, 06/03/2026",
  },
  {
    id: "prescripteur",
    label: "Médecin prescripteur",
    placeholder: "Ex. PCO 42-43",
  },
  {
    id: "motif",
    label: "Motif de la demande",
    placeholder: "Ex. Particularités sensorielles, gestion des émotions",
  },
];

/** Sections rédigées (texte). */
export interface BilanSection {
  id: string;
  title: string;
  hint?: string;
  long?: boolean;
  /** Bloc M-ABC3 à insérer sous cette section dans le PDF. */
  mabcBlocks?: ("equilibre" | "oculo" | "dexterite")[];
}

export interface BilanGroup {
  group: string;
  sections: BilanSection[];
}

export const BILAN_TEMPLATE: BilanGroup[] = [
  {
    group: "Anamnèse & contexte",
    sections: [
      {
        id: "anamnese",
        title: "L'anamnèse",
        hint: "Grossesse, naissance, développement, langage, propreté, suivis, sommeil, repas, autonomie, vie familiale et scolaire, sensoriel…",
        long: true,
      },
      {
        id: "comportement",
        title: "Comportement durant le bilan",
        hint: "Contact, coopération, attention, besoin de mouvement, réaction au chronomètre…",
        long: true,
      },
    ],
  },
  {
    group: "Domaines psychomoteurs",
    sections: [
      {
        id: "motricite_globale",
        title: "La motricité globale",
        hint: "Coordinations MS/MI (pantin), coordinations oculo-manuelles, équilibres…",
        long: true,
        mabcBlocks: ["equilibre", "oculo"],
      },
      {
        id: "motricite_fine",
        title: "La motricité fine et les praxies manuelles",
        hint: "Dextérité, prono-supination, EMG, praxies…",
        long: true,
        mabcBlocks: ["dexterite"],
      },
      {
        id: "graphisme",
        title: "Le graphisme",
        hint: "Pré-scripturaux, tenue du stylo, fluidité, BHK (qualité, vitesse)…",
        long: true,
      },
      {
        id: "schema_corporel",
        title: "Le schéma corporel",
        hint: "Somatognosies (Bergès-Lézine), dessin du bonhomme…",
        long: true,
      },
      {
        id: "tonus",
        title: "Le tonus",
        hint: "Tonus de fond, de soutien, d'action ; syncinésies (NP-MOT)…",
        long: true,
      },
      {
        id: "lateralite",
        title: "La latéralité",
        hint: "Manuelle (spontanée, usuelle, psycho-sociale, graphique), pédestre (NP-MOT)…",
        long: true,
      },
      {
        id: "espace",
        title: "L'organisation spatiale",
        hint: "Droite/gauche sur soi et autrui, orientation, figure de Rey, image de Rey…",
        long: true,
      },
      {
        id: "temps",
        title: "L'organisation temporelle",
        hint: "Tempo spontané, adaptation aux rythmes frappés/marchés, repères temporels (NP-MOT)…",
        long: true,
      },
      {
        id: "attention",
        title: "Attention & Mémoire",
        hint: "Attention soutenue (frappes 1-2), mémoire des dessins (rappel immédiat/différé)…",
        long: true,
      },
      {
        id: "affectif",
        title: "Les émotions",
        hint: "Reconnaissance et régulation émotionnelle, ressentis corporels, confiance en soi…",
        long: true,
      },
    ],
  },
  {
    group: "Synthèse",
    sections: [
      {
        id: "conclusion",
        title: "Conclusion",
        hint: "Profil psychomoteur par domaine (points d'appui / fragilités), hypothèses, proposition de suivi, adaptations, préconisations…",
        long: true,
      },
    ],
  },
];

export const BILAN_SECTIONS = BILAN_TEMPLATE.flatMap((g) => g.sections);

/* ---------- Tests étalonnés ---------- */
export interface PsychomotorTest {
  id: string;
  label: string;
}

export const PSYCHOMOTOR_TESTS: PsychomotorTest[] = [
  { id: "mabc3", label: "M-ABC3" },
  { id: "np_mot", label: "NP-MOT" },
  { id: "bonhomme", label: "Dessin du bonhomme (Goodenough)" },
  { id: "bhk", label: "BHK" },
  { id: "memoire_dessins", label: "Mémoire des dessins" },
  { id: "figure_rey", label: "Figure de Rey" },
  { id: "image_rey", label: "Image de Rey" },
  { id: "berges_lezine", label: "Somatognosies de Bergès-Lézine" },
  { id: "emg", label: "EMG (motricité gnosopraxique distale)" },
];

/* ---------- M-ABC3 par groupe d'âge ---------- */
export interface MabcRow {
  key: string;
  epreuve: string;
  perfHint?: string;
}
export interface MabcGroup {
  group: 1 | 2 | 3;
  label: string;
  blocks: {
    equilibre: MabcRow[];
    oculo: MabcRow[];
    dexterite: MabcRow[];
  };
}

export const MABC_BLOCK_TITLES: Record<string, string> = {
  equilibre: "Équilibre et locomotion",
  oculo: "Coordination oculo-manuelle",
  dexterite: "Dextérité manuelle",
};

const JAMBES = "Meilleure jambe (JD) : … / Autre jambe (JG) : …";
const MAINS = "Main préférée (MD) : … / Main non préférée (MG) : …";

export const MABC_GROUPS: MabcGroup[] = [
  {
    group: 1,
    label: "Groupe 1 · 3 – 6 ans 11 mois",
    blocks: {
      equilibre: [
        {
          key: "g1_eq_0",
          epreuve: "Tenir en équilibre sur un pied sur un tapis",
          perfHint: JAMBES,
        },
        { key: "g1_eq_1", epreuve: "Marcher sur la pointe des pieds", perfHint: "… pas" },
        { key: "g1_eq_2", epreuve: "Sauter pieds joints sur les tapis" },
      ],
      oculo: [
        { key: "g1_oc_0", epreuve: "Attraper le sac lesté", perfHint: "…/10" },
        { key: "g1_oc_1", epreuve: "Lancer le sac sur le tapis", perfHint: "…/10" },
        {
          key: "g1_oc_2",
          epreuve: "Faire rebondir une grosse balle et l'attraper à deux mains",
          perfHint: "…/10",
        },
      ],
      dexterite: [
        { key: "g1_dx_0", epreuve: "Tracer des cercles" },
        {
          key: "g1_dx_1",
          epreuve: "Mettre des jetons dans une tirelire",
          perfHint: MAINS,
        },
        { key: "g1_dx_2", epreuve: "Enfiler des cubes" },
        { key: "g1_dx_3", epreuve: "Enfiler un lacet" },
      ],
    },
  },
  {
    group: 2,
    label: "Groupe 2 · 7 – 11 ans 11 mois",
    blocks: {
      equilibre: [
        {
          key: "g2_eq_0",
          epreuve: "Tenir en équilibre sur un pied sur une planche",
          perfHint: JAMBES,
        },
        { key: "g2_eq_1", epreuve: "Marcher talon-pointe en avant", perfHint: "… pas" },
        { key: "g2_eq_2", epreuve: "Sauter à cloche-pied sur les tapis" },
      ],
      oculo: [
        {
          key: "g2_oc_0",
          epreuve: "Attraper le sac lesté à deux mains",
          perfHint: "…/10",
        },
        { key: "g2_oc_1", epreuve: "Lancer le sac sur le tapis", perfHint: "…/10" },
        {
          key: "g2_oc_2",
          epreuve: "Faire rebondir une balle de tennis et l'attraper à deux mains",
          perfHint: "…/10",
        },
      ],
      dexterite: [
        { key: "g2_dx_0", epreuve: "Tracer des cercles" },
        { key: "g2_dx_1", epreuve: "Placer les chevilles", perfHint: MAINS },
        { key: "g2_dx_2", epreuve: "Enfiler des cubes" },
        { key: "g2_dx_3", epreuve: "Enfiler un lacet" },
      ],
    },
  },
  {
    group: 3,
    label: "Groupe 3 · 12 – 25 ans 11 mois",
    blocks: {
      equilibre: [
        {
          key: "g3_eq_0",
          epreuve: "Tenir en équilibre sur deux pieds sur une planche",
        },
        { key: "g3_eq_1", epreuve: "Marcher talon-pointe en arrière", perfHint: "… pas" },
        { key: "g3_eq_2", epreuve: "Sauter à cloche-pied en zig-zag sur les tapis" },
      ],
      oculo: [
        {
          key: "g3_oc_0",
          epreuve: "Attraper le sac lesté à une main",
          perfHint: "…/10",
        },
        { key: "g3_oc_1", epreuve: "Lancer le sac sur le tapis", perfHint: "…/10" },
        {
          key: "g3_oc_2",
          epreuve: "Faire rebondir une balle de tennis et l'attraper à une main",
          perfHint: "…/10",
        },
      ],
      dexterite: [
        { key: "g3_dx_0", epreuve: "Tracer des cercles" },
        { key: "g3_dx_1", epreuve: "Retourner les chevilles", perfHint: MAINS },
        { key: "g3_dx_2", epreuve: "Enfiler des cubes" },
        { key: "g3_dx_3", epreuve: "Faire un triangle avec écrous et vis" },
      ],
    },
  },
];

/**
 * Couleur d'une note standard (NS) selon la zone de la courbe :
 * ≤4 rouge (pathologique), 5–7 orange (fragilité), 8–13 vert (moyenne),
 * 14–16 vert clair (supérieur), ≥17 vert pâle (très supérieur).
 */
export function nsColor(value?: string | null): string | undefined {
  if (value == null) return undefined;
  const n = parseInt(String(value).replace(/[^\d-]/g, ""), 10);
  if (Number.isNaN(n)) return undefined;
  if (n <= 4) return "#c0504d";
  if (n <= 7) return "#d99b2b";
  if (n <= 13) return "#4e7d2f";
  if (n <= 16) return "#7ba653";
  return "#5a8a37";
}

/** Texte fixe d'interprétation des scores (encadré « Résultats chiffrés »). */
export const SCORE_INTERPRETATION = {
  intro:
    "Les scores ont pour but de rendre l'évaluation la plus objective possible et de situer l'enfant par rapport à sa classe d'âge. Les scores sont pour la plupart exprimés en déviations standards (DS), quelques-uns en notes standards (NS). Ces notes allant jusqu'à 19 ne sont pas équivalentes au barème scolaire noté sur 20.",
  ds: [
    "Moyenne : entre -1 DS et +1 DS",
    "Zone de fragilité : entre -1 et -2 DS",
    "Zone dite « pathologique » : inférieur ou égal à -2 DS",
  ],
  ns: [
    "Moyenne : entre 7 et 13",
    "Zone de fragilité : entre 5 et 7",
    "Zone dite « pathologique » : inférieur ou égal à 4",
  ],
};
