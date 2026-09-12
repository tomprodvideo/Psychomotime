import { createClient } from "@/lib/supabase/server";
import type { PracticeContext } from "@/lib/dossier/types";
import type { DocumentPublic, LienPartage, SujetPartage } from "./types";

/**
 * Lectures des transmissions.
 *
 * Aucune ne rend un jeton : la base n'en garde que l'empreinte, et rien ici ne
 * pourrait le reconstituer. C'est ce qui rend structurellement impossible le
 * défaut où tous les jetons d'un cabinet partaient dans la charge de la page.
 */

export interface LienListeResult {
  items: LienPartage[];
  erreur: string | null;
}

export async function listLiens(
  practice: PracticeContext,
  sujet?: { type: SujetPartage; id: string },
): Promise<LienListeResult> {
  const supabase = await createClient();
  let requete = supabase
    .from("shared_links")
    .select(
      "id, practice_id, subject_type, subject_id, token_hint, expires_at, " +
        "revoked_at, recipient_label, recipient_contact_id, access_count, " +
        "last_accessed_at, created_at",
    )
    .eq("practice_id", practice.practiceId);

  if (sujet) {
    requete = requete
      .eq("subject_type", sujet.type)
      .eq("subject_id", sujet.id);
  }

  const { data, error } = await requete
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[transmissions] lecture des liens refusée :", error);
    return {
      items: [],
      erreur:
        "La lecture des liens a échoué. Cette liste n'est pas celle de votre cabinet — ne concluez pas qu'aucun lien n'existe.",
    };
  }
  return { items: (data ?? []) as unknown as LienPartage[], erreur: null };
}

/**
 * Le document désigné par un jeton, vu par un destinataire sans compte.
 *
 * CHEMIN PUBLIC. Il n'y a pas de session, pas de cabinet courant, et la seule
 * preuve de droit est le jeton lui-même. La base rend `null` pour un jeton
 * inconnu, expiré ou révoqué, sans les distinguer.
 */
export async function getDocumentPublic(
  token: string,
): Promise<{ document: DocumentPublic | null; trop_de_consultations: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("shared_document", {
    p_token: token,
  });

  if (error) {
    // Le frein est le SEUL refus explicite : il ne survient qu'après qu'un
    // jeton valide a été présenté, donc le distinguer n'apprend rien à qui
    // tâtonne.
    const trop = error.code === "53300" || /grand nombre de fois/.test(error.message ?? "");
    if (!trop) {
      console.error("[transmissions] lecture publique refusée :", error.code);
    }
    return { document: null, trop_de_consultations: trop };
  }

  return {
    document: (data as DocumentPublic | null) ?? null,
    trop_de_consultations: false,
  };
}
