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
import { faitsPourTiers } from "@/lib/tiers/queries";
import type { FaitsTiers, ModeRemiseTiers, UsageTiers } from "@/lib/tiers/types";

/**
 * Écrire, remettre et annuler un écrit destiné à un tiers non soignant.
 *
 * TOUTE LA DÉCISION EST EN BASE, y compris celle qui distingue ce document des
 * trois autres : l'accord de partage y DÉCIDE au lieu d'informer, et un retrait
 * enregistré ne se contourne pas.
 */

const USAGES: UsageTiers[] = ["ecole", "mdph", "autre_tiers"];
const MODES: ModeRemiseTiers[] = [
  "destinataire",
  "remis_pour_transmission",
  "personne_suivie",
  "au_dossier",
];

export async function enregistrerEcritTiers(fd: FormData): Promise<Guarded<string>> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const patientId = id(fd, "patient_id");
  if (!patientId) return { ok: false, error: "Dossier introuvable." };

  const usageBrut = str(fd, "intended_use") ?? "";
  if (!(USAGES as string[]).includes(usageBrut)) {
    return { ok: false, error: "Indiquez à quel usage cet écrit est destiné." };
  }

  const modeBrut = str(fd, "delivery_mode") ?? "personne_suivie";
  const mode = (MODES as string[]).includes(modeBrut)
    ? (modeBrut as ModeRemiseTiers)
    : "personne_suivie";
  const destinataire = mode === "destinataire" ? id(fd, "recipient_contact_id") : null;
  if (mode === "destinataire" && !destinataire) {
    return {
      ok: false,
      error: "Vous avez choisi d'adresser cet écrit : indiquez à qui.",
    };
  }

  /* LES PROFESSIONNELS NE SE NOMMENT QUE SI ELLE L'A DEMANDÉ. La base le
   * refuserait — la contrainte existe — mais avec un nom technique. */
  const nommerProfessionnels = fd.get("detail_professionnels") === "on";
  const professionnels = nommerProfessionnels ? str(fd, "professionnels") : null;

  const supabase = await createClient();
  const existant = id(fd, "id");

  const champs = {
    practice_id: ctx.practice.practiceId,
    patient_id: patientId,
    pathway_id: id(fd, "pathway_id"),
    intended_use: usageBrut,
    delivery_mode: mode,
    recipient_contact_id: destinataire,
    context: str(fd, "context"),
    observation_setting: str(fd, "observation_setting"),
    observed: str(fd, "observed"),
    daily_impact: str(fd, "daily_impact"),
    what_helps: str(fd, "what_helps"),
    proposals: str(fd, "proposals"),
    limits_note: str(fd, "limits_note"),
    detail_scores: fd.get("detail_scores") === "on",
    detail_objectifs: fd.get("detail_objectifs") === "on",
    detail_seances: fd.get("detail_seances") === "on",
    detail_prescripteur: fd.get("detail_prescripteur") === "on",
    detail_professionnels: nommerProfessionnels,
    professionnels,
    consent_override_reason: str(fd, "consent_override_reason"),
    note: str(fd, "note"),
    internal_note: str(fd, "internal_note"),
  };

  const resultat = existant
    ? await supabase
        .from("third_party_reports")
        .update(champs)
        .eq("id", existant)
        .eq("practice_id", ctx.practice.practiceId)
        .select("id")
    : await supabase.from("third_party_reports").insert(champs).select("id");

  const verdict = ecritureReussie(resultat, "l'écrit");
  if (!verdict.ok) return verdict;

  const enregistre = (resultat.data as { id: string }[] | null)?.[0]?.id;
  if (!enregistre) {
    return { ok: false, error: "L'écrit n'a pas pu être relu après enregistrement." };
  }
  revalidatePath(`/patients/${patientId}`);
  return { ok: true, value: enregistre };
}

/** Les faits, pour l'écran. Même fonction que celle qui les fige. */
export async function releverPourTiers(
  patientId: string,
  pathwayId: string | null,
): Promise<Guarded<FaitsTiers>> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const { faits, erreur } = await faitsPourTiers(patientId, pathwayId);
  if (!faits) return { ok: false, error: erreur ?? "Relevé impossible." };
  return { ok: true, value: faits };
}

export async function remettreEcritTiers(fd: FormData): Promise<Guarded<true>> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const ecrit = id(fd, "id");
  const patientId = id(fd, "patient_id");
  if (!ecrit) return { ok: false, error: "Écrit introuvable." };

  const jour = jourISO(fd, "issued_on");
  if (!jour.ok) return { ok: false, error: jour.error };

  const supabase = await createClient();
  const { error } = await supabase.rpc("issue_third_party_report", {
    p_report_id: ecrit,
    p_issued_on: jour.value,
  });
  if (error) return { ok: false, error: messageErreur(error) };

  if (patientId) revalidatePath(`/patients/${patientId}`);
  return { ok: true, value: true };
}

export async function annulerEcritTiers(fd: FormData): Promise<Guarded<true>> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const ecrit = id(fd, "id");
  const motif = str(fd, "reason");
  const patientId = id(fd, "patient_id");
  if (!ecrit) return { ok: false, error: "Écrit introuvable." };
  if (!motif) {
    return {
      ok: false,
      error:
        "Indiquez pourquoi cet écrit est annulé : sans motif, cela n'apprend rien à qui l'a reçu.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_third_party_report", {
    p_report_id: ecrit,
    p_reason: motif,
  });
  if (error) return { ok: false, error: messageErreur(error) };

  if (patientId) revalidatePath(`/patients/${patientId}`);
  return { ok: true, value: true };
}

export async function supprimerBrouillonTiers(fd: FormData): Promise<Guarded<true>> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const ecrit = id(fd, "id");
  const patientId = id(fd, "patient_id");
  if (!ecrit) return { ok: false, error: "Écrit introuvable." };

  const supabase = await createClient();
  const resultat = await supabase
    .from("third_party_reports")
    .delete()
    .eq("id", ecrit)
    .eq("practice_id", ctx.practice.practiceId)
    .select("id");

  const verdict = ecritureReussie(resultat, "l'écrit");
  if (!verdict.ok) return verdict;

  if (patientId) revalidatePath(`/patients/${patientId}`);
  return { ok: true, value: true };
}
