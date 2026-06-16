import Link from "next/link";
import { FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Bilan } from "@/lib/types";
import { PageHeader, EmptyState, PrimaryLink } from "@/components/ui";
import { frDate } from "@/lib/format";

export default async function BilansPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bilans")
    .select("*")
    .order("updated_at", { ascending: false });

  const bilans = (data ?? []) as Bilan[];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <PageHeader
        title="Bilans psychomoteurs"
        subtitle={`${bilans.length} bilan${bilans.length > 1 ? "s" : ""}`}
      >
        <PrimaryLink href="/bilans/nouveau">
          <FileText className="h-4 w-4" />
          Nouveau bilan
        </PrimaryLink>
      </PageHeader>

      {bilans.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
          <EmptyState
            icon={<FileText className="h-6 w-6" />}
            title="Aucun bilan"
            description="Rédigez votre premier compte rendu de bilan psychomoteur à partir d'un modèle structuré."
            action={
              <PrimaryLink href="/bilans/nouveau">
                <FileText className="h-4 w-4" />
                Nouveau bilan
              </PrimaryLink>
            }
          />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {bilans.map((b) => (
            <Link
              key={b.id}
              href={`/bilans/${b.id}`}
              className="group bg-white rounded-xl border border-slate-100 shadow-sm p-4 hover:border-brand-200 hover:shadow transition flex flex-col"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="h-10 w-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                  <FileText className="h-5 w-5" />
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
              </div>
              <p className="font-medium text-slate-800 group-hover:text-brand-700">
                {b.patient_name || "Sans patient"}
              </p>
              <p className="text-sm text-slate-500">{b.title}</p>
              <p className="text-xs text-slate-400 mt-auto pt-2">
                {b.bilan_date ? frDate(b.bilan_date) : "Date non définie"}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
