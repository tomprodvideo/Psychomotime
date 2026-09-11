import { createClient } from "@/lib/supabase/server";
import type {
  CareObjective,
  CarePathway,
  Contact,
  Patient,
  PatientConsent,
  PatientContactWithContact,
  PatientNote,
  PracticeContext,
} from "./types";

/**
 * Lectures du dossier patient.
 *
 * DEUX RÈGLES TENUES ICI, et elles ne sont pas cosmétiques.
 *
 * 1. **Projection minimale.** Une liste ne charge que ce qu'elle affiche.
 *    L'ancienne version faisait `select("*")` partout — y compris sur des
 *    bilans dont le JSON portait des images encodées en base64 — pour n'en
 *    montrer qu'un titre et une date.
 *
 * 2. **Pagination systématique.** Aucune liste ne charge l'intégralité d'une
 *    table. Un cabinet qui grossit ne doit pas ralentir à chaque écran.
 */

/** Colonnes strictement nécessaires à une ligne de liste. */
const COLONNES_LISTE =
  "id, first_name, last_name, preferred_name, birth_date, status, archived_at, updated_at";

export type PatientListItem = Pick<
  Patient,
  | "id"
  | "first_name"
  | "last_name"
  | "preferred_name"
  | "birth_date"
  | "status"
  | "archived_at"
  | "updated_at"
>;

export interface PatientListPage {
  items: PatientListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface PatientListOptions {
  /** Recherche sur le nom, le prénom ou le nom d'usage. */
  search?: string;
  /** `actif` par défaut : un dossier archivé ne parasite pas le travail du jour. */
  status?: "actif" | "archive" | "tous";
  page?: number;
  pageSize?: number;
}

/**
 * Échappe les caractères que PostgREST interprète dans un filtre `or`.
 *
 * Une virgule non échappée dans une recherche découperait le filtre et
 * changerait la requête — ce n'est pas une injection SQL, PostgREST paramètre,
 * mais c'est un résultat faux, et c'est tout aussi gênant.
 */
function motifRecherche(terme: string): string {
  return terme.replace(/[,()\\]/g, " ").replace(/\s+/g, " ").trim();
}

export async function listPatients(
  practice: PracticeContext,
  options: PatientListOptions = {},
): Promise<PatientListPage> {
  const supabase = await createClient();
  const pageSize = Math.min(Math.max(options.pageSize ?? 25, 1), 100);
  const page = Math.max(options.page ?? 1, 1);
  const from = (page - 1) * pageSize;

  let requete = supabase
    .from("patients")
    .select(COLONNES_LISTE, { count: "exact" })
    .eq("practice_id", practice.practiceId);

  const statut = options.status ?? "actif";
  if (statut !== "tous") requete = requete.eq("status", statut);

  const terme = motifRecherche(options.search ?? "");
  if (terme) {
    const motif = `%${terme}%`;
    requete = requete.or(
      `last_name.ilike.${motif},first_name.ilike.${motif},preferred_name.ilike.${motif}`,
    );
  }

  const { data, error, count } = await requete
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true })
    .range(from, from + pageSize - 1);

  if (error) {
    console.error("[dossier] liste des patients refusée :", error);
    return { items: [], total: 0, page, pageSize, pageCount: 0 };
  }

  const total = count ?? 0;
  return {
    items: (data ?? []) as PatientListItem[],
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/**
 * Dossiers susceptibles d'être des doublons du patient donné.
 *
 * Même nom de famille et même date de naissance dans le même cabinet. Le
 * logiciel SIGNALE ; il ne fusionne rien et ne bloque aucune création : deux
 * homonymes nés le même jour existent.
 */
export async function findPossibleDuplicates(
  practice: PracticeContext,
  patient: Pick<Patient, "id" | "last_name" | "birth_date">,
): Promise<PatientListItem[]> {
  if (!patient.birth_date || !patient.last_name?.trim()) return [];
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("patients")
    .select(COLONNES_LISTE)
    .eq("practice_id", practice.practiceId)
    .eq("birth_date", patient.birth_date)
    .ilike("last_name", patient.last_name.trim())
    .neq("id", patient.id)
    .limit(5);

  if (error) {
    console.error("[dossier] recherche de doublons refusée :", error);
    return [];
  }
  return (data ?? []) as PatientListItem[];
}

export async function getPatient(
  practice: PracticeContext,
  id: string,
): Promise<Patient | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .eq("id", id)
    .eq("practice_id", practice.practiceId)
    .maybeSingle();

  if (error) {
    console.error("[dossier] lecture du patient refusée :", error);
    return null;
  }
  return (data as Patient) ?? null;
}

