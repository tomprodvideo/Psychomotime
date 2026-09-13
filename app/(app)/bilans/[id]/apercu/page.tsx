/* eslint-disable @next/next/no-img-element */
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data";
import type { Bilan, BilanSectionConfig, Patient } from "@/lib/types";
import {
  BILAN_META,
  MABC_BLOCK_TITLES,
  MABC_GROUPS,
  DUNN_BANDS,
  DUNN_TABLES,
  SCORE_INTERPRETATION,
  bilanFontCss,
  bilanHeading,
  bilanLabel,
  getBilanConfig,
  nsColor,
  resolveBilanSections,
  testLabel,
  type MabcRow,
} from "@/lib/constants";
import { frDate } from "@/lib/format";
import { formatAgeAt } from "@/lib/age";
import GaussianCurve from "@/components/GaussianCurve";
import ApercuActions from "./ApercuActions";
import { BandeauEtat, CoqueDocument } from "@/components/Imprimable";

import type { Metadata } from "next";
/* LE TITRE EST STATIQUE, ET C'EST DÉLIBÉRÉ. Un titre qui porterait le nom du
   patient le ferait entrer dans l'historique du navigateur, parfois synchronisé
   entre appareils, parfois affiché devant quelqu'un d'autre. C'est le même
   raisonnement que celui de la page de consultation publique, et il vaut
   autant ici. Distinguer les pages entre elles suffit. */
