/**
 * LA SYNTHÈSE DE SUIVI.
 *
 * Une à deux fois par an et par patient suivi : ce qui a été fait sur une
 * période, où en sont les objectifs, ce qu'on observe, ce qu'on ajuste.
 *
 * C'EST LE PREMIER DOCUMENT DU PRODUIT DONT UNE PARTIE EST PRÉ-REMPLIE, et
 * toute la conception tient sur cette ligne :
 *
 *  · un FAIT est recopié — le nombre de séances honorées, la date d'ouverture
 *    du parcours, les objectifs et leur statut tels qu'elle les a posés ;
 *  · une INTERPRÉTATION n'est jamais produite — aucune phrase d'évolution,
 *    aucun « progrès », aucun écart calculé, aucun objectif requalifié.
 *
 * Ce que la période signifie, c'est elle qui l'écrit. Et tant qu'elle ne l'a
 * pas écrit, la base refuse de remettre le document.
 */

export type SyntheseStatus = "brouillon" | "emis" | "annule";

export const SYNTHESE_STATUS_LABELS: Record<SyntheseStatus, string> = {
  brouillon: "Brouillon",
  emis: "Remise",
  annule: "Annulée",
};

/** Le statut d'un objectif, tel qu'elle l'a posé. Le logiciel ne le change pas. */
export const OBJECTIF_STATUS_LABELS: Record<string, string> = {
  en_cours: "En cours",
  atteint: "Atteint",
  partiellement_atteint: "Partiellement atteint",
  abandonne: "Abandonné",
  reformule: "Reformulé",
};

/**
 * LES MÊMES STATUTS, TELS QU'ILS S'IMPRIMENT.
 *
 * Le statut est un mot du LOGICIEL : une valeur d'énumération choisie à la
 * conception, pas une phrase qu'elle a écrite. « Abandonné », imprimé à côté
 * d'un objectif dans un document que liront une famille ou un financeur, se
 * lit comme un constat professionnel sur une personne. « Non poursuivi » dit
 * le même fait sans le juger.
 *
 * [VALIDATION HUMAINE — V2] Le vocabulaire imprimé revient à la
 * psychomotricienne. Cette table existe pour qu'il puisse changer sans
 * toucher aux données déjà enregistrées.
 */
export const OBJECTIF_STATUS_IMPRIME: Record<string, string> = {
  en_cours: "En cours",
  atteint: "Atteint",
  partiellement_atteint: "Partiellement atteint",
  abandonne: "Non poursuivi",
  reformule: "Reformulé",
};

export interface ObjectifFige {
  intitule?: string | null;
  statut?: string | null;
  pose_le?: string | null;
  revu_le?: string | null;
  /* Ses mots à elle, à côté du mot du logiciel. */
  note_de_reevaluation?: string | null;
}

/**
 * Les faits de la période.
 *
 * Le même objet est rendu par `public.follow_up_facts` à l'écran AVANT la
 * remise, et figé dans l'instantané PAR la remise. Une seule source : ce qui
 * s'imprime est exactement ce qu'elle a vu.
 */
export interface FaitsPeriode {
  seances_honorees: number;
  absences: number;
  /* Les deux côtés, pas un seul : un chiffre à sens unique est celui qu'un
   * financeur retient. */
  annulees_par_le_cabinet: number;
  /* AVERTISSEMENT D'ÉCRAN, jamais imprimé : les séances honorées de la période
   * qui ne portent aucun parcours. Sans lui, un parcours mal renseigné affiche
   * zéro séance sans rien dire — et un zéro se lit « aucune séance ». */
  honorees_sans_parcours: number;
  parcours_ouvert_le: string | null;
  objectifs: ObjectifFige[];
}

export interface InstantaneSynthese {
  emis_le?: string | null;
  periode?: { du?: string | null; au?: string | null } | null;
  cabinet?: { nom?: string | null } | null;
  entite_juridique?: {
    denomination?: string | null;
    forme?: string | null;
    adresse?: string | null;
    code_postal?: string | null;
    ville?: string | null;
  } | null;
  praticien?: { nom?: string | null; titre?: string | null } | null;
  identifiants?: { type?: string; valeur?: string }[] | null;
  patient?: { nom?: string | null; ne_le?: string | null } | null;
  destinataire?: {
    nom?: string | null;
    profession?: string | null;
    adresse?: string | null;
    code_postal?: string | null;
    ville?: string | null;
    /** Ce qu'il est POUR CE DOSSIER. « aucun » est une réponse, pas un vide. */
    role_au_dossier?: string | null;
  } | null;
  /* `honorees_sans_parcours` n'y est jamais — c'est un avertissement d'écran.
   * `absences`, `annulees_par_le_cabinet` et `objectifs` n'y sont que si elle
   * a choisi de les dire : un document ne conserve pas ce qu'il n'a pas dit. */
  faits?: Partial<Omit<FaitsPeriode, "honorees_sans_parcours">> | null;
  /** À qui elle a été remise, écrit en toutes lettres. */
  remise?: "a_la_personne_suivie" | "au_destinataire" | null;
  /** Ce que le dossier disait de l'accord de partage, le jour de la remise. */
  consentement_partage?: "accorde" | "retire" | "absent" | null;
  /** Les mentions qui encadrent la lecture, figées avec le document. */
  mentions?: { comptes?: string | null } | null;
}

