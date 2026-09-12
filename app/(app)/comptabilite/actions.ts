"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ecritureReussie, requireActiveAccess } from "@/lib/auth/guard";
import { getCurrentPractice } from "@/lib/dossier/practice";
import { parseAmountToCents } from "@/lib/money";
import { getReglagesCompta } from "@/lib/compta/queries";
import type {
  BillingFundingScheme,
  DateRender,
  DocumentKind,
  ServicePricing,
} from "@/lib/compta/types";

/**
 * Écritures comptables.
 *
 * CE QUI N'EST PAS ICI, ET POURQUOI. Aucune de ces actions n'attribue de numéro,
 * ne fige d'instantané ni ne vérifie l'immuabilité d'une pièce émise : tout cela
 * vit dans la base, en déclencheurs et en fonctions. Une Server Action est un
 * point d'entrée HTTP parmi d'autres ; faire porter à l'interface une garantie
 * comptable reviendrait à la perdre le jour où un autre appelant écrit dans la
 * même table. Ce fichier prépare, transmet, et rend compte de ce que la base a
 * accepté ou refusé.
 */

/* ==========================================================================
 *  Lecture des champs
 * ========================================================================== */

function str(fd: FormData, k: string): string | null {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
}

function id(fd: FormData, k: string): string | null {
  const v = str(fd, k);
  return v && /^[0-9a-f-]{36}$/i.test(v) ? v : null;
}

