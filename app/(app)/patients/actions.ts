"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PATIENT_DOSSIER_FIELDS } from "@/lib/constants";
import { ecritureReussie, requireActiveAccess, requireUser } from "@/lib/auth/guard";
import type { PatientContact } from "@/lib/types";

function str(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

export interface SavePatientResult {
  /** Renseigné UNIQUEMENT si l'écriture a réellement abouti. */
  id: string | null;
  patient: PatientContact | null;
  error?: string;
}

/**
 * Enregistre un patient (création ou édition).
 *
 * DEUX DÉFAUTS CORRIGÉS ICI, et ils se renforçaient l'un l'autre.
 *
 * 1. L'action ne vérifiait aucune session. Elle est pourtant atteignable en
 *    HTTP sans passer par l'écran, comme toute Server Action.
 * 2. Elle ignorait l'erreur d'écriture, puis renvoyait `savedId = patient?.id
 *    ?? id` — c'est-à-dire l'identifiant REÇU EN ENTRÉE quand l'écriture avait
 *    échoué. L'appelant recevait donc un identifiant valide et concluait au
 *    succès. Une modification de fiche perdue passait inaperçue.
 *
 * Le repli progressif sans `guardian` ni `dossier` a également été retiré :
 * vérification du 2026-09-11 sur la base de production, les deux colonnes
 * existent. Il ne protégeait plus rien et convertissait une migration manquante
 * en perte de données silencieuse, annoncée comme un succès.
 */
export async function savePatient(
  formData: FormData,
): Promise<SavePatientResult> {
  const acces = await requireActiveAccess();
  if (!acces.ok) return { id: null, patient: null, error: acces.error };

  const supabase = await createClient();
  const id = str(formData.get("id"));

  const prenom = String(formData.get("first_name") ?? "").trim();
  const nom = String(formData.get("last_name") ?? "").trim();
  if (!prenom && !nom) {
    return {
      id: null,
      patient: null,
      error: "Indiquez au moins un nom ou un prénom.",
    };
  }

  const guardian = {
    relation: str(formData.get("guardian_relation")),
    first_name: str(formData.get("guardian_first_name")),
    last_name: str(formData.get("guardian_last_name")),
    phone: str(formData.get("guardian_phone")),
    email: str(formData.get("guardian_email")),
    address: str(formData.get("guardian_address")),
  };

  const dossier: Record<string, string | null> = {};
  for (const f of PATIENT_DOSSIER_FIELDS) {
    dossier[f.id] = str(formData.get(`dossier_${f.id}`));
  }

  const data = {
    first_name: prenom,
    last_name: nom,
    birth_date: str(formData.get("birth_date")),
    email: str(formData.get("email")),
    phone: str(formData.get("phone")),
    address: str(formData.get("address")),
    notes: str(formData.get("notes")),
    guardian,
    dossier,
  };

  const colonnes = "id, first_name, last_name, birth_date, email, phone, address";
  const result = id
    ? await supabase.from("patients").update(data).eq("id", id).select(colonnes)
    : await supabase.from("patients").insert(data).select(colonnes);

  const verdict = ecritureReussie(result, "Le patient");
  if (!verdict.ok) return { id: null, patient: null, error: verdict.error };

  const patient = (result.data?.[0] as PatientContact | undefined) ?? null;
  if (!patient?.id) {
    // Ne jamais rendre l'identifiant reçu en entrée quand rien n'a été relu :
    // c'est ainsi qu'un échec se déguisait en succès.
    return {
      id: null,
      patient: null,
      error: "Le patient n'a pas pu être relu après enregistrement.",
    };
  }

  revalidatePath("/patients");
  revalidatePath("/comptabilite");
  revalidatePath(`/patients/${patient.id}`);
  return { id: patient.id, patient };
}

export async function deletePatient(formData: FormData) {
  const session = await requireUser();
  if (!session.ok) redirect("/login");

  const id = str(formData.get("id"));
  if (!id) redirect("/patients");

  const supabase = await createClient();
  const result = await supabase
    .from("patients")
    .delete()
    .eq("id", id)
    .select("id");

  const verdict = ecritureReussie(result, "Le patient");
  revalidatePath("/patients");
  revalidatePath("/comptabilite");
  redirect(verdict.ok ? "/patients" : `/patients/${id}?erreur=suppression`);
}
