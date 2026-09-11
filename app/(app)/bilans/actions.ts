"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  ecritureReussie,
  requireActiveAccess,
  requireUser,
  type Guarded,
} from "@/lib/auth/guard";

function str(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

/**
 * NOTE SUR LES REPLIS SUPPRIMÉS.
 *
 * Ce fichier réessayait l'écriture sans la colonne `tests` lorsque PostgREST
 * répondait PGRST204 ou 42703 — c'est-à-dire lorsqu'une migration n'était pas
 * appliquée. L'enregistrement « réussissait » alors EN PERDANT les résultats
 * d'épreuves, et l'éditeur affichait « Enregistré ✓ ».
 *
 * Vérification du 2026-09-11 sur la base de production : `bilans.tests` existe.
 * Le repli ne protégeait donc plus rien, il ne faisait que masquer de vraies
 * erreurs. Une colonne manquante est un défaut de déploiement : elle doit
 * échouer franchement, pas se traduire par une perte de données silencieuse.
 */

export async function createBilan(formData: FormData) {
  const acces = await requireActiveAccess();
  if (!acces.ok) redirect("/login");
  const { user } = acces.value;

  const supabase = await createClient();
  const type =
    String(formData.get("bilan_type") ?? "") === "sensoriel"
      ? "sensoriel"
      : "psychomoteur";
  const payload = {
    patient_id: str(formData.get("patient_id")),
    patient_name: String(formData.get("patient_name") ?? "").trim(),
    title: str(formData.get("title")) ?? "Bilan psychomoteur",
    bilan_date: str(formData.get("bilan_date")),
    author: str(formData.get("author")),
    content: { __type__: type },
    tests: {},
  };

  // Garde-fou anti-doublon : si un brouillon identique vient d'être créé
  // (double clic sur « Créer », requête rejouée par le navigateur…), on rouvre
  // celui-là au lieu d'insérer une nouvelle ligne.
  const since = new Date(Date.now() - 15_000).toISOString();
  const { data: recent } = await supabase
    .from("bilans")
    .select("id")
    .eq("user_id", user.id)
    .eq("patient_name", payload.patient_name)
    .eq("title", payload.title)
    .eq("status", "brouillon")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recent?.id) redirect(`/bilans/${recent.id}`);

  const { data, error } = await supabase
    .from("bilans")
    .insert(payload)
    .select("id")
    .single();

  if (error || !data?.id) {
    console.error("[bilans] création refusée :", error);
    redirect("/bilans?erreur=creation");
  }

  revalidatePath("/bilans");
  redirect(`/bilans/${data.id}`);
}

/**
 * Enregistre un bilan.
 *
 * Rend un résultat explicite plutôt que rien : c'est ce qui permet à l'éditeur
 * de distinguer « enregistré » de « pas enregistré ». Une passation saisie en
 * séance et perdue, c'est une séance à refaire et un enfant reparti.
 */
export async function saveBilan(formData: FormData): Promise<Guarded<true>> {
  const acces = await requireActiveAccess();
  if (!acces.ok) return acces;

  const id = str(formData.get("id"));
  if (!id) return { ok: false, error: "Bilan introuvable." };

  // Un contenu illisible n'est pas un contenu vide : l'écraser par `{}`
  // effacerait le bilan. On refuse plutôt que d'enregistrer une perte.
  let content: Record<string, string>;
  let tests: Record<string, unknown>;
  try {
    content = JSON.parse(String(formData.get("content") ?? "{}"));
    tests = JSON.parse(String(formData.get("tests") ?? "{}"));
  } catch (e) {
    console.error("[bilans] contenu illisible :", e);
    return {
      ok: false,
      error:
        "Le contenu du bilan n'a pas pu être lu et n'a donc PAS été enregistré. Ne fermez pas cet onglet : copiez votre texte ailleurs avant toute autre action.",
    };
  }

  const payload = {
    patient_id: str(formData.get("patient_id")),
    patient_name: String(formData.get("patient_name") ?? "").trim(),
    title: str(formData.get("title")) ?? "Bilan psychomoteur",
    bilan_date: str(formData.get("bilan_date")),
    author: str(formData.get("author")),
    status: str(formData.get("status")) ?? "brouillon",
    content,
    tests,
    updated_at: new Date().toISOString(),
  };

  // `.select("id")` est indispensable : sans lui, un refus de la RLS ne lève
  // aucune erreur et se manifeste seulement par zéro ligne affectée.
  const supabase = await createClient();
  const result = await supabase
    .from("bilans")
    .update(payload)
    .eq("id", id)
    .select("id");

  const verdict = ecritureReussie(result, "Le bilan");
  if (!verdict.ok) return verdict;

  revalidatePath(`/bilans/${id}`);
  revalidatePath("/bilans");
  return { ok: true, value: true };
}

export async function saveAdaptationLibrary(
  templates: {
    id: string;
    title: string;
    text: string;
    folder?: string | null;
  }[],
  folders: { id: string; name: string }[],
  type: "psychomoteur" | "sensoriel" = "psychomoteur",
): Promise<Guarded<true>> {
  const acces = await requireActiveAccess();
  if (!acces.ok) return acces;
  const { user } = acces.value;

  const supabase = await createClient();
  const { data: s, error: lecture } = await supabase
    .from("settings")
    .select("profile")
    .eq("user_id", user.id)
    .maybeSingle();

  if (lecture) {
    console.error("[modèles] lecture des paramètres refusée :", lecture);
    return {
      ok: false,
      error: "Vos paramètres n'ont pas pu être lus. Réessayez.",
    };
  }

  const tKey =
    type === "sensoriel"
      ? "adaptation_templates_sensoriel"
      : "adaptation_templates";
  const fKey =
    type === "sensoriel"
      ? "adaptation_folders_sensoriel"
      : "adaptation_folders";
  const profile = {
    ...((s?.profile as Record<string, unknown>) ?? {}),
    [tKey]: templates,
    [fKey]: folders,
  };

  const result = await supabase
    .from("settings")
    .upsert({
      user_id: user.id,
      profile,
      updated_at: new Date().toISOString(),
    })
    .select("user_id");

  const verdict = ecritureReussie(result, "La bibliothèque de modèles");
  if (!verdict.ok) return verdict;

  revalidatePath("/bilans");
  revalidatePath("/parametres");
  return { ok: true, value: true };
}

export async function deleteBilan(formData: FormData) {
  const session = await requireUser();
  if (!session.ok) redirect("/login");

  const id = str(formData.get("id"));
  if (!id) redirect("/bilans");

  const supabase = await createClient();
  const result = await supabase
    .from("bilans")
    .delete()
    .eq("id", id)
    .select("id");

  const verdict = ecritureReussie(result, "Le bilan");
  revalidatePath("/bilans");
  redirect(verdict.ok ? "/bilans" : "/bilans?erreur=suppression");
}

/** Suppression définitive d'un bilan depuis la liste (pas de redirection). */
export async function deleteBilanById(id: string): Promise<Guarded<true>> {
  const session = await requireUser();
  if (!session.ok) return session;
  if (!id) return { ok: false, error: "Bilan introuvable." };

  const supabase = await createClient();
  // La ligne « bilans » porte tout le contenu (content + tests en jsonb) :
  // la supprimer efface définitivement l'intégralité du bilan.
  const result = await supabase
    .from("bilans")
    .delete()
    .eq("id", id)
    .select("id");

  const verdict = ecritureReussie(result, "Le bilan");
  if (!verdict.ok) return verdict;

  revalidatePath("/bilans");
  return { ok: true, value: true };
}