function jourISO(
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
function montant(fd: FormData, k: string): number | null {
  return parseAmountToCents(String(fd.get(k) ?? ""));
}

export interface Resultat {
  ok: boolean;
  error?: string;
  /** Identifiant de la pièce créée, quand l'action en crée une. */
  id?: string;
  message?: string;
}

async function contexteEcriture() {
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
function rendreCompte(
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

function rafraichir(documentId?: string) {
  revalidatePath("/comptabilite");
  if (documentId) revalidatePath(`/comptabilite/${documentId}`);
}

/**
 * Traduit l'erreur d'une base en phrase utile.
 *
 * Les messages des déclencheurs sont déjà écrits pour être lus par une
 * praticienne : ils expliquent le refus et disent quoi faire. On les transmet
 * tels quels. Seuls les codes techniques sont reformulés — un « 23505 » n'aide
 * personne.
 */
function messageErreur(erreur: { message?: string; code?: string } | null): string {
  if (!erreur) return "L'enregistrement a échoué.";
  if (erreur.code === "23505") {
    return "Ce numéro est déjà porté par une autre pièce de ce cabinet.";
  }
  if (erreur.code === "42501" || erreur.code === "PGRST301") {
    return "Vous n'avez pas le droit d'effectuer cette opération.";
  }
  return erreur.message?.trim() || "L'enregistrement a échoué.";
}

/* ==========================================================================
 *  Pièces
 * ========================================================================== */

const NATURES: DocumentKind[] = [
  "devis",
  "facture",
  "facture_de_remplacement",
  "avoir",
];

/** Ouvre un brouillon. Aucun numéro n'est consommé : c'est l'émission qui le fait. */
export async function creerPiece(fd: FormData): Promise<Resultat> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const kindBrut = String(fd.get("kind") ?? "facture");
  const kind = (NATURES as string[]).includes(kindBrut)
    ? (kindBrut as DocumentKind)
    : "facture";

  if (kind === "avoir" || kind === "facture_de_remplacement") {
    return {
      ok: false,
      error:
        "Un avoir ou une facture de remplacement se crée depuis la pièce qu'il rectifie.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("billing_documents")
    .insert({
      practice_id: ctx.practice.practiceId,
      kind,
      patient_id: id(fd, "patient_id"),
      payer_is_patient: true,
      status: "brouillon",
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: messageErreur(error) };
  rafraichir();
  return { ok: true, id: (data as { id: string }).id };
}

/** Enregistre l'en-tête d'un brouillon. La base refusera toute pièce émise. */
export async function enregistrerPiece(fd: FormData): Promise<Resultat> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const documentId = id(fd, "document_id");
  if (!documentId) return { ok: false, error: "Pièce introuvable." };

  const echeance = jourISO(fd, "due_on");
  if (!echeance.ok) return { ok: false, error: echeance.error };
  const debut = jourISO(fd, "period_start");
  if (!debut.ok) return { ok: false, error: debut.error };
  const fin = jourISO(fd, "period_end");
  if (!fin.ok) return { ok: false, error: fin.error };
  const validite = jourISO(fd, "valid_until");
  if (!validite.ok) return { ok: false, error: validite.error };

  if (debut.value && fin.value && fin.value < debut.value) {
    return {
      ok: false,
      error: "La fin de période ne peut pas précéder son début.",
    };
  }

  const payeurContact = id(fd, "payer_contact_id");
  const financement = str(fd, "funding_scheme");

  /* « Adresser à un tiers » coché SANS contact choisi produisait une facture au
   * nom du patient — donc, pour un enfant suivi, une facture au nom du mineur,
   * alors que l'écran affichait le contraire. L'intention est postée
   * explicitement, et l'incohérence est refusée au lieu d'être arbitrée. */
  const veutUnTiers = fd.get("payer_tiers") === "on";
  if (veutUnTiers && payeurContact === null) {
    return {
      ok: false,
      error:
        "Vous avez choisi d'adresser cette pièce à un tiers, mais aucun contact n'est sélectionné. Choisissez le destinataire, ou décochez la case.",
    };
  }

  const supabase = await createClient();
  const resultat = await supabase
    .from("billing_documents")
    .update({
      patient_id: id(fd, "patient_id"),
      pathway_id: id(fd, "pathway_id"),
      payer_contact_id: payeurContact,
      payer_is_patient: payeurContact === null,
      funding_scheme: financement as BillingFundingScheme | null,
      due_on: echeance.value,
      period_start: debut.value,
      period_end: fin.value,
      valid_until: validite.value,
      note: str(fd, "note"),
      internal_note: str(fd, "internal_note"),
    })
    .eq("id", documentId)
    .eq("practice_id", ctx.practice.practiceId)
    .select("id");

  const echec = rendreCompte(resultat, "la pièce");
  if (echec) return echec;
  rafraichir(documentId);
  return { ok: true, message: "Pièce enregistrée." };
}

/** Supprime un brouillon. La base refuse toute pièce émise. */
export async function supprimerBrouillon(fd: FormData): Promise<Resultat> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const documentId = id(fd, "document_id");
  if (!documentId) return { ok: false, error: "Pièce introuvable." };

  const supabase = await createClient();
  const resultat = await supabase
    .from("billing_documents")
    .delete()
    .eq("id", documentId)
    .eq("practice_id", ctx.practice.practiceId)
    .select("id");

  const echec = rendreCompte(resultat, "le brouillon");
  if (echec) return echec;
  rafraichir();
  return { ok: true, message: "Brouillon supprimé." };
}

/**
 * Émet une pièce : numéro, date, instantané.
 *
 * LE POINT DE NON-RETOUR. Après lui, plus rien ne se modifie — la correction
 * passe par un avoir ou une facture de remplacement. Le gabarit de numérotation
 * vient des réglages du cabinet : ne pas le transmettre changerait la forme des
 * numéros sans que personne ne l'ait demandé.
 */
export async function emettrePiece(fd: FormData): Promise<Resultat> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const documentId = id(fd, "document_id");
  if (!documentId) return { ok: false, error: "Pièce introuvable." };

  const emission = jourISO(fd, "issued_on");
  if (!emission.ok) return { ok: false, error: emission.error };

  const reglages = await getReglagesCompta(ctx.practice);
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("issue_billing_document", {
    p_document_id: documentId,
    p_series: null,
    p_number_format: reglages.gabarit_numero,
    p_issued_on: emission.value,
  });

  if (error) return { ok: false, error: messageErreur(error) };
  rafraichir(documentId);
  return {
    ok: true,
    message: `Pièce émise sous le numéro ${String(data)}.`,
  };
}

/**
 * Ouvre un avoir ou une facture de remplacement rectifiant une pièce émise.
 *
 * La référence à la pièce corrigée — numéro ET date — est recopiée dès la
 * création, et la base exige qu'elle y soit.
 * [SOURCE] CGI art. 289, I, 5 : la pièce rectificative doit faire référence à
 * la facture initiale « de façon spécifique et non équivoque ».
 */
export async function creerRectification(fd: FormData): Promise<Resultat> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const cibleId = id(fd, "document_id");
  if (!cibleId) return { ok: false, error: "Pièce introuvable." };

  const kindBrut = String(fd.get("kind") ?? "avoir");
  const kind: DocumentKind =
    kindBrut === "facture_de_remplacement" ? "facture_de_remplacement" : "avoir";

  const motif = str(fd, "rectification_reason");
  if (!motif) {
    return {
      ok: false,
      error:
        "Indiquez le motif de la rectification : il figurera sur la pièce et explique pourquoi la précédente est corrigée.",
    };
  }

  const supabase = await createClient();
  const { data: cible, error: erreurCible } = await supabase
    .from("billing_documents")
    .select(
      "id, kind, status, number, issued_on, patient_id, pathway_id, " +
        "payer_contact_id, payer_is_patient, funding_scheme, " +
        "period_start, period_end, total_cents",
    )
    .eq("id", cibleId)
    .eq("practice_id", ctx.practice.practiceId)
    .maybeSingle();

  if (erreurCible || !cible) {
    return { ok: false, error: "Pièce introuvable." };
  }
  const c = cible as unknown as {
    kind: DocumentKind;
    status: string;
    number: string | null;
    issued_on: string | null;
    patient_id: string | null;
    pathway_id: string | null;
    payer_contact_id: string | null;
    payer_is_patient: boolean;
    funding_scheme: BillingFundingScheme | null;
    period_start: string | null;
    period_end: string | null;
    total_cents: number;
  };

  if (c.kind === "devis") {
    return { ok: false, error: "Un devis ne se rectifie pas : il se refuse." };
  }
  if (c.status === "brouillon" || !c.number || !c.issued_on) {
    return {
      ok: false,
      error: "Une pièce non émise se modifie directement, sans rectification.",
    };
  }

  const { data, error } = await supabase
    .from("billing_documents")
    .insert({
      practice_id: ctx.practice.practiceId,
      kind,
      patient_id: c.patient_id,
      pathway_id: c.pathway_id,
      payer_contact_id: c.payer_contact_id,
      payer_is_patient: c.payer_is_patient,
      funding_scheme: c.funding_scheme,
      period_start: c.period_start,
      period_end: c.period_end,
      status: "brouillon",
      rectifies_id: cibleId,
      rectifies_number: c.number,
      rectifies_issued_on: c.issued_on,
      rectification_reason: motif,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: messageErreur(error) };

  const nouveau = (data as { id: string }).id;

  // Les lignes de la pièce corrigée sont recopiées : un avoir total est le cas
  // courant, et repartir d'une page blanche obligerait à retaper ce que la
  // pièce initiale dit déjà. Elles restent modifiables tant que le brouillon
  // n'est pas émis — un avoir partiel se fait en les ajustant.
  const { data: lignes } = await supabase
    .from("billing_lines")
    .select(
      "position, catalog_item_id, label, nature, pricing, unit_price_cents, " +
        "quantity, amount_cents, service_dates, date_render, vat_treatment, " +
        "vat_rate_bp, intro, note",
    )
    .eq("document_id", cibleId)
    .order("position", { ascending: true });

  const aRecopier = (lignes ?? []) as unknown as Record<string, unknown>[];
  if (aRecopier.length > 0) {
    const { data: creees } = await supabase
      .from("billing_lines")
      .insert(
        aRecopier.map((l) => {
          const { id: _ancienId, ...reste } = l;
          void _ancienId;
          return {
            ...reste,
            practice_id: ctx.practice.practiceId,
            document_id: nouveau,
          };
        }),
      )
      .select("id, position");

    /* UNE FACTURE DE REMPLACEMENT REPREND LES SÉANCES DE CELLE QU'ELLE REMPLACE.
     *
     * Sans cela, les séances restaient accrochées à la pièce remplacée, et
     * `listSeancesFacturables` les excluait pour toujours : la remplaçante
     * naissait sans rattachement, le sélecteur de séances était vide, et rien
     * ne le disait. La future attestation de présence aurait alors suivi une
     * pièce annulée.
     *
     * Un AVOIR, lui, ne reprend rien : il ne facture aucune séance, il en
     * défait la facturation. */
    if (kind === "facture_de_remplacement" && creees) {
      const { data: liens } = await supabase
        .from("billing_line_appointments")
        .select("appointment_id, billing_lines!inner(position)")
        .eq("practice_id", ctx.practice.practiceId)
        .in("line_id", aRecopier.map((l) => l.id as string));

      const parPosition = new Map(
        (creees as { id: string; position: number }[]).map((l) => [l.position, l.id]),
      );
      const aRattacher = ((liens ?? []) as unknown as {
        appointment_id: string;
        billing_lines: { position: number } | null;
      }[])
        .map((r) => ({
          line_id: r.billing_lines
            ? parPosition.get(r.billing_lines.position)
            : undefined,
          appointment_id: r.appointment_id,
          practice_id: ctx.practice.practiceId,
        }))
        .filter((r): r is { line_id: string; appointment_id: string; practice_id: string } =>
          Boolean(r.line_id));

      if (aRattacher.length > 0) {
        await supabase.from("billing_line_appointments").insert(aRattacher);
      }
    }
  }

  rafraichir(cibleId);
  return { ok: true, id: nouveau };
}

/** Devis accepté, refusé ou expiré. Ces trois états ne touchent pas au numéro. */
export async function changerEtatDevis(fd: FormData): Promise<Resultat> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const documentId = id(fd, "document_id");
  const etat = String(fd.get("status") ?? "");
  if (!documentId) return { ok: false, error: "Pièce introuvable." };
  if (!["accepte", "refuse", "expire", "emis"].includes(etat)) {
    return { ok: false, error: "État inconnu." };
  }

  const supabase = await createClient();
  const resultat = await supabase
    .from("billing_documents")
    .update({ status: etat })
    .eq("id", documentId)
    .eq("practice_id", ctx.practice.practiceId)
    .eq("kind", "devis")
    .select("id");

  const echec = rendreCompte(resultat, "le devis");
  if (echec) return echec;
  rafraichir(documentId);
  return { ok: true };
}

/* ==========================================================================
 *  Lignes
 * ========================================================================== */

const PRICINGS: ServicePricing[] = ["unitaire", "forfait"];
const RENDERS: DateRender[] = ["liste", "par_date"];

/**
 * Ajoute ou modifie une ligne.
 *
 * LE MONTANT EST RECALCULÉ ICI, jamais repris du formulaire. Un montant posté
 * par le navigateur serait un montant que personne n'a vérifié.
 */
export async function enregistrerLigne(fd: FormData): Promise<Resultat> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const documentId = id(fd, "document_id");
  if (!documentId) return { ok: false, error: "Pièce introuvable." };

  const ligneId = id(fd, "line_id");
  const libelle = str(fd, "label");
  if (!libelle) {
    return { ok: false, error: "Une ligne doit porter un libellé." };
  }

  const prixBrut = montant(fd, "unit_price");
  if (prixBrut === null) {
    return {
      ok: false,
      error: "Le montant saisi n'est pas lisible. Exemple attendu : 45,00",
    };
  }

  const pricingBrut = String(fd.get("pricing") ?? "unitaire");
  const pricing: ServicePricing = (PRICINGS as string[]).includes(pricingBrut)
    ? (pricingBrut as ServicePricing)
    : "unitaire";

  const renderBrut = String(fd.get("date_render") ?? "liste");
  const dateRender: DateRender = (RENDERS as string[]).includes(renderBrut)
    ? (renderBrut as DateRender)
    : "liste";

  // Au forfait la quantité vaut toujours 1 : le prix ne se multiplie pas.
  const quantiteBrute = Number(fd.get("quantity") ?? 1);
  const quantite =
    pricing === "forfait"
      ? 1
      : Math.max(1, Math.floor(Number.isFinite(quantiteBrute) ? quantiteBrute : 1));

  const dates = String(fd.get("service_dates") ?? "")
    .split(/[,\s]+/)
    .map((d) => d.trim())
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();

  // Une ligne au prix unitaire affichée « par date » doit avoir autant de dates
  // que de séances facturées : imprimer trois séances sous une seule date
  // produirait un document faux sans que personne ne le voie.
  if (dateRender === "par_date" && pricing === "unitaire" && dates.length > 0 && dates.length !== quantite) {
    return {
      ok: false,
      error: `Vous facturez ${quantite} séance(s) mais avez indiqué ${dates.length} date(s). Corrigez l'un ou l'autre.`,
    };
  }

  const champs = {
    practice_id: ctx.practice.practiceId,
    document_id: documentId,
    catalog_item_id: id(fd, "catalog_item_id"),
    label: libelle,
    nature: str(fd, "nature") ?? "seance",
    pricing,
    unit_price_cents: prixBrut,
    quantity: quantite,
    amount_cents: pricing === "forfait" ? prixBrut : prixBrut * quantite,
    service_dates: dates,
    date_render: dateRender,
    intro: str(fd, "intro"),
    note: str(fd, "note_ligne"),
  };

  const supabase = await createClient();

  if (ligneId) {
    // `document_id` est RETIRÉ des champs modifiés et AJOUTÉ au filtre : sans
    // cela, poster la ligne d'une pièce et l'identifiant d'une autre faisait
    // basculer la ligne — et les déclencheurs recalculaient les deux totaux.
    // La garde de cohérence empêchait le passage d'un cabinet à l'autre, pas
    // le déplacement entre deux brouillons du même cabinet.
    const { document_id: _ignore, ...champsModifiables } = champs;
    void _ignore;
    const resultat = await supabase
      .from("billing_lines")
      .update(champsModifiables)
      .eq("id", ligneId)
      .eq("document_id", documentId)
      .eq("practice_id", ctx.practice.practiceId)
      .select("id");
    if (!ecritureReussie(resultat, "la ligne").ok) {
      return { ok: false, error: messageErreur(resultat.error) };
    }
    rafraichir(documentId);
    return { ok: true, id: ligneId };
  }

  const { data: derniere } = await supabase
    .from("billing_lines")
    .select("position")
    .eq("document_id", documentId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const position = ((derniere as { position: number } | null)?.position ?? 0) + 1;

  const { data, error } = await supabase
    .from("billing_lines")
    .insert({ ...champs, position })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: messageErreur(error) };

  // Rattachement aux séances, si l'écran en a proposé.
  const seances = fd
    .getAll("appointment_id")
    .map((v) => String(v))
    .filter((v) => /^[0-9a-f-]{36}$/i.test(v));

  if (seances.length > 0) {
    const ligne = (data as { id: string }).id;
    const { error: erreurLien } = await supabase
      .from("billing_line_appointments")
      .insert(
        seances.map((appointment_id) => ({
          line_id: ligne,
          appointment_id,
          practice_id: ctx.practice.practiceId,
        })),
      );
    if (erreurLien) {
      // La ligne existe, le rattachement non. On le dit plutôt que de laisser
      // croire que les séances sont désormais marquées comme facturées.
      return {
        ok: true,
        id: ligne,
        message:
          "Ligne ajoutée, mais le rattachement aux séances a échoué : " +
          messageErreur(erreurLien),
      };
    }
  }

  rafraichir(documentId);
  return { ok: true, id: (data as { id: string }).id };
}

