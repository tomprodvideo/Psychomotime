"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ecritureReussie, requireActiveAccess, type Guarded } from "@/lib/auth/guard";
import { getCurrentPractice } from "@/lib/dossier/practice";
import type { LicenceStatus } from "@/lib/dossier/types";

/* ==========================================================================
 *  Lecture des champs
 * ========================================================================== */

function str(fd: FormData, k: string): string | null {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
}

function num(fd: FormData, k: string): number | null {
  const v = str(fd, k);
  if (v === null) return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function int(fd: FormData, k: string): number | null {
  const n = num(fd, k);
  return n === null ? null : Math.round(n);
}

function bool(fd: FormData, k: string): boolean {
  return fd.get(k) === "on" || fd.get(k) === "true";
}

function date(fd: FormData, k: string): string | null {
  const v = str(fd, k);
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

const STATUTS: LicenceStatus[] = [
  "reference_seule",
  "scores_saisis_par_le_praticien",
  "integration_editeur_autorisee",
  "outil_libre_valide",
];

async function contexteEcriture() {
  const acces = await requireActiveAccess();
  if (!acces.ok) return { ok: false as const, error: acces.error };
  const practice = await getCurrentPractice();
  if (!practice) {
    return { ok: false as const, error: "Aucun cabinet n'est rattaché à votre compte." };
  }
  if (!practice.canWrite) {
    return { ok: false as const, error: "Votre rôle ne permet pas de modifier le registre." };
  }
  return { ok: true as const, practice };
}

/**
 * Traduit les refus de la base.
 *
 * Les règles de licence sont énoncées une seule fois, en SQL. Ce qui se passe
 * ici est leur traduction en phrases utilisables — jamais leur duplication.
 */
function traduire(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("référence seule")) {
    return "Cet instrument est en « référence seule » : vous ne pouvez pas lui rattacher d'échelle. Écrivez vos résultats en texte libre, ou changez son statut de licence.";
  }
  if (m.includes("instruments_licence_editeur_ck")) {
    return "Un accord éditeur exige une référence, une date de vérification et le nom de la personne qui l'a vérifié. Sans les trois, ce n'est pas un accord.";
  }
  if (m.includes("instruments_licence_libre_ck")) {
    return "Un outil déclaré libre exige l'adresse de sa licence et la date à laquelle vous l'avez lue. « Librement accessible » n'est pas « libre de droits ».";
  }
  if (m.includes("instruments_age_ck")) {
    return "L'âge maximal annoncé doit être supérieur à l'âge minimal.";
  }
  if (m.includes("instrument_scales_bornes_ck")) {
    return "La borne haute de l'échelle doit être supérieure à la borne basse.";
  }
  if (m.includes("uq_scale_band_sets_actif")) {
    return "Un seul découpage peut être actif par échelle.";
  }
  if (m.includes("band_vocabulary_labels_vocabulary_id_text_key")) {
    return "Deux bandes ne peuvent pas porter le même mot : ce serait illisible sur un document.";
  }
  if (m.includes("scale_bands_bornes_ck")) {
    return "La borne haute d'une bande doit être supérieure à sa borne basse.";
  }
  return "L'enregistrement a échoué. Réessayez.";
}

/* ==========================================================================
 *  Instruments
 * ========================================================================== */

export async function saveInstrument(formData: FormData): Promise<Guarded<string>> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const name = str(formData, "name");
  if (!name) return { ok: false, error: "Donnez un nom à cet instrument." };

  const statut = (str(formData, "licence_status") ?? "reference_seule") as LicenceStatus;
  if (!STATUTS.includes(statut)) {
    return { ok: false, error: "Statut de licence inattendu." };
  }

  const data = {
    practice_id: ctx.practice.practiceId,
    name,
    publisher: str(formData, "publisher"),
    edition: str(formData, "edition"),
    form: str(formData, "form"),
    age_min_months: int(formData, "age_min_months"),
    age_max_months: int(formData, "age_max_months"),
    normative_population: str(formData, "normative_population"),
    domains: String(formData.get("domains") ?? "")
      .split(",")
      .map((d) => d.trim())
      .filter(Boolean),
    licence_status: statut,
    licence_scope: str(formData, "licence_scope"),
    licence_reference: str(formData, "licence_reference"),
    licence_url: str(formData, "licence_url"),
    licence_expires_on: date(formData, "licence_expires_on"),
    licence_checked_on: date(formData, "licence_checked_on"),
    licence_checked_by: str(formData, "licence_checked_by"),
    validity_warnings: str(formData, "validity_warnings"),
    note: str(formData, "note"),
    active: !formData.has("active_explicit") || bool(formData, "active"),
  };

  const id = str(formData, "id");
  const supabase = await createClient();
  const result = id
    ? await supabase.from("instruments").update(data).eq("id", id).select("id")
    : await supabase.from("instruments").insert(data).select("id");

  if (result.error) {
    console.error("[instruments] enregistrement refusé :", result.error);
    return { ok: false, error: traduire(result.error.message) };
  }
  const verdict = ecritureReussie(result, "L'instrument");
  if (!verdict.ok) return { ok: false, error: verdict.error };

  const savedId = (result.data?.[0] as { id: string } | undefined)?.id;
  revalidatePath("/parametres/instruments");
  return savedId
    ? { ok: true, value: savedId }
    : { ok: false, error: "L'instrument n'a pas pu être relu après enregistrement." };
}

