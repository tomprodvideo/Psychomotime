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

/**
 * Écrire, remettre et annuler un courrier de liaison.
 *
 * TOUTE LA COHÉRENCE EST TENUE EN BASE — dossier, destinataire et parcours du
 * même cabinet, immuabilité d'un courrier remis, motif exigé à l'annulation.
 * Ces actions composent le formulaire et rapportent ce que la base répond ;
 * elles ne se substituent pas à elle.
 */

export async function enregistrerCourrier(fd: FormData): Promise<Guarded<string>> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const patientId = id(fd, "patient_id");
  const destinataire = id(fd, "recipient_contact_id");
  const objet = str(fd, "subject");
  const corps = str(fd, "body");

  if (!patientId) return { ok: false, error: "Dossier introuvable." };
  if (!destinataire) {
    return {
      ok: false,
      error:
        "Un courrier de liaison s'adresse à quelqu'un. Choisissez le professionnel destinataire.",
    };
  }
  if (!objet) return { ok: false, error: "Indiquez l'objet du courrier." };
  if (!corps) return { ok: false, error: "Le courrier est vide." };

  const supabase = await createClient();
  const existant = id(fd, "id");

  const champs = {
    practice_id: ctx.practice.practiceId,
    patient_id: patientId,
    pathway_id: id(fd, "pathway_id"),
    recipient_contact_id: destinataire,
    subject: objet,
    body: corps,
    internal_note: str(fd, "internal_note"),
  };

  const resultat = existant
    ? await supabase
        .from("liaison_letters")
        .update(champs)
        .eq("id", existant)
        .eq("practice_id", ctx.practice.practiceId)
        .select("id")
    : await supabase.from("liaison_letters").insert(champs).select("id");

  const verdict = ecritureReussie(resultat, "le courrier");
  if (!verdict.ok) return verdict;

  const enregistre = (resultat.data as { id: string }[] | null)?.[0]?.id;
  if (!enregistre) {
    return { ok: false, error: "Le courrier n'a pas pu être relu après enregistrement." };
  }
  revalidatePath(`/patients/${patientId}`);
  return { ok: true, value: enregistre };
}

/** Remettre le courrier : il fige ce qu'il porte et ne se modifie plus. */
export async function remettreCourrier(fd: FormData): Promise<Guarded<true>> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const lettre = id(fd, "id");
  const patientId = id(fd, "patient_id");
  if (!lettre) return { ok: false, error: "Courrier introuvable." };

  const jour = jourISO(fd, "issued_on");
  if (!jour.ok) return { ok: false, error: jour.error };

  const supabase = await createClient();
  const { error } = await supabase.rpc("issue_liaison_letter", {
    p_letter_id: lettre,
    p_issued_on: jour.value,
  });
  if (error) return { ok: false, error: messageErreur(error) };

  if (patientId) revalidatePath(`/patients/${patientId}`);
  return { ok: true, value: true };
}

/** Annuler un courrier remis. L'original est conservé, avec son motif. */
export async function annulerCourrier(fd: FormData): Promise<Guarded<true>> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const lettre = id(fd, "id");
  const motif = str(fd, "reason");
  const patientId = id(fd, "patient_id");
  if (!lettre) return { ok: false, error: "Courrier introuvable." };
  if (!motif) {
    return {
      ok: false,
      error:
        "Indiquez pourquoi ce courrier est annulé : sans motif, cela n'apprend rien à qui l'a reçu.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_liaison_letter", {
    p_letter_id: lettre,
    p_reason: motif,
  });
  if (error) return { ok: false, error: messageErreur(error) };

  if (patientId) revalidatePath(`/patients/${patientId}`);
  return { ok: true, value: true };
}

/** Un brouillon se supprime. Un courrier remis, non — la base le refuse. */
export async function supprimerBrouillonCourrier(fd: FormData): Promise<Guarded<true>> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const lettre = id(fd, "id");
  const patientId = id(fd, "patient_id");
  if (!lettre) return { ok: false, error: "Courrier introuvable." };

  const supabase = await createClient();
  const resultat = await supabase
    .from("liaison_letters")
    .delete()
    .eq("id", lettre)
    .eq("practice_id", ctx.practice.practiceId)
    .select("id");

  const verdict = ecritureReussie(resultat, "le courrier");
  if (!verdict.ok) return verdict;

  if (patientId) revalidatePath(`/patients/${patientId}`);
  return { ok: true, value: true };
}
