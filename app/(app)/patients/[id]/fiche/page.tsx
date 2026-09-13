/* eslint-disable @next/next/no-img-element */
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data";
import type { Bilan } from "@/lib/types";
import { BILAN_TYPE_ORDER, BILAN_TYPE_UI, bilanTypeOf } from "@/lib/constants";
import { frDate } from "@/lib/format";
import { formatAgeAt } from "@/lib/age";
import { getCurrentPractice } from "@/lib/dossier/practice";
import {
  getPatient,
  listConsents,
  listNotes,
  listPathways,
  listPatientContacts,
} from "@/lib/dossier/queries";
import {
  contactName,
  CONSENT_LABELS,
  FUNDING_LABELS,
  LEGAL_BASIS_LABELS,
  PATHWAY_STATUS_LABELS,
  patientName,
  ROLE_LABELS,
} from "@/lib/dossier/types";
import { CoqueDocument } from "@/components/Imprimable";

import type { Metadata } from "next";
/* LE TITRE EST STATIQUE, ET C'EST DÉLIBÉRÉ. Un titre qui porterait le nom du
   patient le ferait entrer dans l'historique du navigateur, parfois synchronisé
   entre appareils, parfois affiché devant quelqu'un d'autre. C'est le même
   raisonnement que celui de la page de consultation publique, et il vaut
   autant ici. Distinguer les pages entre elles suffit. */
export const metadata: Metadata = { title: "Fiche du dossier · Psychomotime" };


/**
 * Fiche patient imprimable.
 *
 * DEUX RÈGLES TENUES ICI.
 *
 * 1. **Une donnée absente est OMISE.** Jamais « — », jamais « N/A », jamais une
 *    valeur neutre. C'est la règle de sécurité clinique la mieux tenue du
 *    produit, et elle ne doit pas se perdre dans une réécriture.
 *
 * 2. **Les informations marquées « venant d'un tiers » ne sont pas imprimées.**
 *    L'article L1111-7 du code de la santé publique exclut du droit d'accès du
 *    patient les informations recueillies auprès d'un tiers n'intervenant pas
 *    dans la prise en charge, ou concernant un tel tiers. Ce document étant
 *    destiné à sortir du cabinet, il applique cette exclusion par défaut — et
 *    le dit, pour que le praticien sache ce qu'il ne tient pas en main.
 */
