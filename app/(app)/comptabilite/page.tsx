import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data";
import type { Invoice, Expense, Patient } from "@/lib/types";
import ComptabiliteView from "./ComptabiliteView";

export default async function ComptabilitePage({
  searchParams,
}: {
  searchParams: Promise<{
    mode?: string;
    month?: string;
    year?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const settings = await getSettings();

  // Le filtrage (mois / année / fourchette) se fait côté client :
  // la navigation d'une période à l'autre reste instantanée.
  const [{ data: invoicesRaw }, { data: expensesRaw }, { data: patientsRaw }] =
    await Promise.all([
      supabase
        .from("invoices")
        .select("*")
        .order("invoice_number", { ascending: true }),
      supabase
        .from("expenses")
        .select("*")
        .order("expense_date", { ascending: true }),
      supabase
        .from("patients")
        .select("id, first_name, last_name")
        .order("last_name"),
    ]);

  return (
    <ComptabiliteView
      invoices={(invoicesRaw ?? []) as Invoice[]}
      expenses={(expensesRaw ?? []) as Expense[]}
      patients={
        (patientsRaw ?? []) as Pick<Patient, "id" | "first_name" | "last_name">[]
      }
      settings={{
        retrocession_rate: settings.retrocession_rate,
        urssaf_rate: settings.urssaf_rate,
        charge_mode: settings.charge_mode,
      }}
      initialParams={params}
    />
  );
}
