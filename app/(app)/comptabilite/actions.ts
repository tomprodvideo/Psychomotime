"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data";
import { computeInvoice } from "@/lib/calc";
import { MONTHS } from "@/lib/constants";
import { emailConfig, sendMail } from "@/lib/email";
import { newShareToken, shareExpiry } from "@/lib/invoiceShare";
import { siteOrigin } from "@/lib/siteOrigin";
import {
  invoiceLinesTotal,
  normalizeInvoiceLines,
  validateInvoiceLines,
} from "@/lib/invoiceLines";
import type { Invoice, Patient, Settings } from "@/lib/types";
import {
  buildInvoiceNumber,
  counterScope,
  DEFAULT_INVOICE_FORMAT,
  nextSeq,
  splitFormat,
} from "@/lib/invoiceNumber";

function num(v: FormDataEntryValue | null): number {
  if (v == null) return 0;
  const n = parseFloat(String(v).replace(",", ".").replace(/[^\d.-]/g, ""));
  return isNaN(n) ? 0 : n;
}

function str(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

type Numbering = {
  format: string;
  scope: string;
  /** Plus grand rang déjà présent dans les factures (amorçage du compteur). */
  floor: number;
  ctx: { year: number; month: number };
};

/** Rassemble tout ce qu'il faut pour numéroter une facture de cette période. */
async function numbering(
  supabase: Awaited<ReturnType<typeof createClient>>,
  year: number,
  month: number,
): Promise<Numbering> {
  const settings = await getSettings();
  const format =
    settings.profile?.invoice_number_format?.trim() || DEFAULT_INVOICE_FORMAT;
  const ctx = { year, month };
  const { prefix, suffix } = splitFormat(format, ctx);

  const { data } = await supabase.from("invoices").select("invoice_number");
  const floor =
    nextSeq(
      (data ?? []).map((r) => r.invoice_number as string | null),
      prefix,
      suffix,
    ) - 1;

  return { format, scope: counterScope(format, ctx), floor, ctx };
}

/**
 * Prochain numéro disponible pour la période donnée — LECTURE SEULE.
 * Sert à l'aperçu dans le formulaire : ouvrir puis annuler ne consomme aucun
 * numéro, ce qui éviterait des trous dans la série.
 */
export async function nextInvoiceNumber(
  year: number,
  month: number,
): Promise<string> {
  const supabase = await createClient();
  const n = await numbering(supabase, year, month);

  const { data: counter } = await supabase
    .from("invoice_counters")
    .select("last_seq")
    .eq("scope", n.scope)
    .maybeSingle();

  const seq = Math.max(counter?.last_seq ?? 0, n.floor) + 1;
  return buildInvoiceNumber(n.format, n.ctx, seq);
}

/**
 * Réserve définitivement le numéro suivant. Le compteur est incrémenté côté
 * base de façon atomique : un numéro attribué ne sera jamais réutilisé, même
 * si la facture est supprimée ensuite.
 */
async function reserveInvoiceNumber(
  supabase: Awaited<ReturnType<typeof createClient>>,
  year: number,
  month: number,
): Promise<string> {
  const n = await numbering(supabase, year, month);

  const { data: seq, error } = await supabase.rpc("next_invoice_seq", {
    p_scope: n.scope,
    p_min: n.floor,
  });

  // Repli si la migration 010 n'a pas encore été lancée : on retombe sur le
  // plus grand numéro existant + 1 (sans garantie contre la réutilisation).
  if (error || typeof seq !== "number") {
    return buildInvoiceNumber(n.format, n.ctx, n.floor + 1);
  }
  return buildInvoiceNumber(n.format, n.ctx, seq);
}

/**
 * Message unique d'échec d'écriture. Volontairement sans identifiant, sans nom
 * de patient, sans montant et sans détail technique : il est affiché tel quel
 * dans le formulaire.
 */
const SAVE_FAILED_MESSAGE =
  "L'enregistrement n'a pas abouti. Votre saisie est toujours à l'écran : réessayez dans un instant.";

/**
 * Message de refus d'une ligne de prestation incohérente.
 *
 * Il nomme le rang de la ligne et la règle enfreinte — de quoi corriger — mais
 * ni montant, ni date, ni identifiant : il est affiché tel quel dans le
 * formulaire, et une facture porte des données de niveau « sensible »
 * (docs/security/DATA_CLASSIFICATION.md).
 */
function lineProblemMessage(
  problems: ReturnType<typeof validateInvoiceLines>,
): string {
  const first = problems[0];
  const rang = `La prestation n° ${first.index + 1}`;

  if (first.code === "dates-manquantes") {
    return `${rang} est facturée à l'unité : indiquez au moins une date de séance avant d'enregistrer.`;
  }
  return (
    `${rang} imprime un montant par date : elle doit compter autant de dates que de séances facturées ` +
    `(${first.dateCount} date(s) pour ${first.quantity} séance(s)). ` +
    `Corrigez l'un ou l'autre, ou choisissez l'affichage en liste.`
  );
}

export type SaveInvoiceResult =
  | { ok: true }
  | {
      ok: false;
      reason: "unauthenticated" | "not-found" | "error";
      message: string;
    };

export async function saveInvoice(
  formData: FormData,
): Promise<SaveInvoiceResult> {
  const supabase = await createClient();

  // Une Server Action est un endpoint HTTP : la session se vérifie ici. Sans ce
  // contrôle, getSettings() lève « Non authentifié » plus bas et l'appelante ne
  // reçoit qu'une exception opaque, sans savoir que sa saisie n'est pas passée.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      reason: "unauthenticated",
      message:
        "Votre session a expiré. Reconnectez-vous dans un autre onglet, puis revenez ici et enregistrez : votre saisie reste à l'écran tant que vous ne quittez pas cette page.",
    };
  }

  const id = str(formData.get("id"));

  const patientId = str(formData.get("patient_id"));

  // Le nom affiché sur la facture suit la fiche patient quand il y en a une ;
  // sinon on conserve le texte envoyé (anciennes factures non rattachées).
  let patientName = String(formData.get("patient_name") ?? "").trim();
  if (patientId) {
    const { data: p, error: patientError } = await supabase
      .from("patients")
      .select("first_name, last_name")
      .eq("id", patientId)
      .maybeSingle();
    // La RLS masque les fiches des autres cabinets : une fiche illisible est
    // soit supprimée, soit celle d'un autre compte. Dans les deux cas on
    // refuse d'écrire la référence. Une facture ne doit jamais pointer une
    // fiche que le compte ne peut pas lire : la fonction de partage public
    // s'exécute hors RLS et suit ce lien.
    if (patientError || !p) {
      return {
        ok: false,
        reason: "not-found",
        message:
          "Cette fiche patient n'est plus disponible. Rechargez la page, puis sélectionnez à nouveau le patient.",
      };
    }
    patientName = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
  }

  const billingYear = formData.get("billing_year")
    ? parseInt(String(formData.get("billing_year")), 10)
    : new Date().getFullYear();
  const monthIndex = MONTHS.indexOf(String(formData.get("billing_month") ?? ""));

  // À la création, le numéro est réservé sur le compteur ; en édition on
  // conserve celui déjà attribué (modifiable à la main si besoin).
  const invoiceNumber = id
    ? str(formData.get("invoice_number"))
    : await reserveInvoiceNumber(
        supabase,
        billingYear,
        monthIndex < 0 ? new Date().getMonth() : monthIndex,
      );

  // ---- Lignes de prestation (migration 013) ----
  //
  // Le champ est ABSENT des formulaires qui ne gèrent pas les lignes : on ne
  // touche alors pas du tout la colonne, et la facture se comporte exactement
  // comme avant. Présent — même à « [] » — il fait autorité : c'est le client
  // qui déclare gérer les lignes, et la colonne est écrite en conséquence.
  const rawLines = formData.get("lines");
  const managesLines = rawLines !== null;

  // Le catalogue n'est PAS relu ici, et ne doit jamais l'être : la ligne porte
  // déjà ses valeurs, figées au moment où elle a été créée. Une entrée de
  // catalogue modifiée, désactivée ou supprimée ne change aucune facture émise.
  const lines = managesLines ? normalizeInvoiceLines(rawLines) : [];

  if (lines.length > 0) {
    const problems = validateInvoiceLines(lines);
    if (problems.length > 0) {
      return {
        ok: false,
        reason: "error",
        message: lineProblemMessage(problems),
      };
    }
  }

  // Rétrocession et URSSAF ne sont plus saisies par facture : elles découlent
  // des réglages (Paramètres › Comptabilité).
  //
  // Dès qu'il y a des lignes, le brut est la somme des blocs et le montant posté
  // par le client est IGNORÉ : il n'est ni lu, ni comparé, ni utilisé en repli.
  // Sans ligne, le champ du formulaire reste la seule source, comme avant.
  const gross =
    lines.length > 0 ? invoiceLinesTotal(lines) : num(formData.get("revenue_gross"));
  const settings = await getSettings();
  // Rétrocession et URSSAF restent calculées au niveau FACTURE, sur ce brut :
  // elles ne se ventilent pas par ligne. Les colonnes générées `after_retro` et
  // `net_revenue` en découlent donc sans changement.
  const { retrocession, urssaf } = computeInvoice(gross, settings);

  const payload = {
    patient_id: patientId,
    patient_name: patientName,
    invoice_number: invoiceNumber,
    billing_month: str(formData.get("billing_month")),
    billing_year: formData.get("billing_year") ? billingYear : null,
    has_pco: formData.get("has_pco") === "on",
    revenue_gross: gross,
    revenue_gross_paid: num(formData.get("revenue_gross_paid")),
    payment_method: str(formData.get("payment_method")),
    payment_date: str(formData.get("payment_date")),
    issue_date: str(formData.get("issue_date")),
    service_label: str(formData.get("service_label")),
    retrocession_amount: retrocession,
    urssaf_amount: urssaf,
    notes: str(formData.get("notes")),
    // Écrit seulement si le client gère les lignes. Sans cette condition, toute
    // écriture échouerait sur une base où la migration 013 n'est pas passée.
    ...(managesLines ? { lines } : {}),
  };

  if (id) {
    const { data, error } = await supabase
      .from("invoices")
      .update(payload)
      .eq("id", id)
      .select("id");

    if (error) {
      return { ok: false, reason: "error", message: SAVE_FAILED_MESSAGE };
    }
    // Aucune ligne touchée : la facture a été supprimée, ou elle appartient à
    // un autre compte et la RLS la rend invisible. Même message dans les deux
    // cas — rien ne doit laisser deviner qu'un identifiant existe ailleurs.
    if (!data || data.length === 0) {
      return {
        ok: false,
        reason: "not-found",
        message:
          "Cette facture n'est plus disponible. Elle a peut-être été supprimée depuis un autre onglet. Rechargez la page avant de recommencer.",
      };
    }
  } else {
    const { error } = await supabase.from("invoices").insert(payload);
    if (error) {
      return { ok: false, reason: "error", message: SAVE_FAILED_MESSAGE };
    }
  }

  revalidatePath("/comptabilite");
  revalidatePath("/patients");
  revalidatePath("/");
  return { ok: true };
}