export async function supprimerLigne(fd: FormData): Promise<Resultat> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const ligneId = id(fd, "line_id");
  const documentId = id(fd, "document_id");
  if (!ligneId) return { ok: false, error: "Ligne introuvable." };

  const supabase = await createClient();
  const resultat = await supabase
    .from("billing_lines")
    .delete()
    .eq("id", ligneId)
    .eq("practice_id", ctx.practice.practiceId)
    .select("id");

  const echec = rendreCompte(resultat, "la ligne");
  if (echec) return echec;
  rafraichir(documentId ?? undefined);
  return { ok: true };
}

/* ==========================================================================
 *  Règlements
 * ========================================================================== */

/**
 * Enregistre un règlement et l'impute sur une pièce.
 *
 * Le règlement existe par lui-même, puis s'affecte. C'est ce qui permet un
 * paiement groupé, un règlement partiel, et de voir un trop-perçu pour ce
 * qu'il est : une part non affectée, et non un solde négatif inexpliqué.
 */
export async function enregistrerReglement(fd: FormData): Promise<Resultat> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const documentId = id(fd, "document_id");
  const recu = jourISO(fd, "received_on");
  if (!recu.ok) return { ok: false, error: recu.error };

  const centimes = montant(fd, "amount");
  if (centimes === null || centimes === 0) {
    return {
      ok: false,
      error: "Le montant du règlement n'est pas lisible. Exemple attendu : 45,00",
    };
  }
  if (centimes < 0) {
    return {
      ok: false,
      error: "Un remboursement s'enregistre depuis la pièce concernée, pas ici.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .insert({
      practice_id: ctx.practice.practiceId,
      received_on: recu.value ?? new Date().toISOString().slice(0, 10),
      amount_cents: centimes,
      method: str(fd, "method") ?? "autre",
      reference: str(fd, "reference"),
      note: str(fd, "note"),
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: messageErreur(error) };
  const paiement = (data as { id: string }).id;

  if (!documentId) {
    rafraichir();
    return { ok: true, message: "Règlement enregistré, non affecté." };
  }

  const aAffecter = montant(fd, "allocated") ?? centimes;
  const { error: erreurAffectation } = await supabase
    .from("payment_allocations")
    .insert({
      practice_id: ctx.practice.practiceId,
      payment_id: paiement,
      document_id: documentId,
      amount_cents: aAffecter,
    });

  if (erreurAffectation) {
    // Le règlement est enregistré : le passer sous silence le rendrait
    // invisible alors que l'argent, lui, a bien été reçu.
    return {
      ok: true,
      message:
        "Règlement enregistré, mais non imputé sur la pièce : " +
        messageErreur(erreurAffectation),
    };
  }

  rafraichir(documentId);
  return { ok: true, message: "Règlement enregistré." };
}

