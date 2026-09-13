import { createClient } from "@/lib/supabase/server";
import type { PracticeContext } from "@/lib/dossier/types";
import { liste } from "@/lib/liste";
import type { EcritTiers, FaitsTiers } from "./types";

/**
 * Lectures des écrits destinés à un tiers non soignant.
 *
 * MÊME RÈGLE QUE PARTOUT : une lecture qui échoue le DIT. Une liste vide
 * indiscernable d'une erreur ferait croire qu'aucun écrit n'est parti chez un
 * tiers — et c'est exactement ce qu'il faut savoir avant d'en écrire un autre.
 */

export interface EcritTiersAvecDestinataire extends EcritTiers {
  destinataire: {
    first_name: string | null;
    last_name: string | null;
    organisation_name: string | null;
    profession: string | null;
  } | null;
}

const COLONNES =
  "id, practice_id, patient_id, pathway_id, intended_use, delivery_mode, " +
  "recipient_contact_id, context, observation_setting, observed, daily_impact, " +
  "what_helps, proposals, limits_note, detail_scores, detail_objectifs, " +
  "detail_seances, detail_prescripteur, detail_professionnels, professionnels, " +
  "consent_override_reason, status, issued_on, note, internal_note, " +
  "cancellation_reason, snapshot, created_at, updated_at, " +
  "destinataire:contacts!third_party_reports_recipient_contact_id_fkey" +
  "(first_name, last_name, organisation_name, profession)";

export async function listEcritsTiers(
  practice: PracticeContext,
  patientId: string,
): Promise<{ items: EcritTiersAvecDestinataire[]; erreur: string | null }> {
  if (!practice.canReadClinical) return { items: [], erreur: null };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("third_party_reports")
    .select(COLONNES)
    .eq("practice_id", practice.practiceId)
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[tiers] lecture refusée :", error);
    return {
      items: [],
      erreur:
        "La lecture des écrits destinés à un tiers a échoué. Cette liste n'est pas celle du dossier — n'en concluez pas qu'aucun écrit n'est parti.",
    };
  }
  return {
    items: (data ?? []) as unknown as EcritTiersAvecDestinataire[],
    erreur: null,
  };
}

export async function getEcritTiers(
  practice: PracticeContext,
  id: string,
): Promise<EcritTiersAvecDestinataire | null> {
  if (!practice.canReadClinical) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("third_party_reports")
    .select(COLONNES)
    .eq("id", id)
    .eq("practice_id", practice.practiceId)
    .maybeSingle();

  if (error) {
    console.error("[tiers] lecture d'un écrit refusée :", error);
    return null;
  }
  return (data as unknown as EcritTiersAvecDestinataire) ?? null;
}

/**
 * Les faits, CALCULÉS PAR LA BASE — la même fonction que celle de l'émission.
 *
 * Elle porte aussi l'état de l'accord de partage, pour que l'écran le montre
 * AVANT qu'elle écrive : un refus au moment de remettre, sur un écrit déjà
 * rédigé, est un refus qui arrive trop tard.
 */
export async function faitsPourTiers(
  patientId: string,
  pathwayId: string | null,
): Promise<{ faits: FaitsTiers | null; erreur: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("third_party_report_facts", {
    p_patient_id: patientId,
    p_pathway_id: pathwayId,
  });

  if (error) {
    console.error("[tiers] calcul des faits refusé :", error);
    return {
      faits: null,
      erreur:
        "Les éléments du dossier n'ont pas pu être relevés. Ne complétez pas à la main : vérifiez le parcours choisi, puis recommencez.",
    };
  }

  const brut = (data ?? {}) as Partial<FaitsTiers>;
  return {
    faits: {
      premiere_seance_le: brut.premiere_seance_le ?? null,
      derniere_seance_le: brut.derniere_seance_le ?? null,
      seances_honorees: Number(brut.seances_honorees ?? 0),
      prescripteur: brut.prescripteur ?? null,
      objectifs: liste(brut.objectifs),
      motif_demande_a_reprendre: brut.motif_demande_a_reprendre ?? null,
      honorees_hors_parcours: Number(brut.honorees_hors_parcours ?? 0),
      accord_partage: brut.accord_partage ?? "absent",
    },
    erreur: null,
  };
}
