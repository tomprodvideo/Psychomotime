import { createClient } from "@/lib/supabase/server";
import type {
  Appointment,
  AppointmentWithPatient,
  BandSetRow,
  CareObjective,
  CarePathway,
  Contact,
  Patient,
  PatientConsent,
  PatientContactWithContact,
  Instrument,
  InstrumentScale,
  PatientNote,
  PracticeContext,
  Vocabulary,
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

/* ==========================================================================
 *  Agenda et séances
 * ========================================================================== */

/** Colonnes d'une ligne d'agenda, plus le strict nécessaire du patient. */
const COLONNES_RDV =
  "id, practice_id, patient_id, pathway_id, practitioner_member_id, location_id, " +
  "kind, starts_at, ends_at, attendance, attendance_note, billable, title, note";

const COLONNES_RDV_PATIENT =
  COLONNES_RDV +
  ", patient:patients(id, first_name, last_name, preferred_name)";

/**
 * Rendez-vous d'une période.
 *
 * Les bornes sont données par l'appelant, jamais déduites d'une horloge cachée :
 * l'agenda affiche la journée qu'on lui demande, et le même appel rend toujours
 * le même résultat.
 */
export async function listAppointments(
  practice: PracticeContext,
  from: Date,
  to: Date,
): Promise<AppointmentWithPatient[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select(COLONNES_RDV_PATIENT)
    .eq("practice_id", practice.practiceId)
    .gte("starts_at", from.toISOString())
    .lt("starts_at", to.toISOString())
    .order("starts_at", { ascending: true });

  if (error) {
    console.error("[agenda] lecture des rendez-vous refusée :", error);
    return [];
  }
  return (data ?? []) as unknown as AppointmentWithPatient[];
}

/**
 * Rendez-vous passés dont l'issue n'a pas été constatée.
 *
 * C'est la première chose qu'un tableau de bord doit montrer : tant qu'un
 * créneau n'est pas qualifié, il ne compte ni comme séance réalisée, ni comme
 * absence, et il ne peut nourrir aucune attestation.
 */
export async function listAppointmentsToQualify(
  practice: PracticeContext,
  now: Date,
  limit = 20,
): Promise<AppointmentWithPatient[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select(COLONNES_RDV_PATIENT)
    .eq("practice_id", practice.practiceId)
    .eq("attendance", "a_venir")
    .lt("starts_at", now.toISOString())
    .order("starts_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[agenda] lecture des rendez-vous à qualifier refusée :", error);
    return [];
  }
  return (data ?? []) as unknown as AppointmentWithPatient[];
}

/** Historique des rendez-vous d'un patient, le plus récent d'abord. */
export async function listPatientAppointments(
  practice: PracticeContext,
  patientId: string,
  limit = 50,
): Promise<Appointment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select(COLONNES_RDV)
    .eq("practice_id", practice.practiceId)
    .eq("patient_id", patientId)
    .order("starts_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[agenda] lecture de l'historique refusée :", error);
    return [];
  }
  return (data ?? []) as unknown as Appointment[];
}

export interface SessionCount {
  realisees: number;
  aVenir: number;
  absences: number;
  aQualifier: number;
}

/**
 * Compte des séances d'un patient, par issue.
 *
 * Répond à la question que le produit ne savait pas traiter : « combien de
 * séances cet enfant a-t-il eues ? ». Le compte des séances RÉALISÉES passe
 * par la vue dédiée, qui est la seule source admissible.
 */
export async function countPatientSessions(
  practice: PracticeContext,
  patientId: string,
  now: Date,
): Promise<SessionCount> {
  const supabase = await createClient();

  // `head: true` : on ne rapatrie aucune ligne, seulement le compte. Une liste
  // qui n'affiche qu'un nombre n'a pas à charger ce qu'elle ne montre pas.
  const base = () =>
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("practice_id", practice.practiceId)
      .eq("patient_id", patientId);

  const [realisees, aVenir, absences, aQualifier] = await Promise.all([
    supabase
      .from("realised_sessions")
      .select("appointment_id", { count: "exact", head: true })
      .eq("practice_id", practice.practiceId)
      .eq("patient_id", patientId)
      .then((r) => r.count ?? 0),
    base()
      .eq("attendance", "a_venir")
      .gte("starts_at", now.toISOString())
      .then((r) => r.count ?? 0),
    base()
      .in("attendance", ["absent_excuse", "absent_non_excuse"])
      .then((r) => r.count ?? 0),
    base()
      .eq("attendance", "a_venir")
      .lt("starts_at", now.toISOString())
      .then((r) => r.count ?? 0),
  ]);

  return { realisees, aVenir, absences, aQualifier };
}

