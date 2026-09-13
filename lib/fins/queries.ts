import { createClient } from "@/lib/supabase/server";
import type { PracticeContext } from "@/lib/dossier/types";
import { liste } from "@/lib/liste";
import type { FaitsEpisode, Fin } from "./types";

/**
 * Lectures des écrits de fin de prise en soin.
 *
 * MÊME RÈGLE QUE PARTOUT AILLEURS : une lecture qui échoue le DIT. Une liste
 * vide indiscernable d'une erreur ferait croire qu'aucun écrit n'a été remis —
 * et c'est exactement ce qu'il faut savoir avant d'en écrire un autre.
 */

export interface FinAvecDestinataire extends Fin {
  destinataire: {
    first_name: string | null;
    last_name: string | null;
    organisation_name: string | null;
    profession: string | null;
  } | null;
}

const COLONNES =
  "id, practice_id, patient_id, pathway_id, closure_kind, delivery_mode, " +
  "recipient_contact_id, context, means, observed, closure_reason, " +
  "remains_open, handover, resumption, detail_objectifs, detail_absences, " +
  "detail_financement, status, issued_on, note, internal_note, " +
  "cancellation_reason, snapshot, created_at, updated_at, " +
  "destinataire:contacts!closure_reports_recipient_contact_id_fkey" +
  "(first_name, last_name, organisation_name, profession)";

export async function listFins(
  practice: PracticeContext,
  patientId: string,
): Promise<{ items: FinAvecDestinataire[]; erreur: string | null }> {
  if (!practice.canReadClinical) return { items: [], erreur: null };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("closure_reports")
    .select(COLONNES)
    .eq("practice_id", practice.practiceId)
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[fins] lecture refusée :", error);
    return {
      items: [],
      erreur:
        "La lecture des écrits de fin a échoué. Cette liste n'est pas celle du dossier — n'en concluez pas qu'aucun écrit n'a été remis.",
    };
  }
  return { items: (data ?? []) as unknown as FinAvecDestinataire[], erreur: null };
}

export async function getFin(
  practice: PracticeContext,
  id: string,
): Promise<FinAvecDestinataire | null> {
  if (!practice.canReadClinical) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("closure_reports")
    .select(COLONNES)
    .eq("id", id)
    .eq("practice_id", practice.practiceId)
    .maybeSingle();

  if (error) {
    console.error("[fins] lecture d'un écrit refusée :", error);
    return null;
  }
  return (data as unknown as FinAvecDestinataire) ?? null;
}

/**
 * Les faits de l'épisode, CALCULÉS PAR LA BASE.
 *
 * C'est la même fonction que celle qu'appelle l'émission pour les figer. Il
 * n'y a donc aucun écart possible entre ce qu'elle voit avant de remettre et
 * ce qui part sur le document.
 *
 * ELLE PEUT ÉCHOUER, et c'est une information. On ne rend alors PAS des
 * compteurs à zéro : un zéro se lit « aucune séance », et ce serait faux.
 */
export async function faitsDeLEpisode(
  pathwayId: string,
): Promise<{ faits: FaitsEpisode | null; erreur: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("closure_facts", {
    p_pathway_id: pathwayId,
  });

  if (error) {
    console.error("[fins] calcul des faits refusé :", error);
    return {
      faits: null,
      erreur:
        "Les éléments de l'épisode n'ont pas pu être relevés. Ne complétez pas à la main : vérifiez le parcours choisi, puis recommencez.",
    };
  }

  const brut = (data ?? {}) as Partial<FaitsEpisode>;
  return {
    faits: {
      parcours: brut.parcours ?? {},
      seances_honorees: Number(brut.seances_honorees ?? 0),
      derniere_seance_le: brut.derniere_seance_le ?? null,
      absences: Number(brut.absences ?? 0),
      annulees_par_le_cabinet: Number(brut.annulees_par_le_cabinet ?? 0),
      financement: brut.financement ?? null,
      prescripteur: brut.prescripteur ?? null,
      objectifs: liste(brut.objectifs),
      honorees_sans_parcours: Number(brut.honorees_sans_parcours ?? 0),
      rendez_vous_a_venir: Number(brut.rendez_vous_a_venir ?? 0),
      objectifs_en_cours: Number(brut.objectifs_en_cours ?? 0),
      motif_demande_a_reprendre: brut.motif_demande_a_reprendre ?? null,
      fin_du_parcours_a_reprendre: brut.fin_du_parcours_a_reprendre ?? null,
    },
    erreur: null,
  };
}
