"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ecritureReussie, requireActiveAccess, type Guarded } from "@/lib/auth/guard";
import { getCurrentPractice } from "@/lib/dossier/practice";
import {
  ATTENDANCE_REQUIRING_NOTE,
  type Attendance,
  type AppointmentKind,
} from "@/lib/dossier/types";

/* ==========================================================================
 *  Lecture des champs
 * ========================================================================== */

function str(fd: FormData, k: string): string | null {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
}

function bool(fd: FormData, k: string): boolean {
  return fd.get(k) === "on" || fd.get(k) === "true";
}

const KINDS: AppointmentKind[] = [
  "seance", "bilan", "entretien", "restitution", "reunion", "administratif", "autre",
];

const ATTENDANCES: Attendance[] = [
  "a_venir", "honore", "absent_excuse", "absent_non_excuse",
  "annule_praticien", "annule_patient", "reporte",
];

/**
 * Combine une date et une heure locales en instant.
 *
 * Le navigateur envoie « 2026-09-15 » et « 14:30 » séparément ; le serveur les
 * assemble dans le fuseau du cabinet. Passer par une chaîne ISO sans fuseau
 * ferait dériver l'horaire d'une heure selon la saison.
 */
function instant(
  dateStr: string | null,
  timeStr: string | null,
): { ok: true; value: Date } | { ok: false; error: string } {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { ok: false, error: "La date du rendez-vous est manquante ou invalide." };
  }
  if (!timeStr || !/^\d{2}:\d{2}$/.test(timeStr)) {
    return { ok: false, error: "L'heure du rendez-vous est manquante ou invalide." };
  }
  const d = new Date(`${dateStr}T${timeStr}:00`);
  if (Number.isNaN(d.getTime())) {
    return { ok: false, error: "Date ou heure invalide." };
  }
  return { ok: true, value: d };
}

async function contexteEcriture() {
  const acces = await requireActiveAccess();
  if (!acces.ok) return { ok: false as const, error: acces.error };

  const practice = await getCurrentPractice();
  if (!practice) {
    return { ok: false as const, error: "Aucun cabinet n'est rattaché à votre compte." };
  }
  if (!practice.canWrite) {
    return { ok: false as const, error: "Votre rôle ne permet pas de modifier l'agenda." };
  }
  return { ok: true as const, practice };
}

/* ==========================================================================
 *  Rendez-vous
 * ========================================================================== */

/**
 * Crée ou modifie un rendez-vous.
 *
 * Les règles d'intégrité vivent dans la base — un créneau qui finit avant de
 * commencer, un créneau sans patient ni intitulé, un rendez-vous futur marqué
 * honoré sont refusés là-bas. Ce qui se passe ici est la TRADUCTION de ces
 * refus en phrases utilisables, plutôt que de laisser remonter une contrainte.
 */