export async function deleteInstrument(formData: FormData): Promise<Guarded<true>> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const id = str(formData, "id");
  if (!id) return { ok: false, error: "Instrument introuvable." };

  const supabase = await createClient();
  const result = await supabase
    .from("instruments")
    .delete()
    .eq("id", id)
    .select("id");

  const verdict = ecritureReussie(result, "L'instrument");
  if (!verdict.ok) return verdict;

  revalidatePath("/parametres/instruments");
  return { ok: true, value: true };
}

/* ==========================================================================
 *  Échelles
 * ========================================================================== */

export async function saveScale(formData: FormData): Promise<Guarded<string>> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const instrumentId = str(formData, "instrument_id");
  const name = str(formData, "name");
  if (!instrumentId) return { ok: false, error: "Instrument introuvable." };
  if (!name) return { ok: false, error: "Donnez un nom à cette échelle." };

  const data = {
    practice_id: ctx.practice.practiceId,
    instrument_id: instrumentId,
    name,
    result_type: str(formData, "result_type") ?? "brut",
    mean: num(formData, "mean"),
    sd: num(formData, "sd"),
    min_value: num(formData, "min_value"),
    max_value: num(formData, "max_value"),
    decimals: int(formData, "decimals") ?? 0,
    direction: str(formData, "direction") ?? "non_oriente",
    note: str(formData, "note"),
  };

  const id = str(formData, "id");
  const supabase = await createClient();
  const result = id
    ? await supabase.from("instrument_scales").update(data).eq("id", id).select("id")
    : await supabase.from("instrument_scales").insert(data).select("id");

  if (result.error) {
    console.error("[instruments] échelle refusée :", result.error);
    return { ok: false, error: traduire(result.error.message) };
  }
  const verdict = ecritureReussie(result, "L'échelle");
  if (!verdict.ok) return { ok: false, error: verdict.error };

  const savedId = (result.data?.[0] as { id: string } | undefined)?.id;
  revalidatePath("/parametres/instruments");
  return savedId
    ? { ok: true, value: savedId }
    : { ok: false, error: "L'échelle n'a pas pu être relue après enregistrement." };
}

/* ==========================================================================
 *  Vocabulaires
 * ========================================================================== */

export async function saveVocabulary(formData: FormData): Promise<Guarded<string>> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const name = str(formData, "name");
  if (!name) return { ok: false, error: "Donnez un nom à ce vocabulaire." };

  const usage = str(formData, "usage") === "document_remis" ? "document_remis" : "interne";
  const validePar = str(formData, "validated_by");

  // Un vocabulaire imprimé sur un document remis à une famille doit être
  // assumé par quelqu'un. Le logiciel ne valide pas à la place du praticien.
  if (usage === "document_remis" && !validePar) {
    return {
      ok: false,
      error:
        "Un vocabulaire destiné à un document remis doit porter le nom de la personne qui l'assume. Tant qu'il n'est pas validé, ses mots ne sortiront pas du cabinet.",
    };
  }

  const mots = String(formData.get("labels") ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (mots.length < 2) {
    return { ok: false, error: "Indiquez au moins deux mots, un par ligne." };
  }
  if (new Set(mots.map((m) => m.toLowerCase())).size !== mots.length) {
    return {
      ok: false,
      error:
        "Deux bandes portent le même mot. Ce serait illisible sur un document et indécidable sur un graphique.",
    };
  }

  const supabase = await createClient();
  const id = str(formData, "id");
  const data = {
    practice_id: ctx.practice.practiceId,
    name,
    usage,
    validated_by: validePar,
    validated_on: usage === "document_remis" ? (date(formData, "validated_on") ?? new Date().toISOString().slice(0, 10)) : null,
    note: str(formData, "note"),
  };

  const result = id
    ? await supabase.from("band_vocabularies").update(data).eq("id", id).select("id")
    : await supabase.from("band_vocabularies").insert(data).select("id");

  if (result.error) {
    console.error("[instruments] vocabulaire refusé :", result.error);
    return { ok: false, error: traduire(result.error.message) };
  }
  const savedId = (result.data?.[0] as { id: string } | undefined)?.id;
  if (!savedId) return { ok: false, error: "Le vocabulaire n'a pas pu être relu." };

  // Les mots sont remplacés en bloc : les clés restent b1..bN, et un découpage
  // qui les référence continue de fonctionner.
  await supabase.from("band_vocabulary_labels").delete().eq("vocabulary_id", savedId);
  const lignes = mots.map((texte, i) => ({
    practice_id: ctx.practice.practiceId,
    vocabulary_id: savedId,
    key: `b${i + 1}`,
    text: texte,
  }));
  const insertion = await supabase
    .from("band_vocabulary_labels")
    .insert(lignes)
    .select("id");

  if (insertion.error) {
    console.error("[instruments] mots refusés :", insertion.error);
    return { ok: false, error: traduire(insertion.error.message) };
  }

  revalidatePath("/parametres/instruments");
  return { ok: true, value: savedId };
}

