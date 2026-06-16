import Link from "next/link";
import {
  Calculator,
  FileText,
  Users,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data";
import { sumTotals } from "@/lib/calc";
import { euro, frDate } from "@/lib/format";
import type { Bilan, Invoice } from "@/lib/types";
import { StatCard, Card } from "@/components/ui";

export default async function DashboardPage() {
  const supabase = await createClient();
  const settings = await getSettings();

  const [
    { data: invoicesRaw },
    { count: patientsCount },
    { data: bilansRaw },
  ] = await Promise.all([
    supabase.from("invoices").select("*"),
    supabase.from("patients").select("id", { count: "exact", head: true }),
    supabase
      .from("bilans")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(5),
  ]);

  const allInvoices = (invoicesRaw ?? []) as Invoice[];
  const bilans = (bilansRaw ?? []) as Bilan[];
  const year = new Date().getFullYear();
  const yearInvoices = allInvoices.filter((i) => i.billing_year === year);
  const totals = sumTotals(yearInvoices);

  const firstName = (settings.display_name ?? "").split(" ")[0] || "";

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-7">
        <h1 className="text-2xl font-semibold text-slate-800">
          Bonjour{firstName ? ` ${firstName}` : ""} 👋
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Voici un aperçu de votre activité {year}.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <StatCard
          label={`Revenu net ${year}`}
          value={euro(totals.net)}
          accent="brand"
          hint={`${totals.count} facture${totals.count > 1 ? "s" : ""}`}
        />
        <StatCard label="Brut encaissé" value={euro(totals.brutPaye)} accent="slate" />
        <StatCard label="URSSAF estimée" value={euro(totals.urssaf)} accent="amber" />
        <StatCard
          label="Patients"
          value={String(patientsCount ?? 0)}
          accent="emerald"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Accès rapides */}
        <div className="space-y-3">
          <QuickLink
            href="/comptabilite"
            icon={<Calculator className="h-5 w-5" />}
            title="Comptabilité"
            desc="Saisir une facture, voir les totaux"
          />
          <QuickLink
            href="/bilans/nouveau"
            icon={<FileText className="h-5 w-5" />}
            title="Nouveau bilan"
            desc="Rédiger un compte rendu psychomoteur"
          />
          <QuickLink
            href="/patients"
            icon={<Users className="h-5 w-5" />}
            title="Patients"
            desc="Gérer vos fiches patients"
          />
        </div>

        {/* Derniers bilans */}
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <FileText className="h-4 w-4 text-brand-600" />
              Derniers bilans
            </h2>
            <Link
              href="/bilans"
              className="text-sm text-brand-700 hover:underline flex items-center gap-1"
            >
              Tout voir <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {bilans.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">
              Aucun bilan pour l&apos;instant.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {bilans.map((b) => (
                <li key={b.id}>
                  <Link
                    href={`/bilans/${b.id}`}
                    className="flex items-center justify-between py-3 -mx-2 px-2 rounded-lg hover:bg-slate-50"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-700">
                        {b.patient_name || "Sans patient"}
                      </p>
                      <p className="text-xs text-slate-400">
                        {b.title} · {frDate(b.bilan_date)}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        b.status === "finalisé"
                          ? "bg-brand-100 text-brand-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {b.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
        <TrendingUp className="h-4 w-4" />
        Les calculs (rétrocession, URSSAF, net) se font automatiquement à la
        saisie. Ajustez les taux dans les Paramètres.
      </div>
    </div>
  );
}

function QuickLink({
  href,
  icon,
  title,
  desc,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 bg-white rounded-xl border border-slate-100 shadow-sm p-4 hover:border-brand-200 hover:shadow transition"
    >
      <div className="h-11 w-11 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center group-hover:bg-brand-600 group-hover:text-white transition">
        {icon}
      </div>
      <div className="flex-1">
        <p className="font-medium text-slate-800">{title}</p>
        <p className="text-xs text-slate-500">{desc}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-brand-500" />
    </Link>
  );
}
