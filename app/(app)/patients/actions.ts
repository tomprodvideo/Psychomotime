"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ecritureReussie, requireActiveAccess, type Guarded } from "@/lib/auth/guard";
import { getCurrentPractice } from "@/lib/dossier/practice";
import type { PatientContact } from "@/lib/types";
import type {
  ConsentKind,
  LegalBasis,
  PathwayStatus,
  PatientContactRole,
} from "@/lib/dossier/types";

/* ==========================================================================
 *  Lecture des champs de formulaire
 * ========================================================================== */

function str(fd: FormData, k: string): string | null {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
}

function bool(fd: FormData, k: string): boolean {
  return fd.get(k) === "on" || fd.get(k) === "true";
}

/** Date ISO, ou `null`. Une chaîne mal formée n'est PAS silencieusement ignorée. */
function date(fd: FormData, k: string): { ok: true; value: string | null } | { ok: false; error: string } {
  const v = str(fd, k);
  if (v === null) return { ok: true, value: null };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) {
    return { ok: false, error: `La date saisie dans « ${k} » n'est pas valide.` };
  }
  return { ok: true, value: v };
}

/**
 * Contexte d'écriture : session, abonnement actif, cabinet, droit d'écrire.
 * Toute action de ce fichier commence par là.
 */
async function contexteEcriture() {
  const acces = await requireActiveAccess();
  if (!acces.ok) return { ok: false as const, error: acces.error };

  const practice = await getCurrentPractice();
  if (!practice) {
    return {
      ok: false as const,
      error: "Aucun cabinet n'est rattaché à votre compte.",
    };
  }
  if (!practice.canWrite) {
    return {
      ok: false as const,
      error: "Votre rôle ne permet pas de modifier les dossiers.",
    };
  }
  return { ok: true as const, practice };
}

/* ==========================================================================
 *  Patient
 * ========================================================================== */

export interface SavePatientResult {
  id: string | null;
  /**
   * Le dossier relu après écriture, dans la forme attendue par la
   * facturation. Renseigné UNIQUEMENT si l'écriture a abouti : c'est ce qui
   * empêche un appelant de conclure au succès sur un échec.
   */
  patient: PatientContact | null;
  error?: string;
}

export async function savePatient(formData: FormData): Promise<SavePatientResult> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { id: null, patient: null, error: ctx.error };

  const id = str(formData, "id");
  const prenom = String(formData.get("first_name") ?? "").trim();
  const nom = String(formData.get("last_name") ?? "").trim();
  if (!prenom && !nom) {
    return { id: null, patient: null, error: "Indiquez au moins un nom ou un prénom." };
  }

  const naissance = date(formData, "birth_date");
  if (!naissance.ok) return { id: null, patient: null, error: naissance.error };

  const sexe = str(formData, "norm_reference_sex");
  if (sexe !== null && !["f", "m", "autre"].includes(sexe)) {
    return { id: null, patient: null, error: "Valeur de sexe de référence inattendue." };
  }

  const data = {
    practice_id: ctx.practice.practiceId,
    first_name: prenom,
    last_name: nom,
    birth_name: str(formData, "birth_name"),
    preferred_name: str(formData, "preferred_name"),
    birth_date: naissance.value,
    norm_reference_sex: sexe,
    email: str(formData, "email"),
    phone: str(formData, "phone"),
    address_line1: str(formData, "address_line1"),
    address_line2: str(formData, "address_line2"),
    postal_code: str(formData, "postal_code"),
    city: str(formData, "city"),
    administrative_notes: str(formData, "administrative_notes"),
  };

  // On relit exactement ce que la facturation attend, pour lui éviter une
  // seconde requête juste après la création express d'un patient.
  const relu = "id, first_name, last_name, birth_date, email, phone, address_line1";
  const supabase = await createClient();
  const result = id
    ? await supabase.from("patients").update(data).eq("id", id).select(relu)
    : await supabase.from("patients").insert(data).select(relu);

  const verdict = ecritureReussie(result, "Le dossier");
  if (!verdict.ok) return { id: null, patient: null, error: verdict.error };

  const ligne = result.data?.[0] as
    | {
        id: string;
        first_name: string;
        last_name: string;
        birth_date: string | null;
        email: string | null;
        phone: string | null;
        address_line1: string | null;
      }
    | undefined;

  if (!ligne?.id) {
    return {
      id: null,
      patient: null,
      error: "Le dossier n'a pas pu être relu après enregistrement.",
    };
  }

  revalidatePath("/patients");
  revalidatePath(`/patients/${ligne.id}`);
  return {
    id: ligne.id,
    patient: {
      id: ligne.id,
      first_name: ligne.first_name,
      last_name: ligne.last_name,
      birth_date: ligne.birth_date,
      email: ligne.email,
      phone: ligne.phone,
      // La facturation connaît une adresse en un bloc ; le dossier la découpe.
      address: ligne.address_line1,
    },
  };
}

