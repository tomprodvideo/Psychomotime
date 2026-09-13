import { createClient } from "@/lib/supabase/server";
import type { PracticeContext } from "@/lib/dossier/types";
import { liste } from "@/lib/liste";
import type { FaitsPeriode, Synthese } from "./types";

/**
 * Lectures des synthèses de suivi.
 *
 * MÊME RÈGLE QUE PARTOUT AILLEURS : une lecture qui échoue le DIT. Une liste
 * vide indiscernable d'une erreur ferait croire qu'aucune synthèse n'a été
 * écrite — exactement l'inverse de ce qu'il faut savoir avant d'en écrire une.
 */

export interface SyntheseAvecDestinataire extends Synthese {
  destinataire: {
    first_name: string | null;
    last_name: string | null;
    organisation_name: string | null;
    profession: string | null;
  } | null;
}

const COLONNES =
  "id, practice_id, patient_id, pathway_id, recipient_contact_id, " +
  "recipient_is_patient, period_start, period_end, means, observed_evolution, " +
  "adjustments, next_step, detail_absences, status, issued_on, note, internal_note, " +
  "cancellation_reason, snapshot, created_at, updated_at, " +
  "destinataire:contacts!follow_up_summaries_recipient_contact_id_fkey" +
  "(first_name, last_name, organisation_name, profession)";

export async function listSyntheses(
  practice: PracticeContext,
  patientId: string,
): Promise<{ items: SyntheseAvecDestinataire[]; erreur: string | null }> {
  /* Une synthèse de suivi est un contenu clinique : un assistant ne la lit
   * pas. La base le refuse aussi — ceci évite une requête pour rien. */
  if (!practice.canReadClinical) return { items: [], erreur: null };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("follow_up_summaries")
    .select(COLONNES)
    .eq("practice_id", practice.practiceId)
    .eq("patient_id", patientId)
    .order("period_end", { ascending: false });

  if (error) {
    console.error("[syntheses] lecture refusée :", error);
    return {
      items: [],
      erreur:
        "La lecture des synthèses a échoué. Cette liste n'est pas celle du dossier — n'en concluez pas qu'aucune synthèse n'a été écrite.",
    };
  }
  return { items: (data ?? []) as unknown as SyntheseAvecDestinataire[], erreur: null };
}

export async function getSynthese(
  practice: PracticeContext,
  id: string,
): Promise<SyntheseAvecDestinataire | null> {
  if (!practice.canReadClinical) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("follow_up_summaries")
    .select(COLONNES)
    .eq("id", id)
    .eq("practice_id", practice.practiceId)
    .maybeSingle();

  if (error) {
    console.error("[syntheses] lecture d'une synthèse refusée :", error);
    return null;
  }
  return (data as unknown as SyntheseAvecDestinataire) ?? null;
}

/**
 * Les faits de la période, CALCULÉS PAR LA BASE.
 *
 * C'est la même fonction que celle qu'appelle l'émission pour les figer. Il
 * n'y a donc aucun écart possible entre ce que la praticienne voit à l'écran
 * avant de remettre et ce qui part sur le document.
 *
 * ELLE PEUT ÉCHOUER, et c'est une information : un rôle sans lecture clinique,
 * un parcours qui n'est pas celui du dossier. On ne rend alors PAS des
 * compteurs à zéro — un zéro se lit comme « aucune séance », et ce serait
 * faux.
 */
export async function faitsDeLaPeriode(
  patientId: string,
  pathwayId: string | null,
  du: string,
  au: string,
): Promise<{ faits: FaitsPeriode | null; erreur: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("follow_up_facts", {
    p_patient_id: patientId,
    p_pathway_id: pathwayId,
    p_from: du,
    p_to: au,
  });

  if (error) {
    console.error("[syntheses] calcul des faits refusé :", error);
    return {
      faits: null,
      erreur:
        "Les éléments de la période n'ont pas pu être relevés. Ne complétez pas à la main : vérifiez le parcours choisi, puis recommencez.",
    };
  }

  const brut = (data ?? {}) as Partial<FaitsPeriode>;
  return {
    faits: {
      seances_honorees: Number(brut.seances_honorees ?? 0),
      absences: Number(brut.absences ?? 0),
      annulees_par_le_cabinet: Number(brut.annulees_par_le_cabinet ?? 0),
      honorees_sans_parcours: Number(brut.honorees_sans_parcours ?? 0),
      parcours_ouvert_le: brut.parcours_ouvert_le ?? null,
      objectifs: liste(brut.objectifs),
    },
    erreur: null,
  };
}
