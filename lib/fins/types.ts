/**
 * L'ÉCRIT DE FIN DE PRISE EN SOIN.
 *
 * Ce qui se dit quand un suivi s'achève : ce qui a été fait, où en sont les
 * objectifs, ce qui met fin, ce qui reste ouvert, et comment reprendre.
 *
 * CE QUI LE DISTINGUE D'UNE SYNTHÈSE DE SUIVI : l'unité couverte n'est pas une
 * période choisie, c'est un ÉPISODE. `period_start` et `period_end` sont
 * saisis ; `started_on` et `ended_on` sont des faits du parcours. Et l'acte de
 * parole est inverse : une synthèse propose une suite AVEC elle, un écrit de
 * fin dit ce qui reste ouvert et comment reprendre ailleurs.
 */

export type FinStatus = "brouillon" | "emis" | "annule";

export const FIN_STATUS_LABELS: Record<FinStatus, string> = {
  brouillon: "Brouillon",
  emis: "Remis",
  annule: "Annulé",
};

/**
 * Les quatre natures de fin, et ce qu'elles refusent de dire.
 *
 * AUCUNE LISTE DE MOTIFS ne viendra s'y ajouter. « Abandon »,
 * « non-adhésion », « défaut d'assiduité » : c'est là que le jugement
 * s'industrialise, parce qu'on finit par choisir la case la moins fausse et
 * que le mot part chez le médecin.
 *
 * `sans_nouvelle` existe précisément pour ne PAS ranger sous
 * `arret_a_la_demande` ce qui n'a peut-être été décidé par personne : un
 * déménagement, une hospitalisation, un oubli.
 *
 * [VALIDATION HUMAINE] Une cinquième nature — « fin à l'initiative de la
 * praticienne » — n'a pas été ajoutée en prévision. Seule une praticienne sait
 * si le cas se présente et comment il doit se dire.
 */
export type FinNature =
  | "fin_convenue"
  | "arret_a_la_demande"
  | "sans_nouvelle"
  | "relais";

export const FIN_NATURE_LABELS: Record<FinNature, string> = {
  fin_convenue: "Fin convenue",
  arret_a_la_demande: "Arrêt demandé par la personne ou sa famille",
  sans_nouvelle: "Interrompue, sans nouvelle",
  relais: "Relais par un autre professionnel",
};

/** L'aide qui accompagne chaque nature, à l'écran seulement. */
export const FIN_NATURE_AIDES: Record<FinNature, string> = {
  fin_convenue:
    "La fin a été convenue. Ce n'est pas « objectifs atteints » : le logiciel ne qualifie pas l'atteinte.",
  arret_a_la_demande:
    "Un fait, sans « malgré » et sans « prématuré ». Ce qui a été dit, c'est vous qui l'écrivez.",
  sans_nouvelle:
    "À préférer dès qu'aucune décision n'a été exprimée. « À la demande » prêterait une intention à quelqu'un qui a peut-être déménagé ou été hospitalisé.",
  relais:
    "La suite est assurée ailleurs. Le destinataire est alors le professionnel qui prend le relais.",
};

export type ModeRemise = "destinataire" | "personne_suivie" | "au_dossier";

export const MODE_REMISE_LABELS: Record<ModeRemise, string> = {
  destinataire: "À un destinataire nommé",
  personne_suivie: "À la personne suivie ou à son entourage",
  au_dossier: "Versé au dossier, non remis",
};

export interface ObjectifFige {
  intitule?: string | null;
  statut?: string | null;
  pose_le?: string | null;
  revu_le?: string | null;
  note_de_reevaluation?: string | null;
}

/**
 * Les faits de l'épisode.
 *
 * Les quatre derniers champs ne s'impriment JAMAIS : trois avertissements
 * destinés à elle avant de remettre, et deux paroles proposées à la reprise —
 * celle du demandeur et celle que le logiciel a parfois écrite lui-même en
 * archivant un dossier. Ils sont retirés de l'instantané à la remise.
 */
export interface FaitsEpisode {
  parcours: {
    ouvert_le?: string | null;
    clos_le?: string | null;
    statut?: string | null;
  };
  seances_honorees: number;
  derniere_seance_le: string | null;
  absences: number;
  annulees_par_le_cabinet: number;
  financement: string | null;
  prescripteur: {
    nom?: string | null;
    profession?: string | null;
    prescrit_le?: string | null;
  } | null;
  objectifs: ObjectifFige[];

  // Écran seulement.
  honorees_sans_parcours: number;
  rendez_vous_a_venir: number;
  objectifs_en_cours: number;
  motif_demande_a_reprendre: string | null;
  fin_du_parcours_a_reprendre: string | null;
}

export interface InstantaneFin {
  emis_le?: string | null;
  nature?: FinNature | null;
  remise?: ModeRemise | null;
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
    role_au_dossier?: string | null;
  } | null;
  consentement_partage?: "accorde" | "retire" | "absent" | null;
  mentions?: {
    comptes?: string | null;
    nature?: string | null;
    remise?: string | null;
  } | null;
  faits?: Partial<
    Omit<
      FaitsEpisode,
      | "honorees_sans_parcours"
      | "rendez_vous_a_venir"
      | "objectifs_en_cours"
      | "motif_demande_a_reprendre"
      | "fin_du_parcours_a_reprendre"
    >
  > | null;
}

export interface Fin {
  id: string;
  practice_id: string;
  patient_id: string;
  pathway_id: string;
  closure_kind: FinNature;
  delivery_mode: ModeRemise;
  recipient_contact_id: string | null;
  context: string | null;
  means: string | null;
  observed: string | null;
  closure_reason: string | null;
  remains_open: string | null;
  handover: string | null;
  resumption: string | null;
  detail_objectifs: boolean;
  detail_absences: boolean;
  detail_financement: boolean;
  status: FinStatus;
  issued_on: string | null;
  note: string | null;
  internal_note: string | null;
  cancellation_reason: string | null;
  snapshot: InstantaneFin | null;
  created_at: string;
  updated_at: string;
}

/** Un écrit remis ne se modifie plus : il s'annule et se réécrit. */
export function finModifiable(f: Pick<Fin, "status">): boolean {
  return f.status === "brouillon";
}

/**
 * Les statuts d'objectif, tels qu'ils s'impriment.
 *
 * Même table que pour la synthèse de suivi, et pour la même raison : le statut
 * est un mot du LOGICIEL, et « Abandonné » imprimé à côté d'un objectif dans un
 * document que liront une famille ou un financeur se lit comme un constat sur
 * une personne.
 *
 * Le cas MORD davantage ici : sur un parcours clos, un objectif resté « en
 * cours » s'imprime « en cours » sous un document qui annonce que la prise en
 * soin est terminée. L'écran avertit avant la remise ; il ne requalifie rien.
 */
export const OBJECTIF_STATUS_IMPRIME: Record<string, string> = {
  en_cours: "En cours",
  atteint: "Atteint",
  partiellement_atteint: "Partiellement atteint",
  abandonne: "Non poursuivi",
  reformule: "Reformulé",
};

export const FINANCEMENT_LABELS: Record<string, string> = {
  liberal: "Libéral",
  pco: "Parcours de bilan et intervention précoce",
  mdph: "Dispositif MDPH",
  etablissement: "Établissement",
  autre: "Autre dispositif",
};