export async function saveAppointment(formData: FormData): Promise<Guarded<string>> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const kind = (str(formData, "kind") ?? "seance") as AppointmentKind;
  if (!KINDS.includes(kind)) return { ok: false, error: "Type de rendez-vous inattendu." };

  const debut = instant(str(formData, "date"), str(formData, "start_time"));
  if (!debut.ok) return { ok: false, error: debut.error };

  const dureeMin = Number.parseInt(String(formData.get("duration") ?? "45"), 10);
  if (!Number.isFinite(dureeMin) || dureeMin < 5 || dureeMin > 600) {
    return { ok: false, error: "La durée doit être comprise entre 5 et 600 minutes." };
  }
  const fin = new Date(debut.value.getTime() + dureeMin * 60_000);

  const patientId = str(formData, "patient_id");
  const titre = str(formData, "title");
  const sansPatient = ["reunion", "administratif", "autre"].includes(kind);

  if (!patientId && !sansPatient) {
    return {
      ok: false,
      error: "Choisissez un patient : une séance, un bilan, un entretien ou une restitution concernent quelqu'un.",
    };
  }
  if (!patientId && !titre) {
    return {
      ok: false,
      error: "Donnez un intitulé à ce créneau, sans quoi l'agenda affichera une case muette.",
    };
  }

  const data = {
    practice_id: ctx.practice.practiceId,
    patient_id: patientId,
    pathway_id: str(formData, "pathway_id"),
    practitioner_member_id: ctx.practice.memberId,
    location_id: str(formData, "location_id"),
    kind,
    starts_at: debut.value.toISOString(),
    ends_at: fin.toISOString(),
    title: titre,
    note: str(formData, "note"),
  };

  const id = str(formData, "id");
  const supabase = await createClient();
  const result = id
    ? await supabase.from("appointments").update(data).eq("id", id).select("id")
    : await supabase.from("appointments").insert(data).select("id");

  if (result.error) {
    console.error("[agenda] enregistrement refusé :", result.error);
    return {
      ok: false,
      error: traduireErreur(result.error.message),
    };
  }

  const verdict = ecritureReussie(result, "Le rendez-vous");
  if (!verdict.ok) return { ok: false, error: verdict.error };

  const savedId = (result.data?.[0] as { id: string } | undefined)?.id;
  revalidatePath("/agenda");
  if (patientId) revalidatePath(`/patients/${patientId}`);

  return savedId
    ? { ok: true, value: savedId }
    : { ok: false, error: "Le rendez-vous n'a pas pu être relu après enregistrement." };
}

/**
 * Crée une série de rendez-vous hebdomadaires.
 *
 * PAS de règle de récurrence stockée, et c'est délibéré. Une série de séances
 * se décale, saute une semaine de vacances, change d'horaire au trimestre : une
 * récurrence calculée obligerait à gérer des exceptions à chaque occurrence.
 * On matérialise donc N rendez-vous indépendants, que l'on déplace ou annule
 * un par un — ce que le praticien fait de toute façon.
 */
export async function saveAppointmentSeries(
  formData: FormData,
): Promise<Guarded<number>> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const occurrences = Number.parseInt(String(formData.get("occurrences") ?? "0"), 10);
  if (!Number.isFinite(occurrences) || occurrences < 2 || occurrences > 30) {
    return {
      ok: false,
      error: "Le nombre de séances de la série doit être compris entre 2 et 30.",
    };
  }

  const debut = instant(str(formData, "date"), str(formData, "start_time"));
  if (!debut.ok) return { ok: false, error: debut.error };

  const dureeMin = Number.parseInt(String(formData.get("duration") ?? "45"), 10);
  if (!Number.isFinite(dureeMin) || dureeMin < 5 || dureeMin > 600) {
    return { ok: false, error: "La durée doit être comprise entre 5 et 600 minutes." };
  }

  const patientId = str(formData, "patient_id");
  if (!patientId) return { ok: false, error: "Choisissez un patient." };

  const kind = (str(formData, "kind") ?? "seance") as AppointmentKind;
  if (!KINDS.includes(kind)) return { ok: false, error: "Type de rendez-vous inattendu." };

  const lignes = Array.from({ length: occurrences }, (_, i) => {
    const d = new Date(debut.value.getTime() + i * 7 * 24 * 3_600_000);
    return {
      practice_id: ctx.practice.practiceId,
      patient_id: patientId,
      pathway_id: str(formData, "pathway_id"),
      practitioner_member_id: ctx.practice.memberId,
      location_id: str(formData, "location_id"),
      kind,
      starts_at: d.toISOString(),
      ends_at: new Date(d.getTime() + dureeMin * 60_000).toISOString(),
      note: str(formData, "note"),
    };
  });

  const supabase = await createClient();
  const result = await supabase.from("appointments").insert(lignes).select("id");

  if (result.error) {
    console.error("[agenda] série refusée :", result.error);
    return { ok: false, error: traduireErreur(result.error.message) };
  }

  const crees = result.data?.length ?? 0;
  if (crees !== occurrences) {
    return {
      ok: false,
      error: `Seuls ${crees} rendez-vous sur ${occurrences} ont été créés. Vérifiez l'agenda avant de recommencer.`,
    };
  }

  revalidatePath("/agenda");
  revalidatePath(`/patients/${patientId}`);
  return { ok: true, value: crees };
}