/* ==========================================================================
 *  Registre d'instruments — lectures
 * ========================================================================== */

export async function listInstruments(
  practice: PracticeContext,
): Promise<Instrument[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("instruments")
    .select("*")
    .eq("practice_id", practice.practiceId)
    .order("name", { ascending: true });

  if (error) {
    console.error("[instruments] lecture refusée :", error);
    return [];
  }
  return (data ?? []) as Instrument[];
}

export async function getInstrument(
  practice: PracticeContext,
  id: string,
): Promise<Instrument | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("instruments")
    .select("*")
    .eq("id", id)
    .eq("practice_id", practice.practiceId)
    .maybeSingle();

  if (error) {
    console.error("[instruments] lecture refusée :", error);
    return null;
  }
  return (data as Instrument) ?? null;
}

export async function listScales(
  practice: PracticeContext,
  instrumentId: string,
): Promise<InstrumentScale[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("instrument_scales")
    .select("*")
    .eq("instrument_id", instrumentId)
    .eq("practice_id", practice.practiceId)
    .order("name", { ascending: true });

  if (error) {
    console.error("[instruments] lecture des échelles refusée :", error);
    return [];
  }
  return (data ?? []) as InstrumentScale[];
}

/** Découpages d'une échelle, bandes comprises, le plus récent d'abord. */
export async function listBandSets(
  practice: PracticeContext,
  scaleId: string,
): Promise<BandSetRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scale_band_sets")
    .select("*, bands:scale_bands(*)")
    .eq("scale_id", scaleId)
    .eq("practice_id", practice.practiceId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[instruments] lecture des découpages refusée :", error);
    return [];
  }
  return ((data ?? []) as unknown as BandSetRow[]).map((s) => ({
    ...s,
    bands: [...(s.bands ?? [])].sort((a, b) => a.position - b.position),
  }));
}

export async function listVocabularies(
  practice: PracticeContext,
): Promise<Vocabulary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("band_vocabularies")
    .select("*, labels:band_vocabulary_labels(key, text)")
    .eq("practice_id", practice.practiceId)
    .order("name", { ascending: true });

  if (error) {
    console.error("[instruments] lecture des vocabulaires refusée :", error);
    return [];
  }
  return ((data ?? []) as unknown as Vocabulary[]).map((v) => ({
    ...v,
    labels: [...(v.labels ?? [])].sort((a, b) => a.key.localeCompare(b.key)),
  }));
}

/** Problèmes empêchant un découpage de devenir actif. Vide = exploitable. */
export async function validateBandSet(bandSetId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("validate_band_set", {
    p_band_set_id: bandSetId,
  });

  if (error) {
    console.error("[instruments] validation refusée :", error);
    return ["Le découpage n'a pas pu être vérifié."];
  }
  return ((data ?? []) as { probleme: string }[]).map((r) => r.probleme);
}

/* ==========================================================================
 *  Tableau de bord
 * ========================================================================== */

export interface JourneeResume {
  /** Rendez-vous du jour demandé, dans l'ordre. */
  aujourdhui: AppointmentWithPatient[];
  /** Créneaux passés dont l'issue n'a pas été constatée. */
  aQualifier: AppointmentWithPatient[];
  /** Rendez-vous à venir sur les sept jours suivants. */
  semaineCount: number;
  /** Parcours en liste d'attente, le plus ancien d'abord. */
  attente: {
    id: string;
    patient_id: string;
    label: string | null;
    waitlisted_on: string | null;
    waitlist_priority: string | null;
    patient: { id: string; first_name: string; last_name: string; preferred_name: string | null } | null;
  }[];
  /** Parcours actifs, tous patients confondus. */
  parcoursActifs: number;
  /** Dossiers actifs. */
  patientsActifs: number;
}

/**
 * Tout ce qu'il faut pour la page d'accueil, en une passe.
 *
 * `maintenant` est un paramètre : la page choisit son instant une fois, et
 * toutes les bornes en découlent. Aucune lecture d'horloge n'est cachée ici.
 */