/**
 * Archive un dossier.
 *
 * Un dossier ne se supprime pas d'un clic : des pièces comptables en dépendent,
 * et la conservation d'un dossier de santé obéit à des durées qui ne sont pas
 * celles du confort d'affichage.
 */
export async function archivePatient(formData: FormData): Promise<Guarded<true>> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const id = str(formData, "id");
  if (!id) return { ok: false, error: "Dossier introuvable." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("archive_patient", {
    p_patient_id: id,
    p_reason: str(formData, "reason"),
  });

  if (error) {
    console.error("[dossier] archivage refusé :", error);
    return { ok: false, error: "Le dossier n'a pas pu être archivé." };
  }

  revalidatePath("/patients");
  revalidatePath(`/patients/${id}`);
  return { ok: true, value: true };
}

export async function unarchivePatient(formData: FormData): Promise<Guarded<true>> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const id = str(formData, "id");
  if (!id) return { ok: false, error: "Dossier introuvable." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("unarchive_patient", { p_patient_id: id });
  if (error) {
    console.error("[dossier] désarchivage refusé :", error);
    return { ok: false, error: "Le dossier n'a pas pu être rouvert." };
  }

  revalidatePath("/patients");
  revalidatePath(`/patients/${id}`);
  return { ok: true, value: true };
}

/* ==========================================================================
 *  Entourage
 * ========================================================================== */

const ROLES: PatientContactRole[] = [
  "responsable_legal", "parent_sans_autorite", "proche", "destinataire",
  "payeur", "assure", "adresseur", "professionnel", "etablissement", "autre",
];

const BASES: LegalBasis[] = [
  "autorite_parentale", "tutelle_majeur", "curatelle",
  "habilitation_familiale", "mandat_protection_future", "autre",
];

/**
 * Crée un contact et le rattache à un patient dans un rôle donné, ou rattache
 * un contact existant.
 *
 * Le rôle et son éventuel fondement juridique sont VALIDÉS ici, en plus de
 * l'être par la base : un rôle inattendu doit produire un message
 * compréhensible, pas une erreur de contrainte.
 */
export async function linkContact(formData: FormData): Promise<Guarded<string>> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const patientId = str(formData, "patient_id");
  if (!patientId) return { ok: false, error: "Dossier introuvable." };

  const role = str(formData, "role") as PatientContactRole | null;
  if (!role || !ROLES.includes(role)) {
    return { ok: false, error: "Choisissez un rôle." };
  }

  const base = str(formData, "legal_basis") as LegalBasis | null;
  if (base && !BASES.includes(base)) {
    return { ok: false, error: "Fondement juridique inattendu." };
  }
  if (base && role !== "responsable_legal") {
    return {
      ok: false,
      error:
        "Un fondement juridique ne se rattache qu'à un responsable légal : l'autorité parentale et une mesure de protection ne s'appliquent pas à un payeur.",
    };
  }

  const supabase = await createClient();
  let contactId = str(formData, "contact_id");

  // Contact existant, ou création à la volée depuis le même formulaire.
  if (!contactId) {
    const kind = str(formData, "kind") === "organisation" ? "organisation" : "personne";
    const prenom = str(formData, "contact_first_name");
    const nom = str(formData, "contact_last_name");
    const raison = str(formData, "organisation_name");

    if (kind === "personne" && !prenom && !nom) {
      return { ok: false, error: "Indiquez au moins un nom ou un prénom pour ce contact." };
    }
    if (kind === "organisation" && !raison) {
      return { ok: false, error: "Indiquez la raison sociale de l'organisation." };
    }

    const creation = await supabase
      .from("contacts")
      .insert({
        practice_id: ctx.practice.practiceId,
        kind,
        first_name: kind === "personne" ? prenom : null,
        last_name: kind === "personne" ? nom : null,
        organisation_name: kind === "organisation" ? raison : null,
        profession: str(formData, "profession"),
        rpps: str(formData, "rpps"),
        email: str(formData, "contact_email"),
        phone: str(formData, "contact_phone"),
        address_line1: str(formData, "contact_address_line1"),
        postal_code: str(formData, "contact_postal_code"),
        city: str(formData, "contact_city"),
      })
      .select("id");

    const verdict = ecritureReussie(creation, "Le contact");
    if (!verdict.ok) return { ok: false, error: verdict.error };
    contactId = (creation.data?.[0] as { id: string } | undefined)?.id ?? null;
    if (!contactId) return { ok: false, error: "Le contact n'a pas pu être créé." };
  }

  const depuis = date(formData, "valid_from");
  if (!depuis.ok) return { ok: false, error: depuis.error };

  const lien = await supabase
    .from("patient_contacts")
    .insert({
      practice_id: ctx.practice.practiceId,
      patient_id: patientId,
      contact_id: contactId,
      role,
      legal_basis: base,
      relationship: str(formData, "relationship"),
      valid_from: depuis.value,
      is_primary: bool(formData, "is_primary"),
      note: str(formData, "link_note"),
    })
    .select("id");

  if (lien.error) {
    console.error("[dossier] rattachement refusé :", lien.error);
    // Le seul cas fréquent : un lien actif existe déjà pour ce rôle.
    const dejaLie = String(lien.error.code) === "23505";
    return {
      ok: false,
      error: dejaLie
        ? "Cette personne tient déjà ce rôle pour ce dossier. Mettez fin au lien existant avant d'en ouvrir un nouveau."
        : "Le rattachement n'a pas pu être enregistré.",
    };
  }

  revalidatePath(`/patients/${patientId}`);
  return { ok: true, value: contactId };
}