export type SendInvoiceResult =
  | { ok: true; email: string }
  | {
      ok: false;
      reason: "not-configured" | "no-email" | "not-found" | "error";
      message: string;
    };

/**
 * Renvoie le lien de consultation de la facture, en créant le jeton si la
 * facture n'en a pas encore ou si le précédent a expiré.
 */
async function shareLink(
  supabase: Awaited<ReturnType<typeof createClient>>,
  invoice: Invoice,
): Promise<string | null> {
  const current = invoice.share_token;
  const expires = invoice.share_expires_at;

  const stillValid =
    !!current && (!expires || new Date(expires).getTime() > Date.now());

  let token = current ?? null;
  if (!stillValid) {
    token = newShareToken();
    const { error } = await supabase
      .from("invoices")
      .update({ share_token: token, share_expires_at: shareExpiry() })
      .eq("id", invoice.id);
    // Colonnes absentes : migration 011 non lancée.
    if (error) return null;
  }

  return `${await siteOrigin()}/facture/${token}`;
}

/**
 * Prévient le patient que sa facture est disponible, par un lien vers cette
 * application. Volontairement, ni le PDF ni la nature de l'acte ne sont mis
 * dans le message : aucune donnée de santé ne transite par le prestataire
 * d'e-mail.
 */
export async function sendInvoiceEmail(id: string): Promise<SendInvoiceResult> {
  const config = emailConfig();
  if (!config) {
    return {
      ok: false,
      reason: "not-configured",
      message:
        "Envoi d'e-mails non configuré : renseignez RESEND_API_KEY et INVOICE_FROM_EMAIL.",
    };
  }

  const supabase = await createClient();
  const { data: invoiceRaw } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!invoiceRaw) {
    return { ok: false, reason: "not-found", message: "Facture introuvable." };
  }
  const invoice = invoiceRaw as Invoice;

  let patient: Patient | null = null;
  if (invoice.patient_id) {
    const { data } = await supabase
      .from("patients")
      .select("*")
      .eq("id", invoice.patient_id)
      .maybeSingle();
    patient = (data as Patient) ?? null;
  }

  const to = patient?.email?.trim();
  if (!to) {
    return {
      ok: false,
      reason: "no-email",
      message: `${invoice.patient_name || "Ce patient"} n'a pas d'adresse e-mail.`,
    };
  }

  const link = await shareLink(supabase, invoice);
  if (!link) {
    return {
      ok: false,
      reason: "error",
      message:
        "Lien de consultation impossible à créer : la migration 011 n'a pas été lancée.",
    };
  }

  const settings = (await getSettings()) as Settings;
  const num = invoice.invoice_number ? ` n° ${invoice.invoice_number}` : "";

  const error = await sendMail(config, {
    to,
    subject: `Votre facture${num}`,
    text:
      `Bonjour,\n\nVotre facture${num} est disponible à cette adresse :\n${link}\n\n` +
      `Ce lien vous est personnel, il expire dans 90 jours.\n\n` +
      `Bien cordialement,\n${settings.display_name ?? ""}`,
    replyTo: settings.profile?.business_email,
  });

  if (error) return { ok: false, reason: "error", message: error };
  revalidatePath("/comptabilite");
  return { ok: true, email: to };
}

export async function deleteInvoice(formData: FormData) {
  const supabase = await createClient();
  const id = str(formData.get("id"));
  if (id) await supabase.from("invoices").delete().eq("id", id);
  revalidatePath("/comptabilite");
  revalidatePath("/");
}

export async function saveExpense(formData: FormData) {
  const supabase = await createClient();
  const id = str(formData.get("id"));
  const payload = {
    type: str(formData.get("type")) ?? "loyer",
    label: str(formData.get("label")),
    amount: num(formData.get("amount")),
    expense_date: str(formData.get("expense_date")),
    period_month: str(formData.get("period_month")),
    period_year: formData.get("period_year")
      ? parseInt(String(formData.get("period_year")), 10)
      : null,
    notes: str(formData.get("notes")),
  };
  if (id) {
    await supabase.from("expenses").update(payload).eq("id", id);
  } else {
    await supabase.from("expenses").insert(payload);
  }
  revalidatePath("/comptabilite");
}

export async function deleteExpense(formData: FormData) {
  const supabase = await createClient();
  const id = str(formData.get("id"));
  if (id) await supabase.from("expenses").delete().eq("id", id);
  revalidatePath("/comptabilite");
}