/**
 * Constate l'issue d'un rendez-vous.
 *
 * Passe par la fonction de base plutôt que par un UPDATE : le défaut de
 * facturation y suit l'issue, et l'événement est journalisé. C'est aussi ce qui
 * garantit qu'un rendez-vous futur ne peut pas être marqué honoré.
 */
export async function setAttendance(formData: FormData): Promise<Guarded<true>> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const id = str(formData, "id");
  if (!id) return { ok: false, error: "Rendez-vous introuvable." };

  const attendance = str(formData, "attendance") as Attendance | null;
  if (!attendance || !ATTENDANCES.includes(attendance)) {
    return { ok: false, error: "Issue inattendue." };
  }

  const note = str(formData, "attendance_note");
  if (ATTENDANCE_REQUIRING_NOTE.includes(attendance) && !note) {
    return {
      ok: false,
      error:
        "Indiquez ce qui s'est passé : sans motif, vous ne pourrez ni relancer, ni justifier une facturation.",
    };
  }

  // `null` laisse la base appliquer son défaut ; une valeur explicite l'emporte.
  const billable = formData.has("billable_explicit")
    ? bool(formData, "billable")
    : null;

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_appointment_attendance", {
    p_appointment_id: id,
    p_attendance: attendance,
    p_note: note,
    p_billable: billable,
  });

  if (error) {
    console.error("[agenda] qualification refusée :", error);
    return { ok: false, error: traduireErreur(error.message) };
  }

  revalidatePath("/agenda");
  revalidatePath("/patients", "layout");
  return { ok: true, value: true };
}

export async function deleteAppointment(formData: FormData): Promise<Guarded<true>> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const id = str(formData, "id");
  if (!id) return { ok: false, error: "Rendez-vous introuvable." };

  const supabase = await createClient();
  const result = await supabase
    .from("appointments")
    .delete()
    .eq("id", id)
    .select("id");

  const verdict = ecritureReussie(result, "Le rendez-vous");
  if (!verdict.ok) return verdict;

  revalidatePath("/agenda");
  revalidatePath("/patients", "layout");
  return { ok: true, value: true };
}

/* ==========================================================================
 *  Traduction des refus de la base
 * ========================================================================== */

/**
 * Rend lisible ce que la base a refusé.
 *
 * Les règles sont énoncées une seule fois, en SQL, parce que c'est là qu'elles
 * tiennent quel que soit le chemin d'écriture. Mais un message de contrainte
 * PostgreSQL n'a rien à faire sous les yeux d'une praticienne : on le traduit,
 * sans jamais le recopier.
 */
function traduireErreur(message: string): string {
  const m = message.toLowerCase();

  if (m.includes("honoré") || m.includes("pas encore eu lieu")) {
    return "Ce rendez-vous n'a pas encore eu lieu : il ne peut pas être marqué comme honoré.";
  }
  if (m.includes("appointments_duree_ck")) {
    return "Le rendez-vous se termine avant de commencer.";
  }
  if (m.includes("appointments_objet_ck")) {
    return "Un créneau sans patient doit porter un intitulé.";
  }
  if (m.includes("appointments_motif_ck")) {
    return "Indiquez ce qui s'est passé : cette issue demande un motif.";
  }
  if (m.includes("n'appartient pas à ce cabinet")) {
    return "Ce patient n'appartient pas à votre cabinet.";
  }
  if (m.includes("parcours ne correspond pas")) {
    return "Le parcours choisi ne concerne pas ce patient.";
  }
  return "Le rendez-vous n'a pas pu être enregistré. Réessayez.";
}
