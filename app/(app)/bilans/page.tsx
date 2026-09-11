import Link from "next/link";
import { FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Bilan } from "@/lib/types";
import { PageHeader, EmptyState, PrimaryLink } from "@/components/ui";
import { frDate } from "@/lib/format";
import { BILAN_TYPE_ORDER, BILAN_TYPE_UI, bilanTypeOf } from "@/lib/constants";
import DeleteBilanButton from "./DeleteBilanButton";

export default async function BilansPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bilans")
    .select("*")
    .order("updated_at", { ascending: false });

  const bilans = (data ?? []) as Bilan[];

  // Un groupe par type de bilan : psychomoteur et sensoriel ne sont jamais mêlés.
  const groups = BILAN_TYPE_ORDER.map((type) => ({
    type,
    ui: BILAN_TYPE_UI[type],
    list: bilans.filter((b) => bilanTypeOf(b.content) === type),
  }));

  const subtitle = groups
    .filter((g) => g.list.length > 0)
    .map((g) => `${g.list.length} ${g.ui.label.toLowerCase()}`)
    .join(" · ");

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <PageHeader
        title="Bilans"
        subtitle={
          bilans.length === 0
            ? "Aucun bilan"
            : `${bilans.length} bilan${bilans.length > 1 ? "s" : ""} · ${subtitle}`
        }
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
        groups.map(({ type, ui, list }) =>
          list.length === 0 ? null : (
            <section key={type} className="mb-8 last:mb-0">
              <div className="flex items-center gap-3 mb-3">
                <h2
                  className={`text-xs font-semibold uppercase tracking-wider ${ui.accent}`}
                >
                  {ui.plural}
                </h2>
                <span className="text-xs text-slate-400">{list.length}</span>
                <div className="h-px flex-1 bg-slate-100" />
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {list.map((b) => (
                  <div
                    key={b.id}
                    className="group relative bg-white rounded-xl border border-slate-100 shadow-sm p-4 hover:border-brand-200 hover:shadow transition flex flex-col"
                  >
                    {/* En-tête hors du lien : la croix doit rester cliquable. */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="h-10 w-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="flex items-center gap-1">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            b.status === "finalisé"
                              ? "bg-brand-100 text-brand-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {b.status}
                        </span>
                        <DeleteBilanButton
                          id={b.id}
                          label={b.patient_name || b.title || "ce bilan"}
                        />
                      </div>
                    </div>
                    {/* after:inset-0 rend toute la carte cliquable. */}
                    <Link
                      href={`/bilans/${b.id}`}
                      className="flex flex-col flex-1 after:absolute after:inset-0 after:rounded-xl"
                    >
                      <p className="font-medium text-slate-800 group-hover:text-brand-700">
                        {b.patient_name || "Sans patient"}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded ${ui.badge}`}
                        >
                          {ui.label}
                        </span>
                        <p className="text-sm text-slate-500 truncate">
                          {b.title}
                        </p>
                      </div>
                      <p className="text-xs text-slate-400 mt-auto pt-2">
                        {b.bilan_date ? frDate(b.bilan_date) : "Date non définie"}
                      </p>
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          ),
        )
      )}
    </div>
  );
}
