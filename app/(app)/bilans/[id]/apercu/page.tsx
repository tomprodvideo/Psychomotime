/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data";
import type { Bilan, Patient } from "@/lib/types";
import {
  BILAN_META,
  BILAN_TEMPLATE,
  MABC_BLOCK_TITLES,
  MABC_GROUPS,
  SCORE_INTERPRETATION,
  nsColor,
  testLabel,
  type MabcRow,
} from "@/lib/constants";
import { ageFromBirth, frDate } from "@/lib/format";
import GaussianCurve from "@/components/GaussianCurve";
import ApercuActions from "./ApercuActions";

// Couleurs des puces : Moyenne (vert) / Fragilité (orange) / Pathologique (rouge)
const ZONE_TEXT = ["#4e7d2f", "#d99b2b", "#c0504d"];

function parseJSON<T>(s: unknown, fallback: T): T {
  try {
    return typeof s === "string" ? (JSON.parse(s) as T) : fallback;
  } catch {
    return fallback;
  }
}

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
  const blocks = parseJSON<Record<string, { id: string; test: string }[]>>(
    content.__blocks__,
    {},
  );
  const images = parseJSON<Record<string, string[]>>(content.__images__, {});
  const tests = b.tests ?? {};
  const profile = settings.profile ?? {};
  const usedIds = tests.used ?? [];
  const mabcUsed = usedIds.includes("mabc3");
  const group = MABC_GROUPS.find((g) => g.group === tests.mabc3_group) ?? null;
  const scores = tests.mabc3 ?? {};

  let patient: Patient | null = null;
  if (b.patient_id) {
    const { data: p } = await supabase
      .from("patients")
      .select("*")
      .eq("id", b.patient_id)
      .maybeSingle();
    patient = (p as Patient) ?? null;
  }

  const subject = `Bilan psychomoteur - ${b.patient_name}`;
  const body = `Bonjour,\n\nVeuillez trouver le compte rendu du bilan psychomoteur de ${
    b.patient_name
  }${b.bilan_date ? ` (${frDate(b.bilan_date)})` : ""}.\n\nBien cordialement,\n${
    settings.display_name ?? b.author ?? ""
  }`;

  const author = settings.display_name ?? b.author ?? "Psychomotricien(ne)";
  const birth = patient?.birth_date;
  const usedLabels = usedIds.length > 0;

  function mabcTables(blockKeys?: ("equilibre" | "oculo" | "dexterite")[]) {
    if (!mabcUsed || !group || !blockKeys) return null;
    return blockKeys.map((bk) => (
      <MabcTablePrint
        key={bk}
        title={MABC_BLOCK_TITLES[bk]}
        rows={group.blocks[bk]}
        scores={scores}
      />
    ));
  }

  function hasExtras(sectionId: string) {
    const bl = blocks[sectionId] ?? [];
    const imgs = images[sectionId] ?? [];
    return (
      bl.some((x) => content[`${sectionId}::${x.id}`]?.trim()) ||
      imgs.length > 0
    );
  }

  function sectionExtras(sectionId: string) {
    const bl = blocks[sectionId] ?? [];
    const imgs = images[sectionId] ?? [];
    const blockNodes = bl
      .map((x) => {
        const txt = content[`${sectionId}::${x.id}`]?.trim();
        if (!txt) return null;
        return (
          <div key={x.id} className="mt-2">
            <p className="font-semibold text-slate-800">
              {testLabel(x.test)} :
            </p>
            <p className="whitespace-pre-wrap text-justify">{txt}</p>
          </div>
        );
      })
      .filter(Boolean);
    if (blockNodes.length === 0 && imgs.length === 0) return null;
    return (
      <>
        {blockNodes}
        {imgs.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-3 break-inside-avoid">
            {imgs.map((src, i) => (
              <img
                key={i}
                src={src}
                alt=""
                className="w-full max-h-72 object-contain rounded border border-slate-200"
              />
            ))}
          </div>
        )}
      </>
    );
  }

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
        <article className="print-area max-w-3xl mx-auto bg-white shadow-sm border border-slate-200 rounded-lg px-12 py-10 print:shadow-none print:border-0 text-[13px] leading-relaxed text-slate-800">
          {/* En-tête praticien */}
          <header className="mb-6">
            <div className="flex items-start gap-4">
              {profile.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.logo_url}
                  alt="Logo"
                  className="h-16 w-16 object-contain"
                />
              )}
              <div className="text-[12px] leading-snug text-slate-700">
                <p className="font-semibold text-slate-900">{author}</p>
                {profile.address &&
                  profile.address
                    .split("\n")
                    .map((l, i) => <p key={i}>{l}</p>)}
                {profile.business_phone && <p>{profile.business_phone}</p>}
                {profile.business_email && <p>{profile.business_email}</p>}
                {profile.rpps && <p>Numéro RPPS : {profile.rpps}</p>}
                {profile.siret && <p>SIRET : {profile.siret}</p>}
              </div>
            </div>
            <p className="text-[12px] text-slate-600 mt-4">
              {profile.city ? `Au ${profile.city}, le ` : "Le "}
              {b.bilan_date ? frDate(b.bilan_date) : "…"}
            </p>
            <h1 className="text-center text-lg font-bold tracking-wide text-slate-900 mt-4">
              COMPTE RENDU DU BILAN PSYCHOMOTEUR
            </h1>
          </header>

          {/* Encart détail patient (AU-DESSUS de l'anamnèse) */}
          {(b.patient_name ||
            birth ||
            BILAN_META.some((f) => content[f.id]?.trim())) && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-[12px] mb-5 break-inside-avoid">
              <p>
                <span className="text-slate-500">Enfant concerné : </span>
                <strong>{b.patient_name || "—"}</strong>
                {birth && (
                  <>
                    , né(e) le {frDate(birth)} ({ageFromBirth(birth)})
                  </>
                )}
              </p>
              {content.scolarite && (
                <p>
                  <span className="text-slate-500">Scolarité : </span>
                  {content.scolarite}
                </p>
              )}
              {content.passation && (
                <p>
                  <span className="text-slate-500">Dates de passation : </span>
                  {content.passation}
                </p>
              )}
              {content.prescripteur && (
                <p>
                  <span className="text-slate-500">Médecin prescripteur : </span>
                  {content.prescripteur}
                </p>
              )}
              {content.motif && (
                <p>
                  <span className="text-slate-500">Motif de la demande : </span>
                  {content.motif}
                </p>
              )}
            </div>
          )}

          {/* Anamnèse (narratif) */}
          {(content.anamnese?.trim() || hasExtras("anamnese")) && (
            <section className="mb-5 break-inside-avoid">
              <SectionTitle>L&apos;anamnèse</SectionTitle>
              {content.anamnese?.trim() && (
                <p className="whitespace-pre-wrap text-justify">
                  {content.anamnese}
                </p>
              )}
              {sectionExtras("anamnese")}
            </section>
          )}

          {/* Domaines + comportement */}
          {BILAN_TEMPLATE.flatMap((g) => g.sections)
            .filter((s) => s.id !== "anamnese" && s.id !== "conclusion")
            .map((s) => {
              const text = content[s.id]?.trim();
              const hasTables =
                mabcUsed && group && (s.mabcBlocks?.length ?? 0) > 0;
              if (!text && !hasTables && !hasExtras(s.id)) return null;
              return (
                <section key={s.id} className="mb-5 break-inside-avoid">
                  <SectionTitle>{s.title}</SectionTitle>
                  {text && (
                    <p className="whitespace-pre-wrap text-justify">{text}</p>
                  )}
                  {mabcTables(s.mabcBlocks)}
                  {sectionExtras(s.id)}
                </section>
              );
            })}

          {/* Interprétation des scores */}
          {usedLabels && (
            <section className="mb-5 break-inside-avoid">
              <SectionTitle>Résultats chiffrés des tests</SectionTitle>
              <p className="text-[12px] mb-2">{SCORE_INTERPRETATION.intro}</p>
              <div className="grid sm:grid-cols-2 gap-3 text-[12px]">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <p className="font-semibold mb-1">Déviations standards (DS)</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {SCORE_INTERPRETATION.ds.map((l, i) => (
                      <li key={l} style={{ color: ZONE_TEXT[i] }}>
                        {l}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <p className="font-semibold mb-1">Notes standards (NS)</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {SCORE_INTERPRETATION.ns.map((l, i) => (
                      <li key={l} style={{ color: ZONE_TEXT[i] }}>
                        {l}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="mt-4 break-inside-avoid">
                <GaussianCurve />
              </div>
            </section>
          )}

          {/* Conclusion */}
          {(content.conclusion?.trim() || hasExtras("conclusion")) && (
            <section className="mb-6 break-inside-avoid">
              <SectionTitle>Conclusion</SectionTitle>
              {content.conclusion?.trim() && (
                <p className="whitespace-pre-wrap text-justify">
                  {content.conclusion}
                </p>
              )}
              {sectionExtras("conclusion")}
            </section>
          )}

          {/* Signature */}
          <footer className="mt-10 text-right text-[12px]">
            <p className="font-semibold text-slate-900">{author}</p>
            <p className="text-slate-500">
              Je reste disponible pour toutes précisions concernant cet écrit.
            </p>
          </footer>
        </article>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-bold text-slate-900 text-[14px] mb-2 pb-1 border-b-2 border-brand-500 inline-block">
      {children}
    </h2>
  );
}

function MabcTablePrint({
  title,
  rows,
  scores,
}: {
  title: string;
  rows: MabcRow[];
  scores: Record<string, { p?: string; ns?: string }>;
}) {
  return (
    <div className="my-3 break-inside-avoid">
      <p className="text-[12px] font-semibold text-slate-700 mb-1">{title}</p>
      <table className="w-full text-[12px] border border-slate-300 border-collapse">
        <thead>
          <tr className="bg-slate-100 text-left">
            <th className="border border-slate-300 px-2 py-1 font-semibold">
              ÉPREUVE
            </th>
            <th className="border border-slate-300 px-2 py-1 font-semibold">
              PERFORMANCE
            </th>
            <th className="border border-slate-300 px-2 py-1 font-semibold text-center w-20">
              N.S
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="border border-slate-300 px-2 py-1">{r.epreuve}</td>
              <td className="border border-slate-300 px-2 py-1 whitespace-pre-wrap">
                {scores[r.key]?.p ?? ""}
              </td>
              <td
                className="border border-slate-300 px-2 py-1 text-center font-semibold"
                style={{ color: nsColor(scores[r.key]?.ns) }}
              >
                {scores[r.key]?.ns ?? ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