/**
 * Entourage d'un patient : les liens, joints aux personnes qu'ils désignent.
 *
 * Les liens CLOS sont rendus eux aussi — c'est la trace de qui a été
 * légitimement destinataire, et elle a de la valeur. C'est à l'affichage de les
 * séparer, pas à la requête de les taire.
 */
export async function listPatientContacts(
  practice: PracticeContext,
  patientId: string,
): Promise<PatientContactWithContact[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patient_contacts")
    .select("*, contact:contacts(*)")
    .eq("patient_id", patientId)
    .eq("practice_id", practice.practiceId)
    .order("role", { ascending: true })
    .order("is_primary", { ascending: false });

  if (error) {
    console.error("[dossier] lecture de l'entourage refusée :", error);
    return [];
  }
  return (data ?? []) as unknown as PatientContactWithContact[];
}

export async function listPathways(
  practice: PracticeContext,
  patientId: string,
): Promise<CarePathway[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("care_pathways")
    .select("*")
    .eq("patient_id", patientId)
    .eq("practice_id", practice.practiceId)
    .order("started_on", { ascending: false, nullsFirst: true })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[dossier] lecture des parcours refusée :", error);
    return [];
  }
  return (data ?? []) as CarePathway[];
}

/**
 * Objectifs d'un ou plusieurs parcours.
 *
 * Réservé aux rôles cliniques : la base refuse déjà la lecture à un assistant,
 * mais autant ne pas lui faire faire une requête vouée à revenir vide.
 */
export async function listObjectives(
  practice: PracticeContext,
  pathwayIds: string[],
): Promise<CareObjective[]> {
  if (!practice.canReadClinical || pathwayIds.length === 0) return [];
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("care_objectives")
    .select("*")
    .in("pathway_id", pathwayIds)
    .eq("practice_id", practice.practiceId)
    .order("position", { ascending: true });

  if (error) {
    console.error("[dossier] lecture des objectifs refusée :", error);
    return [];
  }
  return (data ?? []) as CareObjective[];
}

export async function listNotes(
  practice: PracticeContext,
  patientId: string,
  limit = 20,
): Promise<PatientNote[]> {
  if (!practice.canReadClinical) return [];
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("patient_notes")
    .select("*")
    .eq("patient_id", patientId)
    .eq("practice_id", practice.practiceId)
    .order("written_on", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[dossier] lecture des notes refusée :", error);
    return [];
  }
  return (data ?? []) as PatientNote[];
}

export async function listConsents(
  practice: PracticeContext,
  patientId: string,
): Promise<PatientConsent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patient_consents")
    .select("*")
    .eq("patient_id", patientId)
    .eq("practice_id", practice.practiceId)
    .order("granted_on", { ascending: false, nullsFirst: false });

  if (error) {
    console.error("[dossier] lecture des consentements refusée :", error);
    return [];
  }
  return (data ?? []) as PatientConsent[];
}

/** Contacts du cabinet, pour alimenter un sélecteur. */
export async function listContacts(
  practice: PracticeContext,
  search = "",
): Promise<Contact[]> {
  const supabase = await createClient();
  let requete = supabase
    .from("contacts")
    .select("*")
    .eq("practice_id", practice.practiceId);

  const terme = motifRecherche(search);
  if (terme) {
    const motif = `%${terme}%`;
    requete = requete.or(
      `last_name.ilike.${motif},first_name.ilike.${motif},organisation_name.ilike.${motif}`,
    );
  }

  const { data, error } = await requete
    .order("last_name", { ascending: true, nullsFirst: false })
    .limit(50);

  if (error) {
    console.error("[dossier] liste des contacts refusée :", error);
    return [];
  }
  return (data ?? []) as Contact[];
}
