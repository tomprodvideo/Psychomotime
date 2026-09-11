"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data";
import { computeInvoice } from "@/lib/calc";
import { MONTHS } from "@/lib/constants";
import { headers } from "next/headers";
import { emailConfig, sendMail } from "@/lib/email";
import { newShareToken, shareExpiry } from "@/lib/invoiceShare";
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

export async function saveInvoice(formData: FormData) {
  const supabase = await createClient();
  const id = str(formData.get("id"));

  const patientId = str(formData.get("patient_id"));

  // Le nom affiché sur la facture suit la fiche patient quand il y en a une ;
  // sinon on conserve le texte envoyé (anciennes factures non rattachées).
  let patientName = String(formData.get("patient_name") ?? "").trim();
  if (patientId) {
    const { data: p } = await supabase
      .from("patients")
      .select("first_name, last_name")
      .eq("id", patientId)
      .maybeSingle();
    if (p) patientName = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
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

  // Rétrocession et URSSAF ne sont plus saisies par facture : elles découlent
  // des réglages (Paramètres › Comptabilité).
  const gross = num(formData.get("revenue_gross"));
  const settings = await getSettings();
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
  };

  if (id) {
    await supabase.from("invoices").update(payload).eq("id", id);
  } else {
    await supabase.from("invoices").insert(payload);
  }

  revalidatePath("/comptabilite");
  revalidatePath("/patients");
  revalidatePath("/");
}

export type SendInvoiceResult =
  | { ok: true; email: string }
  | {
      ok: false;
      reason: "not-configured" | "no-email" | "not-found" | "error";
      message: string;
    };

/** Origine publique du site, déduite de la requête en cours. */
async function siteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

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