export async function getJourneeResume(
  practice: PracticeContext,
  maintenant: Date,
): Promise<JourneeResume> {
  const supabase = await createClient();

  const debutJour = new Date(maintenant);
  debutJour.setHours(0, 0, 0, 0);
  const finJour = new Date(debutJour);
  finJour.setDate(finJour.getDate() + 1);
  const finSemaine = new Date(debutJour);
  finSemaine.setDate(finSemaine.getDate() + 7);

  const [aujourdhui, aQualifier, semaine, attente, parcoursActifs, patientsActifs] =
    await Promise.all([
      listAppointments(practice, debutJour, finJour),
      listAppointmentsToQualify(practice, maintenant, 10),
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("practice_id", practice.practiceId)
        .gte("starts_at", finJour.toISOString())
        .lt("starts_at", finSemaine.toISOString())
        .then((r) => r.count ?? 0),
      supabase
        .from("care_pathways")
        .select(
          "id, patient_id, label, waitlisted_on, waitlist_priority, " +
            "patient:patients(id, first_name, last_name, preferred_name)",
        )
        .eq("practice_id", practice.practiceId)
        .eq("status", "liste_attente")
        .order("waitlisted_on", { ascending: true, nullsFirst: false })
        .limit(8)
        .then((r) => {
          if (r.error) {
            console.error("[accueil] liste d'attente refusée :", r.error);
            return [];
          }
          return (r.data ?? []) as unknown as JourneeResume["attente"];
        }),
      supabase
        .from("care_pathways")
        .select("id", { count: "exact", head: true })
        .eq("practice_id", practice.practiceId)
        .eq("status", "actif")
        .then((r) => r.count ?? 0),
      supabase
        .from("patients")
        .select("id", { count: "exact", head: true })
        .eq("practice_id", practice.practiceId)
        .eq("status", "actif")
        .then((r) => r.count ?? 0),
    ]);

  return {
    aujourdhui,
    aQualifier,
    semaineCount: semaine,
    attente,
    parcoursActifs,
    patientsActifs,
  };
}

/* ==========================================================================
 *  Pièces rattachées à un dossier
 * ========================================================================== */

export interface PieceBilan {
  id: string;
  title: string;
  bilan_date: string | null;
  status: string;
  type: "psychomoteur" | "sensoriel";
}

export interface PieceFacture {
  id: string;
  kind: string;
  status: string;
  number: string | null;
  issued_on: string | null;
  total_cents: number;
  /** Somme imputée sur la pièce, en centimes. */
  encaisse_cents: number;
}

/**
 * Bilans et factures d'un patient.
 *
 * Ces deux tables vivent encore sur le modèle v1 : leur isolation repose sur
 * `user_id`, pas sur l'appartenance au cabinet. Le filtre par patient suffit
 * donc ici, la RLS faisant le reste — mais c'est une dépendance à retirer avec
 * la reprise de la comptabilité et du moteur de bilans.
 *
 * On ne lit QUE les colonnes affichées : le jsonb `content` d'un bilan porte
 * des images encodées, et les charger pour n'afficher qu'un titre était l'un
 * des défauts relevés.
 */
export async function listPatientPieces(
  patientId: string,
): Promise<{ bilans: PieceBilan[]; factures: PieceFacture[] }> {
  const supabase = await createClient();

  const [bilansRes, facturesRes] = await Promise.all([
    supabase
      .from("bilans")
      .select("id, title, bilan_date, status, content")
      .eq("patient_id", patientId)
      .order("bilan_date", { ascending: false, nullsFirst: false })
      .limit(30),
    supabase
      .from("billing_documents")
      .select(
        "id, kind, status, number, issued_on, total_cents, " +
          "payment_allocations(amount_cents)",
      )
      .eq("patient_id", patientId)
      .order("issued_on", { ascending: false, nullsFirst: true })
      .limit(30),
  ]);

  if (bilansRes.error) {
    console.error("[dossier] lecture des bilans refusée :", bilansRes.error);
  }
  if (facturesRes.error) {
    console.error("[dossier] lecture des pièces refusée :", facturesRes.error);
  }

  const bilans = ((bilansRes.data ?? []) as {
    id: string;
    title: string;
    bilan_date: string | null;
    status: string;
    content: Record<string, unknown> | null;
  }[]).map((b) => ({
    id: b.id,
    title: b.title,
    bilan_date: b.bilan_date,
    status: b.status,
    // Le type vit encore dans le contenu, ce qui est précisément le défaut que
    // le moteur de bilans corrigera par une colonne explicite.
    type:
      b.content?.["__type__"] === "sensoriel"
        ? ("sensoriel" as const)
        : ("psychomoteur" as const),
  }));

  const factures = ((facturesRes.data ?? []) as unknown as {
    id: string;
    kind: string;
    status: string;
    number: string | null;
    issued_on: string | null;
    total_cents: number;
    payment_allocations: { amount_cents: number }[];
  }[]).map((f) => ({
    id: f.id,
    kind: f.kind,
    status: f.status,
    number: f.number,
    issued_on: f.issued_on,
    total_cents: f.total_cents,
    encaisse_cents: f.payment_allocations.reduce((s, a) => s + a.amount_cents, 0),
  }));

  return { bilans, factures };
}