/** Défait une imputation. Le règlement, lui, reste : l'argent a été reçu. */
export async function retirerAffectation(fd: FormData): Promise<Resultat> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const allocationId = id(fd, "allocation_id");
  const documentId = id(fd, "document_id");
  if (!allocationId) return { ok: false, error: "Imputation introuvable." };

  const supabase = await createClient();
  const resultat = await supabase
    .from("payment_allocations")
    .delete()
    .eq("id", allocationId)
    .eq("practice_id", ctx.practice.practiceId)
    .select("id");

  const echec = rendreCompte(resultat, "l'imputation");
  if (echec) return echec;
  rafraichir(documentId ?? undefined);
  return {
    ok: true,
    message: "Imputation retirée. Le règlement reste enregistré, non affecté.",
  };
}

/* ==========================================================================
 *  Catalogue
 * ========================================================================== */

export async function enregistrerPrestation(fd: FormData): Promise<Resultat> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const libelle = str(fd, "label");
  if (!libelle) return { ok: false, error: "Une prestation doit porter un nom." };

  const prix = montant(fd, "unit_price");
  if (prix === null || prix < 0) {
    return { ok: false, error: "Le tarif n'est pas lisible. Exemple : 45,00" };
  }

  const pricingBrut = String(fd.get("pricing") ?? "unitaire");
  const renderBrut = String(fd.get("default_date_render") ?? "liste");

  const champs = {
    practice_id: ctx.practice.practiceId,
    label: libelle,
    unit_price_cents: prix,
    pricing: (PRICINGS as string[]).includes(pricingBrut) ? pricingBrut : "unitaire",
    nature: str(fd, "nature") ?? "seance",
    default_intro: str(fd, "default_intro"),
    default_date_render: (RENDERS as string[]).includes(renderBrut)
      ? renderBrut
      : "liste",
    // Une case décochée n'est PAS postée : `fd.get("active")` vaut alors `null`,
    // et `null !== "false"` valait `true`. Décocher ne désactivait donc rien.
    // Le formulaire poste désormais la valeur explicitement.
    active: fd.get("active") === "true",
  };

  const supabase = await createClient();
  const prestationId = id(fd, "item_id");

  const resultat = prestationId
    ? await supabase
        .from("service_catalog_items")
        .update(champs)
        .eq("id", prestationId)
        .eq("practice_id", ctx.practice.practiceId)
        .select("id")
    : await supabase.from("service_catalog_items").insert(champs).select("id");

  const echec = rendreCompte(resultat, "la prestation");
  if (echec) return echec;
  revalidatePath("/comptabilite/catalogue");
  return { ok: true, message: "Prestation enregistrée." };
}

