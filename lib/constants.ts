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
    group: "Contexte",
    sections: [
      {
        id: "motif",
        title: "Motif de la consultation / demande",
        hint: "Qui adresse l'enfant, pour quelle raison, plaintes principales…",
        long: true,
      },
      {
        id: "anamnese",
        title: "Anamnèse",
        hint: "Grossesse, naissance, développement psychomoteur, antécédents médicaux, contexte familial et scolaire…",
        long: true,
      },
      {
        id: "comportement",
        title: "Comportement durant le bilan",
        hint: "Attitude, contact, coopération, fatigabilité, gestion des consignes…",
        long: true,
      },
      {
        id: "tests",
        title: "Tests et outils utilisés",
        hint: "Tests étalonnés et observations cliniques (NP-MOT, M-ABC, BHK, Figure de Rey, Charlop-Atwell…)",
        long: true,
      },
    ],
  },
  {
    group: "Domaines psychomoteurs",
    sections: [
      {
        id: "tonus",
        title: "Tonus et régulation tonico-émotionnelle",
        hint: "Tonus de fond, tonus d'action, extensibilité, syncinésies, ballant…",
        long: true,
      },
      {
        id: "motricite_globale",
        title: "Motricité globale et coordinations dynamiques",
        hint: "Marche, course, sauts, équilibre statique et dynamique, coordinations générales…",
        long: true,
      },
      {
        id: "motricite_fine",
        title: "Motricité fine et coordinations manuelles",
        hint: "Préhension, dextérité, coordination œil-main, manipulation d'objets…",
        long: true,
      },
      {
        id: "lateralite",
        title: "Latéralité",
        hint: "Latéralité usuelle et spontanée (main, œil, pied), homogénéité…",
        long: true,
      },
      {
        id: "schema_corporel",
        title: "Schéma corporel et image du corps",
        hint: "Connaissance et représentation du corps, somatognosie, imitation de gestes…",
        long: true,
      },
      {
        id: "espace",
        title: "Organisation spatiale",
        hint: "Repères spatiaux, orientation, structuration de l'espace, notions topologiques…",
        long: true,
      },
      {
        id: "temps",
        title: "Organisation temporelle et rythme",
        hint: "Notions temporelles, reproduction et structuration rythmiques…",
        long: true,
      },
      {
        id: "graphisme",
        title: "Graphisme et écriture",
        hint: "Tenue du crayon, prégraphisme, qualité du tracé, vitesse, lisibilité…",
        long: true,
      },
      {
        id: "attention",
        title: "Attention et fonctions exécutives",
        hint: "Attention soutenue/sélective, inhibition, planification, mémoire de travail…",
        long: true,
      },
      {
        id: "affectif",
        title: "Aspects psycho-affectifs et relationnels",
        hint: "Estime de soi, gestion émotionnelle, relation à l'autre…",
        long: true,
      },
    ],
  },
  {
    group: "Synthèse",
    sections: [
      {
        id: "conclusion",
        title: "Conclusion / synthèse",
        hint: "Synthèse du profil psychomoteur, points d'appui et difficultés…",
        long: true,
      },
      {
        id: "projet",
        title: "Projet thérapeutique / préconisations",
        hint: "Indication ou non d'un suivi, objectifs, rythme, orientations complémentaires…",
        long: true,
      },
    ],
  },
];

export const BILAN_SECTIONS = BILAN_TEMPLATE.flatMap((g) => g.sections);
