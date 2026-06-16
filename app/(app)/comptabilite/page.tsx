import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data";
import { sumTotals } from "@/lib/calc";
import { euro } from "@/lib/format";
import type { Invoice, Expense, Patient } from "@/lib/types";
import { PageHeader, StatCard } from "@/components/ui";
import ComptaClient from "./ComptaClient";
import LoyersClient from "./LoyersClient";
import YearFilter from "./YearFilter";

export default async function ComptabilitePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { year: yearParam } = await searchParams;
  const supabase = await createClient();
  const settings = await getSettings();

  const [{ data: invoicesRaw }, { data: expensesRaw }, { data: patientsRaw }] =
    await Promise.all([
      supabase
        .from("invoices")
        .select("*")
        .order("invoice_number", { ascending: true }),
      supabase.from("expenses").select("*").order("expense_date", {
        ascending: true,
      }),
      supabase
        .from("patients")
        .select("id, first_name, last_name")
        .order("last_name"),
    ]);

  const allInvoices = (invoicesRaw ?? []) as Invoice[];
  const allExpenses = (expensesRaw ?? []) as Expense[];
  const patients = (patientsRaw ?? []) as Pick<
    Patient,
    "id" | "first_name" | "last_name"
  >[];

  const currentYear = new Date().getFullYear();
  const years = Array.from(
    new Set(
      [
        ...allInvoices.map((i) => i.billing_year),
        ...allExpenses.map((e) => e.period_year),
        currentYear,
      ].filter((y): y is number => typeof y === "number"),
    ),
  ).sort((a, b) => b - a);

  const selectedYear =
    yearParam && yearParam !== "all" ? parseInt(yearParam, 10) : null;

  const invoices = selectedYear
    ? allInvoices.filter((i) => i.billing_year === selectedYear)
    : allInvoices;
  const expenses = selectedYear
    ? allExpenses.filter((e) => e.period_year === selectedYear)
    : allExpenses;

  const totals = sumTotals(invoices);
  const totalLoyers = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const resultatApresLoyer = totals.net - totalLoyers;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Comptabilité"
        subtitle="Suivi des factures, calculs automatiques rétrocession / URSSAF / net"
      >
        <YearFilter years={years} />
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
        <StatCard label="Total brut" value={euro(totals.brut)} accent="slate" />
        <StatCard
          label="Rétrocession"
          value={euro(totals.retrocession)}
          accent="rose"
        />
        <StatCard
          label="Brut − rétro"
          value={euro(totals.brutMoinsRetro)}
          accent="slate"
        />
        <StatCard label="URSSAF" value={euro(totals.urssaf)} accent="amber" />
        <StatCard
          label="Revenu net"
          value={euro(totals.net)}
          accent="brand"
          hint={`${totals.count} facture${totals.count > 1 ? "s" : ""}`}
        />
        <StatCard
          label="Net après loyer"
          value={euro(resultatApresLoyer)}
          accent="emerald"
          hint={totalLoyers ? `loyers ${euro(totalLoyers)}` : undefined}
        />
      </div>

      <ComptaClient
        invoices={invoices}
        patients={patients}
        settings={{
          retrocession_rate: settings.retrocession_rate,
          urssaf_rate: settings.urssaf_rate,
          charge_mode: settings.charge_mode,
        }}
        defaultYear={selectedYear ?? currentYear}
      />

      <div className="mt-6 max-w-xl">
        <LoyersClient
          expenses={expenses}
          defaultYear={selectedYear ?? currentYear}
        />
      </div>
    </div>
  );
}