export interface Synthese {
  id: string;
  practice_id: string;
  patient_id: string;
  pathway_id: string | null;
  recipient_contact_id: string | null;
  recipient_is_patient: boolean;
  period_start: string;
  period_end: string;
  means: string | null;
  observed_evolution: string | null;
  adjustments: string | null;
  next_step: string | null;
  detail_objectifs: boolean;
  detail_absences: boolean;
  status: SyntheseStatus;
  issued_on: string | null;
  note: string | null;
  internal_note: string | null;
  cancellation_reason: string | null;
  snapshot: InstantaneSynthese | null;
  created_at: string;
  updated_at: string;
}

/** Une synthèse remise ne se modifie plus : elle s'annule et se réécrit. */
export function syntheseModifiable(s: Pick<Synthese, "status">): boolean {
  return s.status === "brouillon";
}

/**
 * Une période par défaut : les six mois qui précèdent, bornés à aujourd'hui.
 *
 * SIX MOIS EST UNE COMMODITÉ DE SAISIE, PAS UNE RÈGLE. La périodicité d'un
 * compte rendu dépend du contrat signé — parcours financé, convention avec une
 * structure — et se lit dans ce contrat. Le produit n'en impose aucune et ce
 * défaut se corrige d'un clic. [VALIDATION HUMAINE]
 */
export function periodeParDefaut(aujourdhui = new Date()): {
  du: string;
  au: string;
} {
  const au = new Date(aujourdhui);
  const du = new Date(aujourdhui);
  du.setMonth(du.getMonth() - 6);
  return { du: isoJour(du), au: isoJour(au) };
}

/**
 * Les synthèses DÉJÀ REMISES dont la période recouvre celle-ci.
 *
 * Deux synthèses qui se chevauchent recomptent les mêmes séances. Ce n'est pas
 * une faute — une synthèse de fin d'année peut légitimement reprendre un
 * semestre déjà couvert — mais c'est une chose à savoir AVANT de remettre, pas
 * à découvrir quand le destinataire le fait remarquer.
 *
 * Les brouillons ne comptent pas : rien n'est parti.
 */
export function chevauchements<
  T extends Pick<Synthese, "id" | "status" | "period_start" | "period_end">,
>(existantes: T[], du: string, au: string, saufId?: string | null): T[] {
  if (!du || !au) return [];
  return existantes.filter(
    (s) =>
      s.id !== saufId &&
      s.status !== "brouillon" &&
      // Deux intervalles se recouvrent si chacun commence avant que l'autre
      // ne finisse. Bornes incluses des deux côtés, comme en base.
      s.period_start <= au &&
      du <= s.period_end,
  );
}

function isoJour(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const j = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${j}`;
}

/**
 * La phrase qui encadre le compte de séances.
 *
 * « 4 séances honorées » lu par un financeur devient vite une mesure
 * d'assiduité, donc un jugement sur une famille. Le document dit ce que le
 * chiffre est — un relevé des séances qui ont eu lieu — et se tait sur ce
 * qu'il vaudrait. Il renvoie à l'attestation de présence, qui porte le détail
 * des dates et se vérifie ligne à ligne : un renvoi vaut mieux qu'une
 * dénégation.
 *
 * ELLE EXISTE EN DEUX EXEMPLAIRES, ET C'EST VOULU. Celui-ci sert d'aperçu
 * AVANT la remise, quand il n'y a pas encore d'instantané à lire. La version
 * qui fait foi est figée en base par `issue_follow_up_summary` : une phrase
 * qui encadre une lecture doit se relire dans trois ans telle qu'elle a été
 * remise, et la laisser dans le code la ferait changer sous les documents
 * déjà partis. Un contrôle unitaire compare les deux copies.
 *
 * [VALIDATION HUMAINE — V4] Sa formulation revient à la psychomotricienne.
 */
export const MENTION_COMPTE_SEANCES =
  "Ces nombres relèvent les séances inscrites à l'agenda du cabinet sur la période. " +
  "Ils ne constituent ni une évaluation de l'assiduité ni une appréciation de l'engagement " +
  "de la personne ou de sa famille. Une attestation de présence, portant le détail des dates, " +
  "peut être établie sur demande.";