/* ==========================================================================
 *  Découpages
 * ========================================================================== */

/**
 * Enregistre un découpage et ses bandes.
 *
 * Il n'est PAS activé ici : c'est `activate_band_set` qui le valide d'abord,
 * en base, et qui refuse un découpage à trou ou à chevauchement.
 */
export async function saveBandSet(formData: FormData): Promise<Guarded<string>> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const scaleId = str(formData, "scale_id");
  const vocabularyId = str(formData, "vocabulary_id");
  const source = str(formData, "source");
  if (!scaleId) return { ok: false, error: "Échelle introuvable." };
  if (!vocabularyId) return { ok: false, error: "Choisissez un vocabulaire." };
  if (!source) {
    return {
      ok: false,
      error:
        "Indiquez d'où vient ce découpage. Un chiffre coloré sans source est une affirmation sans fondement.",
    };
  }

  let bandes: {
    lower: number | null;
    upper: number | null;
    lowerInc: boolean;
    upperInc: boolean;
    key: string;
    colour: string | null;
  }[];
  try {
    bandes = JSON.parse(String(formData.get("bands") ?? "[]"));
  } catch {
    return { ok: false, error: "Le découpage saisi n'a pas pu être lu." };
  }
  if (!Array.isArray(bandes) || bandes.length === 0) {
    return { ok: false, error: "Indiquez au moins une bande." };
  }

  const supabase = await createClient();
  const setResult = await supabase
    .from("scale_band_sets")
    .insert({
      practice_id: ctx.practice.practiceId,
      scale_id: scaleId,
      vocabulary_id: vocabularyId,
      version: str(formData, "version") ?? `v${Date.now().toString().slice(-4)}`,
      origin: str(formData, "origin") ?? "convention_praticien",
      source,
      source_checked_on: date(formData, "source_checked_on"),
    })
    .select("id");

  if (setResult.error) {
    console.error("[instruments] découpage refusé :", setResult.error);
    return { ok: false, error: traduire(setResult.error.message) };
  }
  const setId = (setResult.data?.[0] as { id: string } | undefined)?.id;
  if (!setId) return { ok: false, error: "Le découpage n'a pas pu être relu." };

  const lignes = bandes.map((b, i) => ({
    practice_id: ctx.practice.practiceId,
    band_set_id: setId,
    position: i + 1,
    lower_bound: b.lower,
    lower_inclusive: b.lowerInc,
    upper_bound: b.upper,
    upper_inclusive: b.upperInc,
    label_key: b.key,
    colour: b.colour,
  }));

  const bandesResult = await supabase.from("scale_bands").insert(lignes).select("id");
  if (bandesResult.error) {
    console.error("[instruments] bandes refusées :", bandesResult.error);
    return { ok: false, error: traduire(bandesResult.error.message) };
  }

  revalidatePath("/parametres/instruments");
  return { ok: true, value: setId };
}

/**
 * Rend un découpage actif.
 *
 * La validation a lieu EN BASE : un découpage à trou ou à chevauchement est
 * refusé, avec la liste exacte des problèmes. C'est ce qui empêche de
 * reproduire le défaut d'origine, où la valeur 7 tombait dans deux bandes.
 */
export async function activateBandSet(formData: FormData): Promise<Guarded<true>> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const id = str(formData, "id");
  if (!id) return { ok: false, error: "Découpage introuvable." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("activate_band_set", {
    p_band_set_id: id,
    p_validated_by: str(formData, "validated_by"),
  });

  if (error) {
    console.error("[instruments] activation refusée :", error);
    // Le message de la base ÉNUMÈRE les problèmes : il est utile tel quel,
    // contrairement à un message de contrainte.
    return { ok: false, error: error.message };
  }

  revalidatePath("/parametres/instruments");
  return { ok: true, value: true };
}