/**
 * Retire une prestation du catalogue.
 *
 * La désactivation est proposée d'abord, et c'est volontaire : les factures
 * déjà établies ne changent pas — leurs lignes ont recopié le tarif — mais
 * supprimer l'entrée fait perdre la PROVENANCE des lignes qui en venaient.
 */
export async function supprimerPrestation(fd: FormData): Promise<Resultat> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const prestationId = id(fd, "item_id");
  if (!prestationId) return { ok: false, error: "Prestation introuvable." };

  const supabase = await createClient();
  const resultat = await supabase
    .from("service_catalog_items")
    .delete()
    .eq("id", prestationId)
    .eq("practice_id", ctx.practice.practiceId)
    .select("id");

  const echec = rendreCompte(resultat, "la prestation");
  if (echec) return echec;
  revalidatePath("/comptabilite/catalogue");
  return { ok: true, message: "Prestation supprimée du catalogue." };
}

/* ==========================================================================
 *  Charges
 * ========================================================================== */

const CATEGORIES = [
  "loyer", "retrocession", "cotisations", "assurance", "materiel",
  "formation", "deplacement", "logiciel", "honoraires", "autre",
];

export async function enregistrerCharge(fd: FormData): Promise<Resultat> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const centimes = montant(fd, "amount");
  if (centimes === null || centimes < 0) {
    return { ok: false, error: "Le montant n'est pas lisible. Exemple : 383,33" };
  }

  const paye = jourISO(fd, "spent_on");
  if (!paye.ok) return { ok: false, error: paye.error };
  if (!paye.value) {
    // Une charge sans date n'entre dans aucune période, donc dans aucun total.
    return { ok: false, error: "Indiquez la date du décaissement." };
  }

  const categorieBrute = String(fd.get("category") ?? "autre");
  const champs = {
    practice_id: ctx.practice.practiceId,
    category: CATEGORIES.includes(categorieBrute) ? categorieBrute : "autre",
    label: str(fd, "label"),
    amount_cents: centimes,
    spent_on: paye.value,
    note: str(fd, "note"),
  };

  const supabase = await createClient();
  const chargeId = id(fd, "charge_id");
  const resultat = chargeId
    ? await supabase
        .from("practice_expenses")
        .update(champs)
        .eq("id", chargeId)
        .eq("practice_id", ctx.practice.practiceId)
        .select("id")
    : await supabase.from("practice_expenses").insert(champs).select("id");

  const echec = rendreCompte(resultat, "la charge");
  if (echec) return echec;
  revalidatePath("/comptabilite/charges");
  revalidatePath("/comptabilite");
  return { ok: true, message: "Charge enregistrée." };
}

