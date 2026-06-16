"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
 * Retrouve un patient existant par son nom (insensible à la casse),
 * sinon le crée automatiquement. Renvoie son id.
 */
async function ensurePatient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  name: string,
): Promise<string | null> {
  const clean = name.trim();
  if (!clean) return null;

  const { data: existing } = await supabase
    .from("patients")
    .select("id, first_name, last_name");

  const match = (existing ?? []).find(
    (p) =>
      `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim().toLowerCase() ===
      clean.toLowerCase(),
  );
  if (match) return match.id;

  const parts = clean.split(/\s+/);
  const first_name = parts.shift() ?? clean;
  const last_name = parts.join(" ");

  const { data: created } = await supabase
    .from("patients")
    .insert({ first_name, last_name })
    .select("id")
    .single();

  return created?.id ?? null;
}

export async function saveInvoice(formData: FormData) {
  const supabase = await createClient();
  const id = str(formData.get("id"));

  const patientName = String(formData.get("patient_name") ?? "").trim();
  let patientId = str(formData.get("patient_id"));

  // Auto-création / liaison du patient si aucun n'est lié.
  if (!patientId && patientName) {
    patientId = await ensurePatient(supabase, patientName);
  }

  const payload = {
    patient_id: patientId,
    patient_name: patientName,
    invoice_number: str(formData.get("invoice_number")),
    billing_month: str(formData.get("billing_month")),
    billing_year: formData.get("billing_year")
      ? parseInt(String(formData.get("billing_year")), 10)
      : null,
    has_pco: formData.get("has_pco") === "on",
    revenue_gross: num(formData.get("revenue_gross")),
    revenue_gross_paid: num(formData.get("revenue_gross_paid")),
    payment_method: str(formData.get("payment_method")),
    payment_date: str(formData.get("payment_date")),
    issue_date: str(formData.get("issue_date")),
    service_label: str(formData.get("service_label")),
    retrocession_amount: num(formData.get("retrocession_amount")),
    urssaf_amount: num(formData.get("urssaf_amount")),
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
