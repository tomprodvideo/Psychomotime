import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data";
import type { Bilan, Patient } from "@/lib/types";
import { BILAN_TEMPLATE } from "@/lib/constants";
import { ageFromBirth, frDate } from "@/lib/format";
import ApercuActions from "./ApercuActions";

export default async function BilanApercuPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const settings = await getSettings();

  const { data } = await supabase
    .from("bilans")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();
  const b = data as Bilan;
  const content = b.content ?? {};
  const profile = settings.profile ?? {};

  let patient: Patient | null = null;
  if (b.patient_id) {
    const { data: p } = await supabase
      .from("patients")
      .select("*")
      .eq("id", b.patient_id)
      .maybeSingle();
    patient = (p as Patient) ?? null;
  }

  const filledGroups = BILAN_TEMPLATE.map((g) => ({
    ...g,
    sections: g.sections.filter((s) => (content[s.id] ?? "").trim() !== ""),
  })).filter((g) => g.sections.length > 0);

  const subject = `Bilan psychomoteur - ${b.patient_name}`;
  const body = `Bonjour,\n\nVeuillez trouver le compte rendu du bilan psychomoteur de ${
    b.patient_name
  }${b.bilan_date ? ` (${frDate(b.bilan_date)})` : ""}.\n\nBien cordialement,\n${
    settings.display_name ?? b.author ?? ""
  }`;

  return (
    <div className="bg-slate-100 min-h-screen">
      <div className="no-print sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <Link
            href={`/bilans/${b.id}`}
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à l&apos;édition
          </Link>
          <ApercuActions
            patientEmail={patient?.email ?? null}
            subject={subject}
            body={body}
          />
        </div>
      </div>

      <div className="py-8 px-4 print:p-0">
        <article className="print-area max-w-3xl mx-auto bg-white shadow-sm border border-slate-200 rounded-lg p-10 print:shadow-none print:border-0">
          {/* En-tête : logo + praticien */}
          <header className="flex items-start justify-between gap-6 border-b-2 border-brand-600 pb-5 mb-6">
            <div className="flex items-start gap-4">
              {profile.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.logo_url}
                  alt="Logo"
                  className="h-16 w-16 object-contain"
                />
              )}
              <div className="text-sm text-slate-600 leading-relaxed">
                <p className="font-semibold text-slate-900 text-base">
                  {settings.display_name ?? b.author ?? "Psychomotricien(ne)"}
                </p>
                {profile.address && (
                  <p className="whitespace-pre-line">{profile.address}</p>
                )}
                {profile.business_phone && <p>Tél. {profile.business_phone}</p>}
                {profile.business_email && <p>{profile.business_email}</p>}
                {profile.adeli && <p>N° ADELI : {profile.adeli}</p>}
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs uppercase tracking-widest text-brand-600 font-semibold">
                Compte rendu
              </p>
              <h1 className="text-xl font-bold text-slate-900 mt-1">
                {b.title}
              </h1>
            </div>
          </header>

          {/* Identité patient */}
          <div className="mb-6 bg-slate-50 rounded-lg p-4 text-sm">
            <div className="flex flex-wrap gap-x-8 gap-y-1">
              <span>
                <span className="text-slate-400">Patient : </span>
                <strong className="text-slate-800">
                  {b.patient_name || "—"}
                </strong>
              </span>
              {patient?.birth_date && (
                <span>
                  <span className="text-slate-400">Naissance : </span>
                  {frDate(patient.birth_date)} ({ageFromBirth(patient.birth_date)})
                </span>
              )}
              {b.bilan_date && (
                <span>
                  <span className="text-slate-400">Date du bilan : </span>
                  {frDate(b.bilan_date)}
                </span>
              )}
            </div>
          </div>

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

          <footer className="mt-10 pt-4 border-t border-slate-100 flex items-end justify-between text-xs text-slate-400">
            <span>Document confidentiel · {b.patient_name}</span>
            {(settings.display_name || b.author) && (
              <span className="text-slate-500">
                {settings.display_name ?? b.author}
              </span>
            )}
          </footer>
        </article>
      </div>
    </div>
  );
}