export async function supprimerCharge(fd: FormData): Promise<Resultat> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const chargeId = id(fd, "charge_id");
  if (!chargeId) return { ok: false, error: "Charge introuvable." };

  const supabase = await createClient();
  const resultat = await supabase
    .from("practice_expenses")
    .delete()
    .eq("id", chargeId)
    .eq("practice_id", ctx.practice.practiceId)
    .select("id");

  const echec = rendreCompte(resultat, "la charge");
  if (echec) return echec;
  revalidatePath("/comptabilite/charges");
  revalidatePath("/comptabilite");
  return { ok: true, message: "Charge supprimée." };
}

/**
 * Enregistre une charge récurrente.
 *
 * Une récurrence est un MODÈLE daté, pas un montant. Sa date de début est
 * obligatoire : sans elle, modifier un loyer réécrirait rétroactivement toutes
 * les années passées — le défaut exact de la version précédente, où les
 * récurrences vivaient dans un JSON sans période d'application.
 */
export async function enregistrerRecurrence(fd: FormData): Promise<Resultat> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const libelle = str(fd, "label");
  if (!libelle) return { ok: false, error: "Une charge récurrente doit porter un nom." };

  const centimes = montant(fd, "amount");
  if (centimes === null || centimes < 0) {
    return { ok: false, error: "Le montant n'est pas lisible. Exemple : 21,50" };
  }

  const debut = jourISO(fd, "starts_on");
  if (!debut.ok) return { ok: false, error: debut.error };
  if (!debut.value) {
    return {
      ok: false,
      error:
        "Indiquez à partir de quand cette charge s'applique : sans date de début, elle vaudrait aussi pour les années déjà closes.",
    };
  }
  const fin = jourISO(fd, "ends_on");
  if (!fin.ok) return { ok: false, error: fin.error };
  if (fin.value && fin.value < debut.value) {
    return { ok: false, error: "La fin ne peut pas précéder le début." };
  }

  const categorieBrute = String(fd.get("category") ?? "autre");
  const champs = {
    practice_id: ctx.practice.practiceId,
    category: CATEGORIES.includes(categorieBrute) ? categorieBrute : "autre",
    label: libelle,
    amount_cents: centimes,
    period: fd.get("period") === "annuel" ? "annuel" : "mensuel",
    starts_on: debut.value,
    ends_on: fin.value,
    // Une case décochée n'est PAS postée : `fd.get("active")` vaut alors `null`,
    // et `null !== "false"` valait `true`. Décocher ne désactivait donc rien.
    // Le formulaire poste désormais la valeur explicitement.
    active: fd.get("active") === "true",
  };

  const supabase = await createClient();
  const recurrenceId = id(fd, "recurrence_id");
  const resultat = recurrenceId
    ? await supabase
        .from("expense_recurrences")
        .update(champs)
        .eq("id", recurrenceId)
        .eq("practice_id", ctx.practice.practiceId)
        .select("id")
    : await supabase.from("expense_recurrences").insert(champs).select("id");

  const echec = rendreCompte(resultat, "la charge récurrente");
  if (echec) return echec;
  revalidatePath("/comptabilite/charges");
  return { ok: true, message: "Charge récurrente enregistrée." };
}

export async function supprimerRecurrence(fd: FormData): Promise<Resultat> {
  const ctx = await contexteEcriture();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const recurrenceId = id(fd, "recurrence_id");
  if (!recurrenceId) return { ok: false, error: "Charge récurrente introuvable." };

  const supabase = await createClient();
  const resultat = await supabase
    .from("expense_recurrences")
    .delete()
    .eq("id", recurrenceId)
    .eq("practice_id", ctx.practice.practiceId)
    .select("id");

  const echec = rendreCompte(resultat, "la charge récurrente");
  if (echec) return echec;
  revalidatePath("/comptabilite/charges");
  return {
    ok: true,
    message:
      "Charge récurrente supprimée. Les décaissements déjà saisis sont conservés.",
  };
}
