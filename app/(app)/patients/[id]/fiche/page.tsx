/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data";
import type { Bilan, Patient } from "@/lib/types";
import {
  DOSSIER_GROUPS,
  PATIENT_DOSSIER_FIELDS,
} from "@/lib/constants";
import { ageFromBirth, frDate } from "@/lib/format";
import PrintButton from "./PrintButton";

export default async function FichePatientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const settings = await getSettings();
  const profile = settings.profile ?? {};
  const accent = profile.theme_color || "#2f8a82";

  const { data } = await supabase
    .from("patients")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();
  const p = data as Patient;
  const g = p.guardian ?? {};
  const dossier = (p.dossier ?? {}) as Record<string, string | null | undefined>;

  const { data: bilansRaw } = await supabase
    .from("bilans")
    .select("id, title, bilan_date, status")
    .eq("patient_id", id)
    .order("bilan_date", { ascending: false });
  const bilans = (bilansRaw ?? []) as Pick<
    Bilan,
    "id" | "title" | "bilan_date" | "status"
  >[];

  const guardianName = [g.first_name, g.last_name].filter(Boolean).join(" ");
  const hasGuardian =
    guardianName || g.phone || g.email || g.address || g.relation;

  return (
    <div className="bg-slate-100 min-h-screen">
      <div className="no-print sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <Link
            href={`/patients/${p.id}`}
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à la fiche
          </Link>
          <PrintButton />
        </div>
      </div>

      <div className="py-8 px-4 print:p-0">
        <article
          className="print-area max-w-3xl mx-auto bg-white shadow-sm border border-slate-200 rounded-lg px-12 py-10 print:shadow-none print:border-0 text-[13px] leading-relaxed text-slate-800"
          style={{ ["--accent" as string]: accent } as React.CSSProperties}
        >
          {/* En-tête */}
          <header className="mb-6">
            <div className="flex items-start gap-4">
              {profile.logo_url && (
                <img
                  src={profile.logo_url}
                  alt="Logo"
                  className="h-16 w-16 object-contain"
                />
              )}
              <div className="text-[12px] leading-snug text-slate-700">
                <p className="font-semibold text-slate-900">
                  {settings.display_name ?? "Psychomotricien(ne)"}
                </p>
                {profile.address &&
                  profile.address
                    .split("\n")
                    .map((l, i) => <p key={i}>{l}</p>)}
                {(profile.postal_code || profile.city) && (
                  <p>
                    {[profile.postal_code, profile.city]
                      .filter(Boolean)
                      .join(" ")}
                  </p>
                )}
                {profile.business_phone && <p>{profile.business_phone}</p>}
                {profile.business_email && <p>{profile.business_email}</p>}
                {profile.rpps && <p>Numéro RPPS : {profile.rpps}</p>}
              </div>
            </div>
            <h1
              className="text-center text-lg font-bold tracking-wide mt-4"
              style={{ color: "var(--accent)" }}
            >
              FICHE PATIENT
            </h1>
          </header>

          {/* Identité */}
          <Section>Identité</Section>
          <div className="grid grid-cols-2 gap-y-1 gap-x-6 mb-5">
            <Line label="Nom et prénom" value={`${p.first_name} ${p.last_name}`} />
            <Line
              label="Date de naissance"
              value={
                p.birth_date
                  ? `${frDate(p.birth_date)} (${ageFromBirth(p.birth_date)})`
                  : ""
              }
            />
            <Line label="Téléphone" value={p.phone} />
            <Line label="Email" value={p.email} />
            <Line label="Adresse" value={p.address} full />
            <Line label="Notes" value={p.notes} full />
          </div>

          {/* Tuteur / Parent */}
          {hasGuardian && (
            <>
              <Section>Tuteur / Parent</Section>
              <div className="grid grid-cols-2 gap-y-1 gap-x-6 mb-5">
                <Line
                  label="Nom"
                  value={
                    guardianName
                      ? `${guardianName}${g.relation ? ` (${g.relation})` : ""}`
                      : g.relation ?? ""
                  }
                />
                <Line label="Téléphone" value={g.phone} />
                <Line label="Email" value={g.email} />
                <Line label="Adresse" value={g.address} full />
              </div>
            </>
          )}

          {/* Dossier de suivi */}
          {DOSSIER_GROUPS.map((group) => {
            const fields = PATIENT_DOSSIER_FIELDS.filter(
              (f) =>
                f.group === group &&
                (dossier[f.id] ?? "").toString().trim() !== "",
            );
            if (fields.length === 0) return null;
            return (
              <div key={group}>
                <Section>{group}</Section>
                <div className="grid grid-cols-2 gap-y-1 gap-x-6 mb-5">
                  {fields.map((f) => (
                    <Line
                      key={f.id}
                      label={f.label}
                      value={
                        f.type === "date"
                          ? frDate(dossier[f.id])
                          : dossier[f.id]
                      }
                      full={f.type === "long"}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {/* Bilans */}
          {bilans.length > 0 && (
            <>
              <Section>Bilans réalisés</Section>
              <ul className="mb-5 space-y-1">
                {bilans.map((b) => (
                  <li key={b.id} className="flex justify-between">
                    <span>{b.title}</span>
                    <span className="text-slate-500">
                      {b.bilan_date ? frDate(b.bilan_date) : ""} · {b.status}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <footer className="mt-8 pt-4 border-t border-slate-100 text-[11px] text-slate-400 text-center">
            Document confidentiel · {p.first_name} {p.last_name}
          </footer>
        </article>
      </div>
    </div>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="font-bold text-slate-900 text-[14px] mb-2 pb-1 border-b-2 inline-block"
      style={{ borderColor: "var(--accent)" }}
    >
      {children}
    </h2>
  );
}

function Line({
  label,
  value,
  full,
}: {
  label: string;
  value?: string | null;
  full?: boolean;
}) {
  if (!value) return null;
  return (
    <div className={full ? "col-span-2" : ""}>
      <span className="text-slate-500">{label} : </span>
      <span className="text-slate-800 whitespace-pre-wrap">{value}</span>
    </div>
  );
}