export const metadata: Metadata = { title: "Aperçu d'un bilan · Psychomotime" };


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
  const blocks = parseJSON<
    Record<string, { id: string; title?: string; test?: string }[]>
  >(
    content.__blocks__,
    {},
  );
  const images = parseJSON<Record<string, string[]>>(content.__images__, {});
  const flags = parseJSON<{ adaptations?: boolean; preconisations?: boolean }>(
    content.__flags__,
    {},
  );
  const tests = b.tests ?? {};
  const dunn = tests.dunn ?? {};
  const profile = settings.profile ?? {};
  const bySection = tests.bySection ?? {};
  const legacyUsed = tests.used ?? [];
  const group = MABC_GROUPS.find((g) => g.group === tests.mabc3_group) ?? null;
  const scores = tests.mabc3 ?? {};
  const mabcInSection = (sectionId: string) =>
    (bySection[sectionId] ?? []).includes("mabc3") ||
    legacyUsed.includes("mabc3");

  let patient: Patient | null = null;
  let prescripteurDuParcours = "";
  if (b.patient_id) {
    const { data: p } = await supabase
      .from("patients")
      .select("*")
      .eq("id", b.patient_id)
      .maybeSingle();
    patient = (p as Patient) ?? null;

    /* LE MÉDECIN PRESCRIPTEUR AVAIT DISPARU DU DOCUMENT, EN SILENCE.
     *
     * La ligne le cherchait dans `patient.dossier.prescripteur` — une colonne
     * de la table v1, que la bascule du lot 1 a déversée dans `care_pathways`
     * et qui n'existe plus. L'accès optionnel faisait que rien ne cassait :
     * la mention s'est simplement arrêtée d'apparaître sur tous les bilans
     * postérieurs à la bascule, sans message, sans trace.
     *
     * On la relit donc là où elle vit désormais. ET ON NE DEVINE PAS : si le
     * dossier porte plusieurs parcours désignant des prescripteurs
     * différents, on n'en choisit aucun. Inscrire le mauvais nom de médecin
     * sur un compte rendu est pire que de n'en inscrire aucun — le bilan
     * n'étant rattaché à aucun parcours, rien ne permet de trancher. */
    const { data: parcours } = await supabase
      .from("care_pathways")
      .select("prescriber_contact_id, contacts:contacts!care_pathways_prescriber_contact_id_fkey(first_name, last_name, organisation_name)")
      .eq("patient_id", b.patient_id)
      .not("prescriber_contact_id", "is", null);

    const noms = [
      ...new Set(
        ((parcours ?? []) as unknown as {
          contacts: {
            first_name: string | null;
            last_name: string | null;
            organisation_name: string | null;
          } | null;
        }[])
          .map((r) =>
            r.contacts
              ? (r.contacts.organisation_name?.trim() ||
                  `${r.contacts.first_name ?? ""} ${r.contacts.last_name ?? ""}`.trim())
              : "",
          )
          .filter((n) => n !== ""),
      ),
    ];
    prescripteurDuParcours = noms.length === 1 ? noms[0] : "";
  }


  /* L'AUTEUR EST CELUI DU BILAN, PAS CELUI D'AUJOURD'HUI.
   *
   * La précédence était inversée : les paramètres courants l'emportaient sur
   * l'auteur enregistré. Changer son nom d'affichage réécrivait donc l'auteur
   * de TOUS les comptes rendus déjà remis — y compris ceux signés par une
   * remplaçante. Un document remis ne change pas de signataire.
   *
   * Vérifié avant d'inverser : les sept bilans de la base portent un auteur,
   * donc personne ne perd sa signature au change. */
  const author = b.author?.trim() || settings.display_name || "Psychomotricien(ne)";
  const birth = patient?.birth_date;
  const usedLabels =
    Object.values(bySection).some((a) => a.length > 0) ||
    legacyUsed.length > 0;
  const bilanType =
    content.__type__ === "sensoriel" ? "sensoriel" : "psychomoteur";

  /* L'ENVELOPPE DIT LE MÊME BILAN QUE LE DOCUMENT. Elle annonçait « bilan
   * psychomoteur » quel que soit le type : un bilan sensoriel partait sous un
   * intitulé faux, alors que le titre imprimé, lui, était correct. C'était la
   * seule ligne du produit qui écrivait une fausseté dans un courriel sortant.
   * Relevé par la relecture du moteur de bilans. */
  const nomDuBilan = bilanLabel(bilanType);
  const subject = `${nomDuBilan} - ${b.patient_name}`;
  const body = `Bonjour,\n\nVeuillez trouver le compte rendu du ${nomDuBilan.toLowerCase()} de ${
    b.patient_name
  }${b.bilan_date ? ` (${frDate(b.bilan_date)})` : ""}.\n\nBien cordialement,\n${
    settings.display_name ?? b.author ?? ""
  }`;

  const sections = resolveBilanSections(profile, bilanType);
  const anamneseTitle =
    sections.find((s) => s.id === "anamnese")?.title ?? "L'anamnèse";
  const conclusionTitle =
    sections.find((s) => s.id === "conclusion")?.title ?? "Conclusion";
  const cfg = getBilanConfig(profile, bilanType);
  const conclusionTop = !!cfg.conclusion_top;
  const closingNote = cfg.closing_note;
  const accent = cfg.theme_color;
  const fontFamily = bilanFontCss(cfg.bilan_font);
  const titleStyle = cfg.bilan_title_style;
  // Variante d'affichage d'un titre : sous-titre, encadré, souligné ou simple.
  const headingVariant = (item: BilanSectionConfig) =>
    item.level === "subtitle"
      ? "subtitle"
      : (item.boxed ?? titleStyle === "boxed")
        ? "boxed"
        : titleStyle === "underline"
          ? "underline"
          : "plain";
  const conclusionItem = sections.find((s) => s.id === "conclusion");
  const conclusionVariant = conclusionItem
    ? headingVariant(conclusionItem)
    : titleStyle;
  const anamneseItem = sections.find((s) => s.id === "anamnese");
  const anamneseVariant = anamneseItem
    ? headingVariant(anamneseItem)
    : "boxed";
  // Lieu du « Fait à … » : réglé dans le bilan, sinon ville du cabinet.
  const lieu = content.lieu || profile.city || "";
  // Médecin prescripteur : le champ figé du bilan s'il existe (bilans repris
  // de la v1), sinon celui du parcours de soin — et seulement s'il n'y a pas
  // d'ambiguïté.
  const prescripteur = content.prescripteur || prescripteurDuParcours;

  // Formule de fin (« Je reste disponible… »), placée dans la conclusion.
  const closingLine = closingNote.trim() ? (
    <p className="text-slate-500 whitespace-pre-wrap mt-3">{closingNote}</p>
  ) : null;

  // Nom + signature, affichés sous la formule de fin, dans la conclusion.
  const signatureBlock = (
    <div className="mt-6 text-right text-[12px]">
      <p className="font-semibold text-slate-900">{author}</p>
      {cfg.signature_url && (
        <img
          src={cfg.signature_url}
          alt="Signature"
          className="inline-block max-h-20 w-auto object-contain mt-1"
        />
      )}
    </div>
  );

  function mabcTables(
    sectionId: string,
    blockKeys?: ("equilibre" | "oculo" | "dexterite")[],
  ) {
    if (!group || !blockKeys || !mabcInSection(sectionId)) return null;
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
        const heading = x.title?.trim() || (x.test ? testLabel(x.test) : "");
        return (
          <div key={x.id} className="mt-2">
            {heading && (
              <h3
                className="font-semibold italic text-[13px] mb-1"
                style={{ color: "var(--accent)" }}
              >
                {heading}
              </h3>
            )}
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
    <CoqueDocument
      retour={{ href: `/bilans/${b.id}`, libelle: "Retour à l'édition" }}
      actions={
        <ApercuActions
          patientEmail={patient?.email ?? null}
          subject={subject}
          body={body}
        />
      }
      /* Le bilan n'avait AUCUN rappel de page — c'est pourtant le plus long
         des documents remis, et le seul qui s'imprime aussi en brouillon. */
      rappel={{
        nature: nomDuBilan,
        personne: b.patient_name,
        date: b.bilan_date ? `passation du ${frDate(b.bilan_date)}` : null,
      }}
      style={
        {
          ["--accent" as string]: accent,
          fontFamily,
        } as React.CSSProperties
      }
      /* UN BROUILLON NE SORT PAS DE L'IMPRIMANTE COMME UN DOCUMENT ABOUTI.
       *
       * Le statut existait à l'écran — « ● Finalisé » / « ○ Brouillon » — et ne
       * figurait NULLE PART sur la page imprimée : un bilan en cours de
       * rédaction s'imprimait à l'identique d'un bilan achevé, signature
       * comprise. C'est le § C-1 de la sécurité clinique, et le risque est
       * l'attribution : une famille, une école, un médecin lisent un document
       * de travail comme s'il était la parole du praticien.
       *
       * La comptabilité, elle, REFUSE d'imprimer un brouillon. Ici le refus
       * serait mauvais : on relit un bilan en le regardant, et l'imprimer pour
       * l'annoter fait partie du travail. On ne bloque donc pas — on marque, et
       * on le marque aussi sur le papier. Trait TIRETÉ : c'est un état
       * transitoire, à l'inverse d'une annulation. */
      bandeau={
        b.status !== "finalisé" && (
          <BandeauEtat ton="avis" trait="tirete" titre="Brouillon — document de travail">
            Ce bilan n&apos;est pas finalisé. Il peut être incomplet ou modifié, et
            ne constitue pas le compte rendu remis.
          </BandeauEtat>
        )
      }
    >
          {/* En-tête praticien */}
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
                <p className="font-semibold text-slate-900">{author}</p>
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
                {profile.siret && <p>SIRET : {profile.siret}</p>}
              </div>
            </div>
            <p className="text-[12px] text-slate-600 mt-4 text-right">
              {lieu ? `Fait à ${lieu}, le ` : "Le "}
              {b.bilan_date ? frDate(b.bilan_date) : "…"}
            </p>
            <h1
              className="text-center text-2xl font-semibold tracking-wide mt-6 mb-2"
              style={{ color: "var(--accent)" }}
            >
              {bilanHeading(bilanType)}
            </h1>
          </header>

          {/* Encart détail patient (AU-DESSUS de l'anamnèse) */}
          {(b.patient_name ||
            birth ||
            prescripteur ||
            BILAN_META.some((f) => content[f.id]?.trim())) && (
            <div
              className="border-2 border-dashed rounded-lg p-4 text-[12px] mb-5 break-inside-avoid"
              style={{ borderColor: "var(--accent)" }}
            >
              <p>
                <span className="text-slate-500">Enfant concerné : </span>
                <strong>{b.patient_name || "—"}</strong>
                {/* L'ÂGE EST CELUI DE LA PASSATION, pas celui du jour où l'on
                    imprime. Un bilan passé en février et réimprimé en septembre
                    affichait sept mois de trop — sur un document dont toute la
                    lecture repose sur des normes par classe d'âge. `lib/age.ts`
                    existait déjà pour cela et n'était appelé nulle part ici. */}
                {birth && (
                  <>
                    , né(e) le {frDate(birth)}
                    {b.bilan_date && ` (${formatAgeAt(birth, b.bilan_date)} à la passation)`}
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
              {prescripteur && (
                <p>
                  <span className="text-slate-500">Médecin prescripteur : </span>
                  {prescripteur}
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

          {/* Conclusion en tête (encadré grisé), si activée */}
          {conclusionTop &&
            (content.conclusion?.trim() ||
              hasExtras("conclusion") ||
              closingNote.trim() ||
              cfg.signature_url) && (
              <section className="mb-5 break-inside-avoid bg-slate-50 border border-slate-200 rounded-lg p-4">
                <SectionTitle variant={conclusionVariant}>
                  {conclusionTitle}
                </SectionTitle>
                {content.conclusion?.trim() && (
                  <p className="whitespace-pre-wrap text-justify">
                    {content.conclusion}
                  </p>
                )}
                {sectionExtras("conclusion")}
                {closingLine}
                {signatureBlock}
              </section>
            )}

          {/* Anamnèse (narratif) */}
          {(content.anamnese?.trim() || hasExtras("anamnese")) && (
            <section className="mb-5 break-inside-avoid">
              <SectionTitle variant={anamneseVariant}>
                {anamneseTitle}
              </SectionTitle>
              {content.anamnese?.trim() && (
                <p className="whitespace-pre-wrap text-justify">
                  {content.anamnese}
                </p>
              )}
              {sectionExtras("anamnese")}
            </section>
          )}

          {/* Corps du bilan : trame personnalisable (hors anamnèse & conclusion) */}
          {sections
            .filter((s) => s.id !== "anamnese" && s.id !== "conclusion")
            .map((s) => {
              // Section auto « Résultats chiffrés »
              if (s.kind === "scores") {
                // Bilan sensoriel : les 3 tableaux à cocher du Profil de Dunn 2.
                if (bilanType === "sensoriel") {
                  return (
                    <section key={s.id} className="mb-5 break-inside-avoid">
                      <SectionTitle variant={headingVariant(s)}>
                        {s.title}
                      </SectionTitle>
                      {DUNN_TABLES.map((tbl) => (
                        <div key={tbl.key} className="my-3 break-inside-avoid">
                          <p className="text-center font-semibold text-[12px] uppercase tracking-wide mb-1">
                            {tbl.title}
                          </p>
                          <table className="w-full text-[11px] border border-slate-300 border-collapse">
                            <thead>
                              <tr className="bg-slate-100">
                                <th className="border border-slate-300 px-2 py-1 text-left font-semibold">
                                  Par rapport à la moyenne
                                </th>
                                {DUNN_BANDS.map((band) => (
                                  <th
                                    key={band}
                                    className="border border-slate-300 px-1 py-1 text-center font-medium italic w-[15%]"
                                  >
                                    {band}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {tbl.rows.map((r) => {
                                const sel = dunn[r.key];
                                return (
                                  <tr key={r.key}>
                                    <td className="border border-slate-300 px-2 py-1 align-top">
                                      <span className="font-semibold">
                                        {r.label}
                                      </span>
                                      {r.desc && (
                                        <span className="block text-slate-500 text-[10px] leading-tight">
                                          {r.desc}
                                        </span>
                                      )}
                                    </td>
                                    {DUNN_BANDS.map((_, i) => (
                                      <td
                                        key={i}
                                        className="border border-slate-300 px-1 py-1 text-center align-middle font-bold"
                                        style={
                                          sel === i
                                            ? {
                                                backgroundColor: "var(--accent)",
                                                color: "#fff",
                                              }
                                            : undefined
                                        }
                                      >
                                        {sel === i ? "✓" : ""}
                                      </td>
                                    ))}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </section>
                  );
                }
                // Bilan psychomoteur : interprétation DS/NS + courbe de Gauss.
                if (!usedLabels) return null;
                return (
                  <section key={s.id} className="mb-5 break-inside-avoid">
                    <SectionTitle variant={titleStyle}>{s.title}</SectionTitle>
                    <p className="text-[12px] mb-2">
                      {SCORE_INTERPRETATION.intro}
                    </p>
                    <div className="grid sm:grid-cols-2 gap-3 text-[12px]">
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                        <p className="font-semibold mb-1">
                          Déviations standards (DS)
                        </p>
                        <ul className="list-disc pl-4 space-y-0.5">
                          {SCORE_INTERPRETATION.ds.map((l, i) => (
                            <li key={l} style={{ color: ZONE_TEXT[i] }}>
                              {l}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                        <p className="font-semibold mb-1">
                          Notes standards (NS)
                        </p>
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
                      {cfg.gaussian_curve_url ? (
                        <img
                          src={cfg.gaussian_curve_url}
                          alt="Courbe de Gauss"
                          className="mx-auto max-h-80 w-auto object-contain"
                        />
                      ) : (
                        <GaussianCurve />
                      )}
                    </div>
                  </section>
                );
              }

              const text = content[s.id]?.trim();
              const sel = bySection[s.id] ?? [];
              const isSub = s.level === "subtitle";
              return (
                <section
                  key={s.id}
                  className={`${isSub ? "mb-3" : "mb-5"} break-inside-avoid`}
                >
                  <SectionTitle variant={headingVariant(s)}>
                    {s.title}
                  </SectionTitle>
                  {sel.length > 0 && (
                    <p className="text-[11px] italic text-slate-500 mb-1">
                      Test(s) : {sel.map((t) => testLabel(t)).join(" · ")}
                    </p>
                  )}
                  {text && (
                    <p className="whitespace-pre-wrap text-justify">{text}</p>
                  )}
                  {mabcTables(s.id, s.mabcBlocks)}
                  {sectionExtras(s.id)}
                </section>
              );
            })}

          {/* Conclusion (en bas, sauf si affichée en tête) */}
          {!conclusionTop &&
            (content.conclusion?.trim() ||
              hasExtras("conclusion") ||
              closingNote.trim() ||
              cfg.signature_url) && (
            <section className="mb-6 break-inside-avoid">
              <SectionTitle variant={conclusionVariant}>
                {conclusionTitle}
              </SectionTitle>
              {content.conclusion?.trim() && (
                <p className="whitespace-pre-wrap text-justify">
                  {content.conclusion}
                </p>
              )}
              {sectionExtras("conclusion")}
              {closingLine}
              {signatureBlock}
            </section>
          )}

          {/* Adaptations */}
          {flags.adaptations && content.adaptations?.trim() && (
            <section className="mb-5 break-inside-avoid">
              <SectionTitle variant={titleStyle}>Adaptations</SectionTitle>
              <p className="whitespace-pre-wrap text-justify">
                {content.adaptations}
              </p>
            </section>
          )}

          {/* Préconisations */}
          {flags.preconisations && content.preconisations?.trim() && (
            <section className="mb-6 break-inside-avoid">
              <SectionTitle variant={titleStyle}>Préconisations</SectionTitle>
              <p className="whitespace-pre-wrap text-justify">
                {content.preconisations}
              </p>
            </section>
          )}

          {/* Nom du praticien, tout en bas du bilan */}
          <footer className="mt-10 text-right text-[12px]">
            <p className="font-semibold text-slate-900">{author}</p>
          </footer>
    </CoqueDocument>
  );
}

function SectionTitle({
  children,
  variant = "underline",
}: {
  children: React.ReactNode;
  variant?: string;
}) {
  if (variant === "boxed") {
    return (
      <h2
        className="font-bold italic text-[15px] mb-3 border rounded-sm py-2 px-4 text-center"
        style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
      >
        {children}
      </h2>
    );
  }
  if (variant === "subtitle") {
    return (
      <h3
        className="font-semibold italic text-[13px] mb-1.5 mt-1"
        style={{ color: "var(--accent)" }}
      >
        {children}
      </h3>
    );
  }
  if (variant === "plain") {
    return (
      <h2
        className="font-bold italic text-[15px] mb-3 text-center"
        style={{ color: "var(--accent)" }}
      >
        {children}
      </h2>
    );
  }
  return (
    <h2
      className="font-bold text-slate-900 text-[14px] mb-2 pb-1 border-b-2 inline-block"
      style={{ borderColor: "var(--accent)" }}
    >
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