export default async function FichePatientImprimable({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const practice = await getCurrentPractice();
  if (!practice) notFound();

  const patient = await getPatient(practice, id);
  if (!patient) notFound();

  const settings = await getSettings();
  const profile = settings.profile ?? {};
  const accent = profile.theme_color || "#2f8a82";

  const supabase = await createClient();
  const [entourage, parcours, notes, consentements, bilansRaw] = await Promise.all([
    listPatientContacts(practice, patient.id),
    listPathways(practice, patient.id),
    listNotes(practice, patient.id, 50),
    listConsents(practice, patient.id),
    supabase
      .from("bilans")
      .select("id, title, bilan_date, status, content")
      .eq("patient_id", patient.id)
      .order("bilan_date", { ascending: false }),
  ]);

  const bilans = (bilansRaw.data ?? []) as Pick<
    Bilan,
    "id" | "title" | "bilan_date" | "status" | "content"
  >[];
  const groupesBilans = BILAN_TYPE_ORDER.map((type) => ({
    type,
    ui: BILAN_TYPE_UI[type],
    list: bilans.filter((b) => bilanTypeOf(b.content) === type),
  })).filter((g) => g.list.length > 0);

  // Le document est daté du jour de son édition : l'âge s'y lit donc à cette
  // date, explicitement, et non par une lecture d'horloge cachée.
  const edite = new Date();
  const age = formatAgeAt(patient.birth_date, edite);

  const liensActifs = entourage.filter((l) => !l.valid_to);
  const notesPubliables = notes.filter((n) => !n.third_party_information);
  const notesRetenues = notes.length - notesPubliables.length;
  const consentementsActifs = consentements.filter((c) => !c.withdrawn_on);

  return (
    <CoqueDocument
      retour={{ href: `/patients/${patient.id}`, libelle: "Retour au dossier" }}
      /* La fiche n'avait AUCUN rappel de page. C'est pourtant un document
         vivant — il reflète le dossier du jour de son édition — et deux
         tirages faits à des jours différents peuvent différer : la date en
         marge de chaque page est la même que celle de l'en-tête. */
      rappel={{
        nature: "Fiche patient",
        personne: patientName(patient),
        date: `éditée le ${frDate(edite.toISOString().slice(0, 10))}`,
      }}
      style={{ ["--accent" as string]: accent } as React.CSSProperties}
    >
          <header className="mb-6">
            <div className="flex items-start gap-4">
              {profile.logo_url && (
                <img
                  src={profile.logo_url}
                  alt=""
                  className="h-16 w-16 object-contain"
                />
              )}
              <div className="text-[12px] leading-snug text-slate-700">
                <p className="font-semibold text-slate-900">
                  {settings.display_name ?? practice.practiceName}
                </p>
                {profile.address &&
                  profile.address.split("\n").map((l, i) => <p key={i}>{l}</p>)}
                {(profile.postal_code || profile.city) && (
                  <p>{[profile.postal_code, profile.city].filter(Boolean).join(" ")}</p>
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
            <p className="text-center text-[11px] text-slate-500 mt-1">
              Éditée le {frDate(edite.toISOString().slice(0, 10))}
              {patient.status === "archive" && " · dossier archivé"}
            </p>
          </header>

          <Section>Identité</Section>
          <div className="grid grid-cols-2 gap-y-1 gap-x-6 mb-5">
            <Ligne label="Nom et prénom" valeur={patientName(patient)} />
            <Ligne
              label="Date de naissance"
              valeur={
                patient.birth_date
                  ? `${frDate(patient.birth_date)}${age ? ` (${age} à cette date)` : ""}`
                  : null
              }
            />
            <Ligne label="Nom de naissance" valeur={patient.birth_name} />
            <Ligne label="Téléphone" valeur={patient.phone} />
            <Ligne label="Courriel" valeur={patient.email} />
            <Ligne
              label="Adresse"
              valeur={[
                patient.address_line1,
                patient.address_line2,
                [patient.postal_code, patient.city].filter(Boolean).join(" "),
              ]
                .filter(Boolean)
                .join(", ") || null}
              pleineLargeur
            />
          </div>

          {liensActifs.length > 0 && (
            <>
              <Section>Entourage</Section>
              <div className="mb-5 space-y-1">
                {liensActifs.map((l) => (
                  <div key={l.id} className="flex flex-wrap gap-x-2">
                    <span className="text-slate-500">{ROLE_LABELS[l.role]} :</span>
                    <span className="font-medium">{contactName(l.contact)}</span>
                    <span className="text-slate-500">
                      {[
                        l.relationship,
                        l.legal_basis ? LEGAL_BASIS_LABELS[l.legal_basis] : null,
                        l.contact.phone,
                        l.contact.email,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {parcours.length > 0 && (
            <>
              <Section>Parcours de prise en soin</Section>
              <div className="mb-5 space-y-3">
                {parcours.map((p) => (
                  <div key={p.id}>
                    <p className="font-medium">
                      {p.label ?? "Parcours"}{" "}
                      <span className="font-normal text-slate-500">
                        — {PATHWAY_STATUS_LABELS[p.status]}
                        {p.funding_scheme && ` · ${FUNDING_LABELS[p.funding_scheme]}`}
                      </span>
                    </p>
                    <div className="grid grid-cols-2 gap-y-0.5 gap-x-6">
                      <Ligne
                        label="Période"
                        valeur={
                          p.started_on
                            ? `du ${frDate(p.started_on)}${p.ended_on ? ` au ${frDate(p.ended_on)}` : ""}`
                            : null
                        }
                      />
                      <Ligne
                        label="Prescription"
                        valeur={
                          p.prescription_date ? frDate(p.prescription_date) : null
                        }
                      />
                      <Ligne label="Motif" valeur={p.referral_reason} pleineLargeur />
                      <Ligne label="Motif de fin" valeur={p.end_reason} pleineLargeur />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {consentementsActifs.length > 0 && (
            <>
              <Section>Autorisations en cours</Section>
              <ul className="mb-5 space-y-1">
                {consentementsActifs.map((c) => (
                  <li key={c.id}>
                    <span className="font-medium">{CONSENT_LABELS[c.kind]}</span>
                    {c.scope && <span className="text-slate-600"> — {c.scope}</span>}
                    {c.granted_on && (
                      <span className="text-slate-500">
                        {" "}
                        (accordée le {frDate(c.granted_on)})
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}

          {groupesBilans.length > 0 && (
            <>
              <Section>Bilans</Section>
              {groupesBilans.map(({ type, ui, list }) => (
                <div key={type} className="mb-3">
                  <p className="text-slate-500 mb-1">{ui.label}</p>
                  <ul className="space-y-1">
                    {list.map((b) => (
                      <li key={b.id} className="flex justify-between">
                        <span>{b.title}</span>
                        <span className="text-slate-500">
                          {b.bilan_date ? frDate(b.bilan_date) : ""} · {b.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </>
          )}

          {notesPubliables.length > 0 && (
            <>
              <Section>Notes</Section>
              <div className="mb-5 space-y-2">
                {notesPubliables.map((n) => (
                  <div key={n.id}>
                    <p className="text-slate-500 text-[11px]">{frDate(n.written_on)}</p>
                    <p className="whitespace-pre-wrap">{n.body}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* UN DOCUMENT QUI OMET DU CONTENU DOIT LE DIRE SUR LE PAPIER.
              Cet avertissement vivait dans la barre `no-print` : il ne
              s'adressait qu'à celle qui imprime, jamais à celui qui reçoit. Le
              tirage ne disait donc jamais qu'il était incomplet.
              Relevé par la relecture métier de la fiche. */}
          {notesRetenues > 0 && (
            <p className="mt-8 pt-4 border-t border-slate-100 text-[11px] text-slate-600">
              {notesRetenues} note{notesRetenues > 1 ? "s" : ""} du dossier
              {notesRetenues > 1 ? " sont marquées" : " est marquée"} « information
              d&apos;un tiers » et ne figure{notesRetenues > 1 ? "nt" : ""} pas sur
              ce document. L&apos;article L1111-7 du code de la santé publique les
              exclut du droit d&apos;accès.
            </p>
          )}

          <footer className="mt-8 pt-4 border-t border-slate-100 text-[11px] text-slate-500 text-center">
            Document confidentiel · {patientName(patient)}
          </footer>
    </CoqueDocument>
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

/**
 * Une ligne du document.
 *
 * Une valeur absente ne rend RIEN — pas un tiret, pas « non renseigné ». C'est
 * l'invariant : l'absence de donnée n'est jamais convertie en information.
 */
function Ligne({
  label,
  valeur,
  pleineLargeur,
}: {
  label: string;
  valeur?: string | null;
  pleineLargeur?: boolean;
}) {
  if (!valeur) return null;
  return (
    <div className={pleineLargeur ? "col-span-2" : ""}>
      <span className="text-slate-500">{label} : </span>
      <span className="text-slate-800 whitespace-pre-wrap">{valeur}</span>
    </div>
  );
}
