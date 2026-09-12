import { ecritureReussie, requireActiveAccess } from "@/lib/auth/guard";
import { getCurrentPractice } from "@/lib/dossier/practice";
import { parseAmountToCents } from "@/lib/money";

/**
 * Le socle commun des Server Actions qui écrivent.
 *
 * POURQUOI IL EST SEUL. Chaque domaine avait sa copie de ces fonctions, et une
 * copie finit toujours par diverger de l'autre : le jour où l'une apprend à
 * distinguer un refus de la RLS d'une erreur de base, l'autre l'ignore encore.
 * « Comment une action rend compte de son échec » doit avoir UNE définition.
 *
 * Une Server Action est un point d'entrée HTTP comme un autre : elle ne
 * suppose rien de l'écran qui l'affiche, et refait ses propres contrôles.
 */

/* ==========================================================================
 *  Lecture des champs
 * ========================================================================== */

export function str(fd: FormData, k: string): string | null {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
}

export function id(fd: FormData, k: string): string | null {
  const v = str(fd, k);
  return v && /^[0-9a-f-]{36}$/i.test(v) ? v : null;
}

export function jourISO(
  fd: FormData,
  k: string,
): { ok: true; value: string | null } | { ok: false; error: string } {
  const v = str(fd, k);
  if (v === null) return { ok: true, value: null };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) {
    return { ok: false, error: "La date saisie n'est pas valide." };
  }
  return { ok: true, value: v };
}

/** Montant saisi en euros, rendu en centimes. `null` si la saisie est illisible. */
export function montant(fd: FormData, k: string): number | null {
  return parseAmountToCents(String(fd.get(k) ?? ""));
}

export interface Resultat {
  ok: boolean;
  error?: string;
  /** Identifiant de la pièce créée, quand l'action en crée une. */
  id?: string;
  message?: string;
}

export async function contexteEcriture() {
  const acces = await requireActiveAccess();
  if (!acces.ok) return { ok: false as const, error: acces.error };

  const practice = await getCurrentPractice();
  if (!practice) {
    return {
      ok: false as const,
      error: "Aucun cabinet n'est rattaché à votre compte.",
    };
  }
  if (!practice.canWrite) {
    return {
      ok: false as const,
      error: "Votre rôle ne permet pas de modifier les pièces comptables.",
    };
  }
  return { ok: true as const, practice };
}

/**
 * Rend compte d'une écriture, en conservant le message le plus précis.
 *
 * `ecritureReussie` distingue DEUX échecs : une erreur rendue par la base, et
 * ZÉRO LIGNE AFFECTÉE — qui est la façon dont la RLS refuse, sans lever
 * d'exception. La première version appelait toujours `messageErreur(error)`,
 * qui retombait sur un générique quand `error` était nul : c'est précisément
 * dans le cas « identifiant d'un autre cabinet » que le message le plus utile
 * était perdu.
 */
export function rendreCompte(
  resultat: { error: { message?: string; code?: string } | null; data?: unknown },
  quoi: string,
): Resultat | null {
  const verdict = ecritureReussie(resultat, quoi);
  if (verdict.ok) return null;
  return {
    ok: false,
    error: resultat.error ? messageErreur(resultat.error) : verdict.error,
  };
}


/**
 * Traduit l'erreur d'une base en phrase utile.
 *
 * Les messages des déclencheurs sont déjà écrits pour être lus par une
 * praticienne : ils expliquent le refus et disent quoi faire. On les transmet
 * tels quels. Seuls les codes techniques sont reformulés — un « 23505 » n'aide
 * personne.
 */
export function messageErreur(erreur: { message?: string; code?: string } | null): string {
  if (!erreur) return "L'enregistrement a échoué.";
  if (erreur.code === "23505") {
    return "Ce numéro est déjà porté par une autre pièce de ce cabinet.";
  }
  if (erreur.code === "42501" || erreur.code === "PGRST301") {
    return "Vous n'avez pas le droit d'effectuer cette opération.";
  }
  return erreur.message?.trim() || "L'enregistrement a échoué.";
}

