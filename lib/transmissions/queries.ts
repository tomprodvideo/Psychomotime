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

/** Un lien, accompagné de la pièce vers laquelle il pointe. */
export interface LienAvecSujet extends LienPartage {
  sujet: {
    titre: string;
    numero: string | null;
    patient: string | null;
    href: string;
  } | null;
}

/**
 * Tous les liens du cabinet, avec ce vers quoi ils pointent.
 *
 * POURQUOI CET ÉCRAN EXISTE. Un lien ne se consultait que depuis la pièce qu'il
 * partage. Pour savoir ce qui est ouvert en ce moment, il fallait donc ouvrir
 * les pièces une à une — c'est-à-dire ne jamais le savoir. Or c'est exactement
 * la question qu'on se pose le jour où quelque chose ne va pas : qu'est-ce qui
 * est accessible dehors, et depuis quand.
 *
 * DEUX REQUÊTES, PAS UNE PAR LIGNE. Les pièces et les attestations sont
 * chargées en deux lots, par leurs identifiants. Le contraire — une lecture par
 * lien — est le défaut que le lot 8 traque ailleurs ; il n'y a pas de raison de
 * l'introduire ici.
 */
export async function listLiensDuCabinet(
  practice: PracticeContext,
): Promise<{ items: LienAvecSujet[]; erreur: string | null }> {
  const { items, erreur } = await listLiens(practice);
  if (erreur || items.length === 0) return { items: [], erreur };

  const supabase = await createClient();
  const idsPieces = items
    .filter((l) => l.subject_type === "billing_document")
    .map((l) => l.subject_id);
  const idsAttestations = items
    .filter((l) => l.subject_type === "attestation")
    .map((l) => l.subject_id);

  const [pieces, attestations] = await Promise.all([
    idsPieces.length
      ? supabase
          .from("billing_documents")
          .select("id, kind, number, snapshot")
          .in("id", idsPieces)
      : Promise.resolve({ data: [], error: null }),
    idsAttestations.length
      ? supabase
          .from("attestations")
          .select("id, kind, number, snapshot")
          .in("id", idsAttestations)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const TITRES: Record<string, string> = {
    devis: "Devis",
    facture: "Facture",
    facture_de_remplacement: "Facture de remplacement",
    avoir: "Avoir",
    presence: "Attestation de présence",
    paiement: "Attestation de paiement",
  };

  type Brut = {
    id: string;
    kind: string;
    number: string | null;
    snapshot: { patient?: { nom?: string | null } | null } | null;
  };
  const index = new Map<string, LienAvecSujet["sujet"]>();
  for (const r of (pieces.data ?? []) as unknown as Brut[]) {
    index.set(r.id, {
      titre: TITRES[r.kind] ?? "Document",
      numero: r.number,
      patient: r.snapshot?.patient?.nom?.trim() || null,
      href: `/comptabilite/${r.id}`,
    });
  }
  for (const r of (attestations.data ?? []) as unknown as Brut[]) {
    index.set(r.id, {
      titre: TITRES[r.kind] ?? "Attestation",
      numero: r.number,
      patient: r.snapshot?.patient?.nom?.trim() || null,
      href: `/comptabilite/attestations/${r.id}`,
    });
  }

  return {
    items: items.map((l) => ({ ...l, sujet: index.get(l.subject_id) ?? null })),
    erreur: null,
  };
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
