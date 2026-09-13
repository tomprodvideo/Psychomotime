import { createClient } from "@/lib/supabase/server";
import type { PracticeContext, PracticeRole } from "./types";
import { fuseauUtilisable } from "@/lib/dateCivile";

/**
 * Cabinet courant de l'utilisateur connecté.
 *
 * POURQUOI CE MODULE EXISTE. Le locataire du système était le compte. Il est
 * désormais le CABINET, et un utilisateur peut en théorie appartenir à
 * plusieurs. Tout ce qui lit ou écrit une donnée d'exercice doit donc savoir
 * « pour quel cabinet ». Cette fonction est le seul endroit qui répond.
 *
 * CE QU'ELLE N'EST PAS. Elle ne remplace pas la RLS : la base refuse déjà tout
 * accès hors du cabinet. Elle évite seulement d'avoir à le deviner côté serveur,
 * et permet d'afficher le bon écran plutôt qu'une liste vide.
 */

/** Le rôle donne-t-il le droit d'écrire les données d'exercice ? */
function canWrite(role: PracticeRole): boolean {
  return role === "owner" || role === "practitioner";
}

/**
 * Le rôle donne-t-il accès au contenu clinique ?
 *
 * Un assistant administratif voit les dossiers, les coordonnées et les
 * rendez-vous. Il ne voit ni les notes, ni les objectifs thérapeutiques. La
 * base l'applique déjà ; l'interface doit le savoir pour ne pas afficher des
 * sections vides sans explication.
 */
function canReadClinical(role: PracticeRole): boolean {
  return role === "owner" || role === "practitioner";
}

/**
 * Rend le cabinet courant, ou `null` si l'utilisateur n'appartient à aucun.
 *
 * `null` n'est pas une erreur : c'est l'état d'un compte tout juste créé, qui
 * doit être conduit vers la création de son cabinet.
 */
export async function getCurrentPractice(): Promise<PracticeContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // La RLS de `practice_members` ne laisse voir que les cabinets dont on est
  // membre actif : le filtre ci-dessous est une précision, pas la protection.
  const { data, error } = await supabase
    .from("practice_members")
    .select("id, role, practice_id, practices(id, name, timezone)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[cabinet] lecture de l'appartenance refusée :", error);
    return null;
  }
  if (!data) return null;

  // Supabase rend la relation imbriquée comme objet ou tableau selon la forme
  // de la requête ; on accepte les deux plutôt que de dépendre de l'une.
  const brut = data as unknown as {
    id: string;
    role: PracticeRole;
    practice_id: string;
    practices:
      | { id: string; name: string; timezone: string | null }
      | { id: string; name: string; timezone: string | null }[]
      | null;
  };
  const cabinet = Array.isArray(brut.practices) ? brut.practices[0] : brut.practices;

  return {
    practiceId: brut.practice_id,
    practiceName: cabinet?.name ?? "Cabinet",
    memberId: brut.id,
    role: brut.role,
    canWrite: canWrite(brut.role),
    canReadClinical: canReadClinical(brut.role),
    canAdminister: brut.role === "owner",
    timezone: fuseauUtilisable(cabinet?.timezone),
  };
}
