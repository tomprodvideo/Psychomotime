"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  contexteEcriture,
  id,
  jourISO,
  messageErreur,
  montant,
  rendreCompte,
  str,
  type Resultat,
} from "@/lib/actions/serveur";
import type { AttestationKind } from "@/lib/attestations/types";

/**
 * Écritures des attestations.
 *
 * CE QUI N'EST PAS ICI, ET POURQUOI. Aucune de ces actions ne décide qu'une
 * séance a eu lieu, ni qu'un règlement concerne ce patient. Ces vérifications
 * vivent en base, dans des déclencheurs : une attestation part chez un tiers,
 * et la garantie de ce qu'elle affirme ne peut pas dépendre du chemin emprunté
 * pour la créer.
 */

function rafraichir(attestationId?: string, patientId?: string) {
  revalidatePath("/comptabilite/attestations");
  if (attestationId) revalidatePath(`/comptabilite/attestations/${attestationId}`);
  if (patientId) revalidatePath(`/patients/${patientId}`);
}

const NATURES: AttestationKind[] = ["presence", "paiement"];

/** Ouvre un brouillon d'attestation. Aucun numéro n'est consommé. */
export async function creerAttestation(fd: FormData): Promise<Resultat> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const patientId = id(fd, "patient_id");
  if (!patientId) {
    return {
      ok: false,
      error: "Une attestation concerne toujours quelqu'un : choisissez le dossier.",
    };
  }

  const kindBrut = String(fd.get("kind") ?? "presence");
  const kind = (NATURES as string[]).includes(kindBrut)
    ? (kindBrut as AttestationKind)
    : "presence";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attestations")
    .insert({
      practice_id: ctx.practice.practiceId,
      kind,
      patient_id: patientId,
      recipient_is_patient: true,
      status: "brouillon",
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: messageErreur(error) };
  rafraichir(undefined, patientId);
  return { ok: true, id: (data as { id: string }).id };
}

/** Enregistre l'en-tête d'un brouillon. La base refuse toute attestation émise. */
export async function enregistrerAttestation(fd: FormData): Promise<Resultat> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const attestationId = id(fd, "attestation_id");
  if (!attestationId) return { ok: false, error: "Attestation introuvable." };

  const debut = jourISO(fd, "period_start");
  if (!debut.ok) return { ok: false, error: debut.error };
  const fin = jourISO(fd, "period_end");
  if (!fin.ok) return { ok: false, error: fin.error };
  if (debut.value && fin.value && fin.value < debut.value) {
    return { ok: false, error: "La fin de période ne peut pas précéder son début." };
  }

  const destinataire = id(fd, "recipient_contact_id");
  const veutUnTiers = fd.get("destinataire_tiers") === "on";
  if (veutUnTiers && destinataire === null) {
    return {
      ok: false,
      error:
        "Vous avez choisi de remettre cette attestation à un tiers, mais aucun contact n'est sélectionné. Choisissez le destinataire, ou décochez la case.",
    };
  }

  const supabase = await createClient();
  const resultat = await supabase
    .from("attestations")
    .update({
      period_start: debut.value,
      period_end: fin.value,
      recipient_contact_id: destinataire,
      recipient_is_patient: destinataire === null,
      detail_nature: fd.get("detail_nature") === "on",
      note: str(fd, "note"),
      internal_note: str(fd, "internal_note"),
    })
    .eq("id", attestationId)
    .eq("practice_id", ctx.practice.practiceId)
    .select("id");

  const echec = rendreCompte(resultat, "l'attestation");
  if (echec) return echec;

  rafraichir(attestationId);
  return { ok: true, message: "Attestation enregistrée." };
}

/**
 * Rattache ou détache une séance.
 *
 * Le contrôle de ce qui est attestable est en base : issue « honoré », même
 * patient, temps de soin. L'action se contente de transmettre.
 */
