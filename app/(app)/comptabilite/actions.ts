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

export async function saveInvoice(formData: FormData) {
  const supabase = await createClient();
  const id = str(formData.get("id"));

  const payload = {
    patient_id: str(formData.get("patient_id")),
    patient_name: String(formData.get("patient_name") ?? "").trim(),
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