/**
 * Met fin à un rôle, sans effacer le lien.
 *
 * Savoir à qui l'on a légitimement écrit l'an dernier fait partie de la trace.
 * C'est exactement ce qu'un champ écrasé faisait disparaître.
 */
export async function endContactRole(formData: FormData): Promise<Guarded<true>> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const linkId = str(formData, "link_id");
  const patientId = str(formData, "patient_id");
  if (!linkId || !patientId) return { ok: false, error: "Lien introuvable." };

  const fin = date(formData, "valid_to");
  if (!fin.ok) return { ok: false, error: fin.error };

  const supabase = await createClient();
  const result = await supabase
    .from("patient_contacts")
    .update({
      valid_to: fin.value ?? new Date().toISOString().slice(0, 10),
      is_primary: false,
    })
    .eq("id", linkId)
    .select("id");

  const verdict = ecritureReussie(result, "Le rôle");
  if (!verdict.ok) return verdict;

  revalidatePath(`/patients/${patientId}`);
  return { ok: true, value: true };
}

/* ==========================================================================
 *  Parcours
 * ========================================================================== */

const STATUTS: PathwayStatus[] = [
  "demande", "liste_attente", "actif", "en_pause",
  "termine", "interrompu", "reoriente",
];

const STATUTS_CLOS: PathwayStatus[] = ["termine", "interrompu", "reoriente"];

export async function savePathway(formData: FormData): Promise<Guarded<string>> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const patientId = str(formData, "patient_id");
  if (!patientId) return { ok: false, error: "Dossier introuvable." };

  const statut = (str(formData, "status") ?? "demande") as PathwayStatus;
  if (!STATUTS.includes(statut)) return { ok: false, error: "Statut inattendu." };

  for (const champ of ["prescription_date", "requested_on", "started_on", "ended_on"]) {
    const d = date(formData, champ);
    if (!d.ok) return { ok: false, error: d.error };
  }

  const fin = (date(formData, "ended_on") as { ok: true; value: string | null }).value;
  const clos = STATUTS_CLOS.includes(statut);

  // La base refuse l'incohérence ; on la traduit ici en phrase utile.
  if (clos && !fin) {
    return {
      ok: false,
      error: "Un parcours clos demande une date de fin : c'est elle qui situe la période de prise en soin.",
    };
  }
  if (!clos && fin) {
    return {
      ok: false,
      error: "Une date de fin est renseignée alors que le parcours n'est pas clos. Choisissez un statut de fin, ou retirez la date.",
    };
  }

  const data = {
    practice_id: ctx.practice.practiceId,
    patient_id: patientId,
    label: str(formData, "label"),
    status: statut,
    referral_reason: str(formData, "referral_reason"),
    referral_source_contact_id: str(formData, "referral_source_contact_id"),
    prescriber_contact_id: str(formData, "prescriber_contact_id"),
    prescription_date: (date(formData, "prescription_date") as { value: string | null }).value,
    prescription_reference: str(formData, "prescription_reference"),
    funding_scheme: str(formData, "funding_scheme"),
    requested_on: (date(formData, "requested_on") as { value: string | null }).value,
    started_on: (date(formData, "started_on") as { value: string | null }).value,
    ended_on: fin,
    end_reason: str(formData, "end_reason"),
  };

  const id = str(formData, "id");
  const supabase = await createClient();
  const result = id
    ? await supabase.from("care_pathways").update(data).eq("id", id).select("id")
    : await supabase.from("care_pathways").insert(data).select("id");

  const verdict = ecritureReussie(result, "Le parcours");
  if (!verdict.ok) return { ok: false, error: verdict.error };

  const savedId = (result.data?.[0] as { id: string } | undefined)?.id;
  revalidatePath(`/patients/${patientId}`);
  return savedId
    ? { ok: true, value: savedId }
    : { ok: false, error: "Le parcours n'a pas pu être relu après enregistrement." };
}

