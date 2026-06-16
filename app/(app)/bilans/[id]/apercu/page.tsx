import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Bilan } from "@/lib/types";
import { BILAN_TEMPLATE } from "@/lib/constants";
import { frDate } from "@/lib/format";
import PrintButton from "./PrintButton";

export default async function BilanApercuPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("bilans")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();
  const b = data as Bilan;
  const content = b.content ?? {};

  const filledGroups = BILAN_TEMPLATE.map((g) => ({
    ...g,
    sections: g.sections.filter((s) => (content[s.id] ?? "").trim() !== ""),
  })).filter((g) => g.sections.length > 0);

  return (
    <div className="bg-slate-100 min-h-screen">
      {/* Barre d'actions (cachée à l'impression) */}
      <div className="no-print sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link
            href={`/bilans/${b.id}`}
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à l&apos;édition
          </Link>
          <PrintButton />
        </div>
      </div>

      {/* Document */}
      <div className="py-8 px-4 print:p-0">
        <article className="print-area max-w-3xl mx-auto bg-white shadow-sm border border-slate-200 rounded-lg p-10 print:shadow-none print:border-0">
          <header className="border-b-2 border-brand-600 pb-4 mb-6">
            <p className="text-xs uppercase tracking-widest text-brand-600 font-semibold">
              {b.title}
            </p>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">
              {b.patient_name || "—"}
            </h1>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-500 mt-2">
              {b.bilan_date && <span>Date : {frDate(b.bilan_date)}</span>}
              {b.author && <span>Rédigé par : {b.author}</span>}
            </div>
          </header>

          {filledGroups.length === 0 ? (
            <p className="text-slate-400 text-sm">
              Ce bilan est encore vide. Retournez à l&apos;édition pour le
              remplir.
            </p>
          ) : (
            filledGroups.map((g) => (
              <section key={g.group} className="mb-6">
                <h2 className="text-sm font-bold uppercase tracking-wide text-brand-700 border-b border-slate-200 pb-1 mb-3">
                  {g.group}
                </h2>
                <div className="space-y-4">
                  {g.sections.map((s) => (
                    <div key={s.id} className="break-inside-avoid">
                      <h3 className="font-semibold text-slate-800 text-[15px]">
                        {s.title}
                      </h3>
                      <p className="text-slate-700 text-sm whitespace-pre-wrap leading-relaxed mt-0.5">
                        {content[s.id]}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            ))
          )}

          <footer className="mt-10 pt-4 text-xs text-slate-400 text-center print:fixed print:bottom-4 print:inset-x-0">
            Bilan psychomoteur · {b.patient_name} · Document confidentiel
          </footer>
        </article>
      </div>
    </div>
  );
}
