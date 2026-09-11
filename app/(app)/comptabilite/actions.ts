"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data";
import { computeInvoice } from "@/lib/calc";
import {
  buildInvoiceNumber,
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

/**
 * Prochain numéro disponible pour la période donnée, d'après le modèle
 * enregistré dans Paramètres › Comptabilité.
 */
export async function nextInvoiceNumber(
  year: number,
  month: number,
): Promise<string> {
  const supabase = await createClient();
  const settings = await getSettings();
  const format =
    settings.profile?.invoice_number_format?.trim() || DEFAULT_INVOICE_FORMAT;

  const ctx = { year, month };
  const { prefix, suffix } = splitFormat(format, ctx);

  const { data } = await supabase.from("invoices").select("invoice_number");
  const seq = nextSeq(
    (data ?? []).map((r) => r.invoice_number as string | null),
    prefix,
    suffix,
  );
  return buildInvoiceNumber(format, ctx, seq);
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

  // Rétrocession et URSSAF ne sont plus saisies par facture : elles découlent
  // des réglages (Paramètres › Comptabilité).
  const gross = num(formData.get("revenue_gross"));
  const settings = await getSettings();
  const { retrocession, urssaf } = computeInvoice(gross, settings);

  const payload = {
    patient_id: patientId,
    patient_name: patientName,
    invoice_number: str(formData.get("invoice_number")),
    billing_month: str(formData.get("billing_month")),
    billing_year: formData.get("billing_year")
      ? parseInt(String(formData.get("billing_year")), 10)
      : null,
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