/* ==========================================================================
 *  Notes cliniques
 * ========================================================================== */

export async function saveNote(formData: FormData): Promise<Guarded<true>> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const patientId = str(formData, "patient_id");
  const body = String(formData.get("body") ?? "").trim();
  if (!patientId) return { ok: false, error: "Dossier introuvable." };
  if (!body) return { ok: false, error: "La note est vide." };

  const ecriteLe = date(formData, "written_on");
  if (!ecriteLe.ok) return { ok: false, error: ecriteLe.error };

  const tiers = bool(formData, "third_party_information");
  const source = str(formData, "third_party_source");
  if (source && !tiers) {
    return {
      ok: false,
      error:
        "Vous nommez une source tierce sans marquer l'information comme telle. Cochez la case, ou retirez la source.",
    };
  }

  const supabase = await createClient();
  const result = await supabase
    .from("patient_notes")
    .insert({
      practice_id: ctx.practice.practiceId,
      patient_id: patientId,
      pathway_id: str(formData, "pathway_id"),
      body,
      written_on: ecriteLe.value ?? new Date().toISOString().slice(0, 10),
      author_member_id: ctx.practice.memberId,
      third_party_information: tiers,
      third_party_source: source,
    })
    .select("id");

  const verdict = ecritureReussie(result, "La note");
  if (!verdict.ok) return verdict;

  revalidatePath(`/patients/${patientId}`);
  return { ok: true, value: true };
}

/* ==========================================================================
 *  Consentements
 * ========================================================================== */

const CONSENTEMENTS: ConsentKind[] = [
  "information_recue", "partage_professionnels", "partage_etablissement",
  "transmission_prescripteur", "photo_video", "autre",
];

export async function saveConsent(formData: FormData): Promise<Guarded<true>> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const patientId = str(formData, "patient_id");
  if (!patientId) return { ok: false, error: "Dossier introuvable." };

  const kind = str(formData, "kind") as ConsentKind | null;
  if (!kind || !CONSENTEMENTS.includes(kind)) {
    return { ok: false, error: "Choisissez un type d'autorisation." };
  }

  const accorde = date(formData, "granted_on");
  if (!accorde.ok) return { ok: false, error: accorde.error };

  const supabase = await createClient();
  const result = await supabase
    .from("patient_consents")
    .insert({
      practice_id: ctx.practice.practiceId,
      patient_id: patientId,
      kind,
      scope: str(formData, "scope"),
      granted_by_contact_id: str(formData, "granted_by_contact_id"),
      granted_by_patient: bool(formData, "granted_by_patient"),
      granted_on: accorde.value ?? new Date().toISOString().slice(0, 10),
      evidence: str(formData, "evidence"),
    })
    .select("id");

  const verdict = ecritureReussie(result, "L'autorisation");
  if (!verdict.ok) return verdict;

  revalidatePath(`/patients/${patientId}`);
  return { ok: true, value: true };
}

/** Retire un consentement. La ligne demeure : le retrait fait partie de la trace. */
export async function withdrawConsent(formData: FormData): Promise<Guarded<true>> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const id = str(formData, "id");
  const patientId = str(formData, "patient_id");
  if (!id || !patientId) return { ok: false, error: "Autorisation introuvable." };

  const supabase = await createClient();
  const result = await supabase
    .from("patient_consents")
    .update({ withdrawn_on: new Date().toISOString().slice(0, 10) })
    .eq("id", id)
    .select("id");

  const verdict = ecritureReussie(result, "Le retrait");
  if (!verdict.ok) return verdict;

  revalidatePath(`/patients/${patientId}`);
  return { ok: true, value: true };
}

/* ==========================================================================
 *  Création d'un cabinet
 * ========================================================================== */

/**
 * Crée le cabinet d'un compte qui n'en a pas encore.
 *
 * Le cabinet et son propriétaire naissent dans la même transaction, côté base :
 * aucune fenêtre où un cabinet existerait sans membre.
 */
export async function createPractice(formData: FormData) {
  const acces = await requireActiveAccess();
  if (!acces.ok) redirect("/login");

  const nom = String(formData.get("name") ?? "").trim();
  if (!nom) redirect("/patients?erreur=nom-cabinet");

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_practice", { p_name: nom });
  if (error) {
    console.error("[cabinet] création refusée :", error);
    redirect("/patients?erreur=creation-cabinet");
  }

  revalidatePath("/", "layout");
  redirect("/patients");
}
