import { createClient } from "@/lib/supabase/server";
import type { PracticeContext } from "@/lib/dossier/types";
import { etatDesAccords } from "./types";
import type { Courrier, EtatConsentement } from "./types";

/**
 * Lectures des courriers de liaison.
 *
 * MÊME RÈGLE QUE PARTOUT AILLEURS : une lecture qui échoue le DIT. Un résultat
 * vide indiscernable d'une erreur ferait croire qu'aucun courrier n'a été
 * écrit — exactement l'inverse de ce qu'il faut savoir quand on cherche ce
 * qu'on a déjà transmis à un confrère.
 */

export interface CourrierAvecDestinataire extends Courrier {
  destinataire: {
    first_name: string | null;
    last_name: string | null;
    organisation_name: string | null;
    profession: string | null;
  } | null;
}

const COLONNES =
  "id, practice_id, patient_id, pathway_id, recipient_contact_id, subject, " +
  "body, status, issued_on, internal_note, cancellation_reason, snapshot, " +
  "created_at, updated_at, " +
  "destinataire:contacts!liaison_letters_recipient_contact_id_fkey" +
  "(first_name, last_name, organisation_name, profession)";

export async function listCourriers(
  practice: PracticeContext,
  patientId: string,
): Promise<{ items: CourrierAvecDestinataire[]; erreur: string | null }> {
  /* Un courrier de liaison est un contenu clinique : un assistant ne le lit
   * pas. La base le refuse aussi — ceci évite une requête pour rien. */
  if (!practice.canReadClinical) return { items: [], erreur: null };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("liaison_letters")
    .select(COLONNES)
    .eq("practice_id", practice.practiceId)
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[courriers] lecture refusée :", error);
    return {
      items: [],
      erreur:
        "La lecture des courriers a échoué. Cette liste n'est pas celle du dossier — n'en concluez pas qu'aucun courrier n'a été écrit.",
    };
  }
  return { items: (data ?? []) as unknown as CourrierAvecDestinataire[], erreur: null };
}

export async function getCourrier(
  practice: PracticeContext,
  id: string,
): Promise<CourrierAvecDestinataire | null> {
  if (!practice.canReadClinical) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("liaison_letters")
    .select(COLONNES)
    .eq("id", id)
    .eq("practice_id", practice.practiceId)
    .maybeSingle();

  if (error) {
    console.error("[courriers] lecture d'un courrier refusée :", error);
    return null;
  }
  return (data as unknown as CourrierAvecDestinataire) ?? null;
}

/**
 * L'accord de partage avec les professionnels, pour ce dossier.
 *
 * Un accord RETIRÉ l'emporte sur un accord donné : c'est la dernière volonté
 * exprimée qui compte, pas la première.
 *
 * UN ACCORD SANS DATE D'ACCORD N'EST PAS UN ACCORD. `granted_on` est nullable,
 * et cette fonction ne le lisait pas : une ligne créée sans date — un
 * formulaire préparé, un accord attendu — faisait afficher « un accord de
 * partage est enregistré pour ce dossier », juste au-dessus du bouton qui
 * remet le document.
 *
 * Le produit a fait le choix assumé de DIRE sans EXIGER [D-i]. Ce choix ne
 * tient que si ce qui est dit est exact : le seul garde-fou du dispositif
 * pouvait affirmer le contraire de la réalité.
 *
 * Trouvé par la relecture protection des données du rang 3.
 */
export async function etatConsentementPartage(
  practice: PracticeContext,
  patientId: string,
): Promise<EtatConsentement> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patient_consents")
    .select("kind, granted_on, withdrawn_on")
    .eq("practice_id", practice.practiceId)
    .eq("patient_id", patientId)
    .in("kind", [
      "partage_professionnels",
      "partage_etablissement",
      "transmission_prescripteur",
    ]);

  if (error) {
    console.error("[courriers] lecture des consentements refusée :", error);
    return "absent";
  }
  const lignes = (data ?? []) as {
    granted_on: string | null;
    withdrawn_on: string | null;
  }[];
  return etatDesAccords(lignes);
}

