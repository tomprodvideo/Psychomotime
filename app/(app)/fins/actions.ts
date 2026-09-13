"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  contexteEcriture,
  messageErreur,
  str,
  id,
  jourISO,
} from "@/lib/actions/serveur";
import { ecritureReussie, type Guarded } from "@/lib/auth/guard";
import { faitsDeLEpisode } from "@/lib/fins/queries";
import type { FaitsEpisode, ModeRemise } from "@/lib/fins/types";

/**
 * Écrire, remettre et annuler un écrit de fin de prise en soin.
 *
 * TOUTE LA COHÉRENCE EST TENUE EN BASE — dossier, parcours et destinataire du
 * même cabinet, parcours clos avec ses deux bornes, refus de remettre sans
 * texte, immuabilité, motif exigé à l'annulation, et un parcours qui porte un
 * écrit remis ne se rouvre plus.
 */

const MODES: ModeRemise[] = ["destinataire", "personne_suivie", "au_dossier"];

export async function enregistrerFin(fd: FormData): Promise<Guarded<string>> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const patientId = id(fd, "patient_id");
  const pathwayId = id(fd, "pathway_id");
  if (!patientId) return { ok: false, error: "Dossier introuvable." };
  if (!pathwayId) {
    return {
      ok: false,
      error:
        "Un écrit de fin porte sur une prise en soin. Choisissez le parcours qu'il clôt.",
    };
  }

  const nature = str(fd, "closure_kind");
  if (!nature) {
    return { ok: false, error: "Indiquez ce qui met fin à la prise en soin." };
  }

  /* LE MODE DE REMISE ET LE DESTINATAIRE S'ACCORDENT ICI AUSSI, avant la base.
   * Elle refuserait — la contrainte existe — mais avec un nom technique. */
  const modeBrut = str(fd, "delivery_mode") ?? "au_dossier";
  const mode = (MODES as string[]).includes(modeBrut)
    ? (modeBrut as ModeRemise)
    : "au_dossier";
  const destinataire = mode === "destinataire" ? id(fd, "recipient_contact_id") : null;
  if (mode === "destinataire" && !destinataire) {
    return {
      ok: false,
      error: "Vous avez choisi de remettre l'écrit à quelqu'un : indiquez à qui.",
    };
  }

  const supabase = await createClient();
  const existant = id(fd, "id");

  const champs = {
    practice_id: ctx.practice.practiceId,
    patient_id: patientId,
    pathway_id: pathwayId,
    closure_kind: nature,
    delivery_mode: mode,
    recipient_contact_id: destinataire,
    context: str(fd, "context"),
    means: str(fd, "means"),
    observed: str(fd, "observed"),
    closure_reason: str(fd, "closure_reason"),
    remains_open: str(fd, "remains_open"),
    handover: str(fd, "handover"),
    resumption: str(fd, "resumption"),
    detail_objectifs: fd.get("detail_objectifs") === "on",
    detail_absences: fd.get("detail_absences") === "on",
    detail_financement: fd.get("detail_financement") === "on",
    note: str(fd, "note"),
    internal_note: str(fd, "internal_note"),
  };

  const resultat = existant
    ? await supabase
        .from("closure_reports")
        .update(champs)
        .eq("id", existant)
        .eq("practice_id", ctx.practice.practiceId)
        .select("id")
    : await supabase.from("closure_reports").insert(champs).select("id");

  const verdict = ecritureReussie(resultat, "l'écrit de fin");
  if (!verdict.ok) return verdict;

  const enregistre = (resultat.data as { id: string }[] | null)?.[0]?.id;
  if (!enregistre) {
    return { ok: false, error: "L'écrit n'a pas pu être relu après enregistrement." };
  }
  revalidatePath(`/patients/${patientId}`);
  return { ok: true, value: enregistre };
}

/** Les faits de l'épisode, pour l'écran. Même fonction que celle de l'émission. */
export async function releverLEpisode(
  pathwayId: string,
): Promise<Guarded<FaitsEpisode>> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const { faits, erreur } = await faitsDeLEpisode(pathwayId);
  if (!faits) return { ok: false, error: erreur ?? "Relevé impossible." };
  return { ok: true, value: faits };
}

export async function remettreFin(fd: FormData): Promise<Guarded<true>> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const ecrit = id(fd, "id");
  const patientId = id(fd, "patient_id");
  if (!ecrit) return { ok: false, error: "Écrit de fin introuvable." };

  const jour = jourISO(fd, "issued_on");
  if (!jour.ok) return { ok: false, error: jour.error };

  const supabase = await createClient();
  const { error } = await supabase.rpc("issue_closure_report", {
    p_report_id: ecrit,
    p_issued_on: jour.value,
  });
  if (error) return { ok: false, error: messageErreur(error) };

  if (patientId) revalidatePath(`/patients/${patientId}`);
  return { ok: true, value: true };
}

export async function annulerFin(fd: FormData): Promise<Guarded<true>> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const ecrit = id(fd, "id");
  const motif = str(fd, "reason");
  const patientId = id(fd, "patient_id");
  if (!ecrit) return { ok: false, error: "Écrit de fin introuvable." };
  if (!motif) {
    return {
      ok: false,
      error:
        "Indiquez pourquoi cet écrit est annulé : sans motif, cela n'apprend rien à qui l'a reçu.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_closure_report", {
    p_report_id: ecrit,
    p_reason: motif,
  });
  if (error) return { ok: false, error: messageErreur(error) };

  if (patientId) revalidatePath(`/patients/${patientId}`);
  return { ok: true, value: true };
}

/** Un brouillon se supprime. Un écrit remis, non — la base le refuse. */
export async function supprimerBrouillonFin(fd: FormData): Promise<Guarded<true>> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const ecrit = id(fd, "id");
  const patientId = id(fd, "patient_id");
  if (!ecrit) return { ok: false, error: "Écrit de fin introuvable." };

  const supabase = await createClient();
  const resultat = await supabase
    .from("closure_reports")
    .delete()
    .eq("id", ecrit)
    .eq("practice_id", ctx.practice.practiceId)
    .select("id");

  const verdict = ecritureReussie(resultat, "l'écrit de fin");
  if (!verdict.ok) return verdict;

  if (patientId) revalidatePath(`/patients/${patientId}`);
  return { ok: true, value: true };
}
