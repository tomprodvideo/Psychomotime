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
import { faitsDeLaPeriode } from "@/lib/syntheses/queries";
import type { FaitsPeriode } from "@/lib/syntheses/types";

/**
 * Écrire, remettre et annuler une synthèse de suivi.
 *
 * TOUTE LA COHÉRENCE EST TENUE EN BASE — dossier, parcours et destinataire du
 * même cabinet, période qui ne finit pas dans le futur, refus de remettre une
 * synthèse sans texte, immuabilité d'une synthèse remise, motif exigé à
 * l'annulation. Ces actions composent le formulaire et rapportent ce que la
 * base répond ; elles ne se substituent pas à elle.
 */

export async function enregistrerSynthese(fd: FormData): Promise<Guarded<string>> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const patientId = id(fd, "patient_id");
  if (!patientId) return { ok: false, error: "Dossier introuvable." };

  const du = jourISO(fd, "period_start");
  if (!du.ok) return { ok: false, error: du.error };
  const au = jourISO(fd, "period_end");
  if (!au.ok) return { ok: false, error: au.error };
  if (!du.value || !au.value) {
    return {
      ok: false,
      error: "Indiquez la période couverte : une synthèse sans période ne dit pas de quoi elle parle.",
    };
  }
  if (au.value < du.value) {
    return { ok: false, error: "La période finit avant de commencer." };
  }

  /* LE DESTINATAIRE EST EXPLICITE. « Remise au patient » et « remise à ce
   * contact » sont deux choix, pas un défaut et son exception : dans un an,
   * il faut pouvoir dire à qui ce document a été donné. */
  const destinataire = id(fd, "recipient_contact_id");
  const auPatient = fd.get("recipient_is_patient") === "on";
  if (!destinataire && !auPatient) {
    return {
      ok: false,
      error:
        "Indiquez à qui cette synthèse est remise : à la personne suivie, ou à un destinataire nommé.",
    };
  }

  const supabase = await createClient();
  const existant = id(fd, "id");

  const champs = {
    practice_id: ctx.practice.practiceId,
    patient_id: patientId,
    pathway_id: id(fd, "pathway_id"),
    recipient_contact_id: destinataire,
    recipient_is_patient: auPatient,
    period_start: du.value,
    period_end: au.value,
    means: str(fd, "means"),
    observed_evolution: str(fd, "observed_evolution"),
    adjustments: str(fd, "adjustments"),
    next_step: str(fd, "next_step"),
    detail_absences: fd.get("detail_absences") === "on",
    note: str(fd, "note"),
    internal_note: str(fd, "internal_note"),
  };

  const resultat = existant
    ? await supabase
        .from("follow_up_summaries")
        .update(champs)
        .eq("id", existant)
        .eq("practice_id", ctx.practice.practiceId)
        .select("id")
    : await supabase.from("follow_up_summaries").insert(champs).select("id");

  const verdict = ecritureReussie(resultat, "la synthèse");
  if (!verdict.ok) return verdict;

  const enregistre = (resultat.data as { id: string }[] | null)?.[0]?.id;
  if (!enregistre) {
    return { ok: false, error: "La synthèse n'a pas pu être relue après enregistrement." };
  }
  revalidatePath(`/patients/${patientId}`);
  return { ok: true, value: enregistre };
}

/**
 * Les faits de la période, pour l'écran.
 *
 * MÊME FONCTION QUE CELLE QU'APPELLE L'ÉMISSION. La praticienne voit, avant
 * de remettre, exactement ce qui sera figé — et rien n'est saisi deux fois.
 */
export async function releverLesFaits(
  patientId: string,
  pathwayId: string | null,
  du: string,
  au: string,
): Promise<Guarded<FaitsPeriode>> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const { faits, erreur } = await faitsDeLaPeriode(patientId, pathwayId, du, au);
  if (!faits) return { ok: false, error: erreur ?? "Relevé impossible." };
  return { ok: true, value: faits };
}

/** Remettre la synthèse : elle fige ses faits et son texte, et ne bouge plus. */
export async function remettreSynthese(fd: FormData): Promise<Guarded<true>> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const synthese = id(fd, "id");
  const patientId = id(fd, "patient_id");
  if (!synthese) return { ok: false, error: "Synthèse introuvable." };

  const jour = jourISO(fd, "issued_on");
  if (!jour.ok) return { ok: false, error: jour.error };

  const supabase = await createClient();
  const { error } = await supabase.rpc("issue_follow_up_summary", {
    p_summary_id: synthese,
    p_issued_on: jour.value,
  });
  if (error) return { ok: false, error: messageErreur(error) };

  if (patientId) revalidatePath(`/patients/${patientId}`);
  return { ok: true, value: true };
}

/** Annuler une synthèse remise. L'original est conservé, avec son motif. */
export async function annulerSynthese(fd: FormData): Promise<Guarded<true>> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const synthese = id(fd, "id");
  const motif = str(fd, "reason");
  const patientId = id(fd, "patient_id");
  if (!synthese) return { ok: false, error: "Synthèse introuvable." };
  if (!motif) {
    return {
      ok: false,
      error:
        "Indiquez pourquoi cette synthèse est annulée : sans motif, cela n'apprend rien à qui l'a reçue.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_follow_up_summary", {
    p_summary_id: synthese,
    p_reason: motif,
  });
  if (error) return { ok: false, error: messageErreur(error) };

  if (patientId) revalidatePath(`/patients/${patientId}`);
  return { ok: true, value: true };
}

/** Un brouillon se supprime. Une synthèse remise, non — la base le refuse. */
export async function supprimerBrouillonSynthese(fd: FormData): Promise<Guarded<true>> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const synthese = id(fd, "id");
  const patientId = id(fd, "patient_id");
  if (!synthese) return { ok: false, error: "Synthèse introuvable." };

  const supabase = await createClient();
  const resultat = await supabase
    .from("follow_up_summaries")
    .delete()
    .eq("id", synthese)
    .eq("practice_id", ctx.practice.practiceId)
    .select("id");

  const verdict = ecritureReussie(resultat, "la synthèse");
  if (!verdict.ok) return verdict;

  if (patientId) revalidatePath(`/patients/${patientId}`);
  return { ok: true, value: true };
}