export async function basculerSeanceAttestee(fd: FormData): Promise<Resultat> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const attestationId = id(fd, "attestation_id");
  const appointmentId = id(fd, "appointment_id");
  if (!attestationId || !appointmentId) {
    return { ok: false, error: "Séance introuvable." };
  }

  const supabase = await createClient();

  if (fd.get("action") === "retirer") {
    const resultat = await supabase
      .from("attestation_sessions")
      .delete()
      .eq("attestation_id", attestationId)
      .eq("appointment_id", appointmentId)
      .eq("practice_id", ctx.practice.practiceId)
      .select("appointment_id");
    const echec = rendreCompte(resultat, "le rattachement");
    if (echec) return echec;
  } else {
    const { error } = await supabase.from("attestation_sessions").insert({
      attestation_id: attestationId,
      appointment_id: appointmentId,
      practice_id: ctx.practice.practiceId,
    });
    if (error) return { ok: false, error: messageErreur(error) };
  }

  rafraichir(attestationId);
  return { ok: true };
}

/** Rattache ou détache un règlement, à hauteur de ce qui concerne ce patient. */
export async function basculerReglementAtteste(fd: FormData): Promise<Resultat> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const attestationId = id(fd, "attestation_id");
  const paymentId = id(fd, "payment_id");
  if (!attestationId || !paymentId) {
    return { ok: false, error: "Règlement introuvable." };
  }

  const supabase = await createClient();

  if (fd.get("action") === "retirer") {
    const resultat = await supabase
      .from("attestation_payments")
      .delete()
      .eq("attestation_id", attestationId)
      .eq("payment_id", paymentId)
      .eq("practice_id", ctx.practice.practiceId)
      .select("payment_id");
    const echec = rendreCompte(resultat, "le rattachement");
    if (echec) return echec;
  } else {
    const centimes = montant(fd, "amount");
    if (centimes === null || centimes <= 0) {
      return { ok: false, error: "Le montant attesté n'est pas lisible." };
    }
    const { error } = await supabase.from("attestation_payments").insert({
      attestation_id: attestationId,
      payment_id: paymentId,
      practice_id: ctx.practice.practiceId,
      amount_cents: centimes,
    });
    if (error) return { ok: false, error: messageErreur(error) };
  }

  rafraichir(attestationId);
  return { ok: true };
}

export async function supprimerBrouillonAttestation(
  fd: FormData,
): Promise<Resultat> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const attestationId = id(fd, "attestation_id");
  if (!attestationId) return { ok: false, error: "Attestation introuvable." };

  const supabase = await createClient();
  const resultat = await supabase
    .from("attestations")
    .delete()
    .eq("id", attestationId)
    .eq("practice_id", ctx.practice.practiceId)
    .select("id");

  const echec = rendreCompte(resultat, "le brouillon");
  if (echec) return echec;

  rafraichir();
  return { ok: true, message: "Brouillon supprimé." };
}

/**
 * Signe et numérote l'attestation.
 *
 * LE POINT DE NON-RETOUR. Après elle, plus rien ne se modifie : le document
 * peut déjà être entre les mains de son destinataire. Une erreur s'annule,
 * avec un motif, et s'atteste à nouveau.
 *
 * C'est la base qui vérifie que l'appelant est praticien : ce contrôle ne peut
 * pas vivre ici, où il dépendrait du chemin emprunté.
 */
export async function emettreAttestation(fd: FormData): Promise<Resultat> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const attestationId = id(fd, "attestation_id");
  if (!attestationId) return { ok: false, error: "Attestation introuvable." };

  const emission = jourISO(fd, "issued_on");
  if (!emission.ok) return { ok: false, error: emission.error };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("issue_attestation", {
    p_attestation_id: attestationId,
    p_issued_on: emission.value,
  });

  if (error) return { ok: false, error: messageErreur(error) };
  rafraichir(attestationId);
  return { ok: true, message: `Attestation signée sous le numéro ${String(data)}.` };
}

/**
 * Annule une attestation émise.
 *
 * Elle n'est pas supprimée : quelqu'un en détient peut-être une copie, et
 * faire disparaître le document ferait disparaître la trace de ce qui a été
 * affirmé.
 */
export async function annulerAttestation(fd: FormData): Promise<Resultat> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const attestationId = id(fd, "attestation_id");
  const motif = str(fd, "reason");
  if (!attestationId) return { ok: false, error: "Attestation introuvable." };
  if (!motif) {
    return {
      ok: false,
      error:
        "Indiquez pourquoi cette attestation est annulée : son destinataire peut en détenir une copie.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_attestation", {
    p_attestation_id: attestationId,
    p_reason: motif,
  });

  if (error) return { ok: false, error: messageErreur(error) };
  rafraichir(attestationId);
  return { ok: true, message: "Attestation annulée. Elle reste consultable." };
}
