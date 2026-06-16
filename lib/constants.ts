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

/**
 * Structure du bilan psychomoteur.
 * Chaque section a un id (clé de stockage dans content jsonb),
 * un titre, une aide, et un type (texte long ou court).
 */
export interface BilanSection {
  id: string;
  title: string;
  hint?: string;
  long?: boolean;
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
        id: "motif",
        title: "Motif de la demande",
        hint: "Qui adresse, médecin prescripteur, inquiétudes principales…",
        long: true,
      },
      {
        id: "scolarite",
        title: "Scolarité",
        hint: "Classe, école, type de classe…",
      },
      {
        id: "tests",
        title: "Tests utilisés et dates de passation",
        hint: "Ex. M-ABC, NP-MOT, BHK, figure de Rey, Bergès-Lézine… + dates",
        long: true,
      },
      {
        id: "anamnese",
        title: "Anamnèse",
        hint: "Grossesse, naissance, développement, langage, propreté, sommeil, repas, autonomie, vie familiale et scolaire, sensoriel…",
        long: true,
      },
      {
        id: "comportement",
        title: "Comportement durant le bilan",
        hint: "Contact, coopération, attention, fatigabilité, réaction au chronomètre…",
        long: true,
      },
    ],
  },
  {
    group: "Domaines psychomoteurs",
    sections: [
      {
        id: "motricite_globale",
        title: "Motricité globale",
        hint: "Coordinations MS/MI (pantin, espaliers), coordinations oculo-manuelles, équilibres (M-ABC, NP-MOT)…",
        long: true,
      },
      {
        id: "motricite_fine",
        title: "Motricité fine et praxies manuelles",
        hint: "Dextérité (M-ABC), prono-supination (NP-MOT), EMG, praxies…",
        long: true,
      },
      {
        id: "graphisme",
        title: "Graphisme et écriture",
        hint: "Pré-scripturaux, tenue du stylo, fluidité, BHK (qualité, vitesse)…",
        long: true,
      },
      {
        id: "schema_corporel",
        title: "Schéma corporel",
        hint: "Somatognosies (Bergès-Lézine), dessin du bonhomme…",
        long: true,
      },
      {
        id: "tonus",
        title: "Tonus",
        hint: "Tonus de fond, de soutien, d'attitude, d'action ; syncinésies (NP-MOT)…",
        long: true,
      },
      {
        id: "lateralite",
        title: "Latéralité",
        hint: "Manuelle (spontanée, usuelle, psycho-sociale, graphique), pédestre (NP-MOT)…",
        long: true,
      },
      {
        id: "espace",
        title: "Organisation spatiale",
        hint: "Droite/gauche sur soi et autrui, orientation, figure de Rey…",
        long: true,
      },
      {
        id: "temps",
        title: "Organisation temporelle et rythme",
        hint: "Tempo spontané, adaptation aux rythmes frappés/marchés, repères temporels (NP-MOT)…",
        long: true,
      },
      {
        id: "attention",
        title: "Attention et mémoire",
        hint: "Attention soutenue (frappes 1-2), mémoire immédiate et différée…",
        long: true,
      },
      {
        id: "affectif",
        title: "Émotions et aspects psycho-affectifs",
        hint: "Reconnaissance et régulation émotionnelle, ressentis corporels, confiance en soi…",
        long: true,
      },
    ],
  },
  {
    group: "Synthèse",
    sections: [
      {
        id: "resultats",
        title: "Résultats chiffrés des tests",
        hint: "Synthèse des scores (DS, notes standards) et interprétation…",
        long: true,
      },
      {
        id: "conclusion",
        title: "Conclusion",
        hint: "Profil psychomoteur par domaine (points d'appui / fragilités), synthèse…",
        long: true,
      },
      {
        id: "projet",
        title: "Projet, adaptations et préconisations",
        hint: "Indication de suivi, objectifs, adaptations scolaires et quotidiennes, préconisations…",
        long: true,
      },
    ],
  },
];

export const BILAN_SECTIONS = BILAN_TEMPLATE.flatMap((g) => g.sections);
