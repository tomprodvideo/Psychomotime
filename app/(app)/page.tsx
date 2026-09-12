import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  Clock,
  FileText,
  Hourglass,
  Users,
} from "lucide-react";
import { getSettings } from "@/lib/data";
import { frDate } from "@/lib/format";
import { formatCents } from "@/lib/money";
import { Card, StatCard } from "@/components/ui";
import { getCurrentPractice } from "@/lib/dossier/practice";
import { getJourneeResume } from "@/lib/dossier/queries";
import { listDocuments } from "@/lib/compta/queries";
import {
  APPOINTMENT_KIND_LABELS,
  ATTENDANCE_LABELS,
  patientName,
} from "@/lib/dossier/types";
import AttendanceControl from "./agenda/AttendanceControl";
import CreatePracticeCard from "./patients/CreatePracticeCard";

import type { Metadata } from "next";
/* LE TITRE EST STATIQUE, ET C'EST DÉLIBÉRÉ. Un titre qui porterait le nom du
   patient le ferait entrer dans l'historique du navigateur, parfois synchronisé
   entre appareils, parfois affiché devant quelqu'un d'autre. C'est le même
   raisonnement que celui de la page de consultation publique, et il vaut
   autant ici. Distinguer les pages entre elles suffit. */
export const metadata: Metadata = { title: "Accueil · Psychomotime" };


/**
 * Accueil — orienté AUJOURD'HUI.
 *
 * CE QUI A CHANGÉ. L'accueil ne montrait que la comptabilité de l'année, et
 * pour l'afficher il chargeait TOUTES les factures du compte. Une praticienne
 * qui ouvre son logiciel à huit heures ne cherche pas son revenu annuel :
 * elle cherche sa journée, et ce qu'elle a laissé en suspens.
 *
 * L'ordre des blocs est celui de l'urgence réelle : la journée, puis ce qui
 * n'a pas été renseigné — parce que tant qu'un créneau ne l'est pas, il ne
 * compte nulle part et bloque tout ce qui vient après.
 */
export default async function AccueilPage() {
  const practice = await getCurrentPractice();
  const settings = await getSettings();

  if (!practice) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold text-slate-800 mb-1">Bienvenue</h1>
        <p className="text-sm text-slate-500 mb-6">
          Une dernière étape avant de commencer.
        </p>
        <CreatePracticeCard />
      </div>
    );
  }

  // L'instant est choisi une fois ; toutes les bornes en découlent.
  const maintenant = new Date();
  const resume = await getJourneeResume(practice, maintenant);

  // L'activité de l'année, lue sur le modèle cible. Les totaux viennent du même
  // calcul que l'écran de comptabilité — il n'y a qu'une seule définition de ce
  // qu'est un « facturé », et elle est écrite une fois, dans `lib/compta`.
  const annee = maintenant.getFullYear();
  const { totaux } = await listDocuments(practice, {
    du: `${annee}-01-01`,
    au: `${annee}-12-31`,
  });
  const facture = totaux.emis_cents;
  const encaisse = totaux.encaisse_cents;

  const prenom = (settings.display_name ?? "").split(" ")[0] || "";
  const dateDuJour = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(maintenant);

  const aVenirAujourdhui = resume.aujourdhui.filter(
    (a) => new Date(a.starts_at) >= maintenant && a.attendance === "a_venir",
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">
          Bonjour{prenom ? ` ${prenom}` : ""}
        </h1>
        <p className="text-sm text-slate-500 mt-0.5 first-letter:uppercase">
          {dateDuJour}
        </p>
      </div>

      {/* ------------------------------------------------ à renseigner */}
      {resume.aQualifier.length > 0 && (
        <section
          aria-labelledby="titre-a-renseigner"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-5"
        >
          <h2
            id="titre-a-renseigner"
            className="flex items-center gap-2 font-medium text-amber-900"
          >
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            {resume.aQualifier.length} rendez-vous passé
            {resume.aQualifier.length > 1 ? "s" : ""} à renseigner
          </h2>
          <p className="text-sm text-amber-800 mt-1">
            Tant qu&apos;un créneau n&apos;est pas renseigné, il ne compte ni
            comme séance réalisée, ni comme absence — et il ne peut nourrir
            aucune attestation de présence.
          </p>
          <ul className="mt-3 space-y-2 list-none p-0 m-0">
            {resume.aQualifier.slice(0, 5).map((rdv) => (
              <li
                key={rdv.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2"
              >
                <span className="text-sm min-w-0">
                  <span className="font-medium text-slate-800">
                    {rdv.patient ? patientName(rdv.patient) : (rdv.title ?? "Créneau")}
                  </span>
                  <span className="text-slate-500">
                    {" — "}
                    {frDate(rdv.starts_at.slice(0, 10))}
                  </span>
                </span>
                {practice.canWrite && <AttendanceControl appointment={rdv} compact />}
              </li>
            ))}
          </ul>
          {resume.aQualifier.length > 5 && (
            <Link
              href="/agenda"
              className="inline-block text-sm font-medium text-amber-900 underline mt-2"
            >
              Voir les {resume.aQualifier.length - 5} autres
            </Link>
          )}
        </section>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        {/* ------------------------------------------------ la journée */}
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-brand-600" aria-hidden="true" />
              Aujourd&apos;hui
            </h2>
            <Link
              href="/agenda"
              className="text-sm text-brand-700 hover:underline flex items-center gap-1"
            >
              Agenda <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>

          {resume.aujourdhui.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">
              Rien de prévu aujourd&apos;hui.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 list-none p-0 m-0">
              {resume.aujourdhui.map((rdv) => {
                const debut = new Date(rdv.starts_at);
                const passe = debut < maintenant;
                const annule = rdv.attendance.startsWith("annule");
                return (
                  <li
                    key={rdv.id}
                    className={`flex flex-wrap items-center justify-between gap-2 py-2.5 ${
                      annule ? "opacity-60" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-sm font-medium text-slate-700 tabular-nums">
                        {new Intl.DateTimeFormat("fr-FR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(debut)}
                      </span>
                      <span className="min-w-0">
                        <span
                          className={`block text-sm text-slate-800 ${annule ? "line-through" : ""}`}
                        >
                          {rdv.patient ? (
                            <Link
                              href={`/patients/${rdv.patient.id}`}
                              className="hover:text-brand-700 hover:underline"
                            >
                              {patientName(rdv.patient)}
                            </Link>
                          ) : (
                            (rdv.title ?? "Créneau")
                          )}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {APPOINTMENT_KIND_LABELS[rdv.kind]}
                          {rdv.attendance !== "a_venir" &&
                            ` · ${ATTENDANCE_LABELS[rdv.attendance]}`}
                        </span>
                      </span>
                    </div>
                    {practice.canWrite && passe && rdv.attendance === "a_venir" && (
                      <AttendanceControl appointment={rdv} compact />
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {aVenirAujourdhui.length > 0 && (
            <p className="flex items-center gap-1.5 text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              Prochain à {new Intl.DateTimeFormat("fr-FR", {
                hour: "2-digit",
                minute: "2-digit",
              }).format(new Date(aVenirAujourdhui[0].starts_at))}
              {resume.semaineCount > 0 &&
                ` · ${resume.semaineCount} rendez-vous dans les sept prochains jours`}
            </p>
          )}
        </Card>

        {/* ------------------------------------------------ à droite */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Dossiers actifs"
              value={String(resume.patientsActifs)}
              accent="brand"
            />
            <StatCard
              label="Suivis en cours"
              value={String(resume.parcoursActifs)}
              accent="emerald"
            />
          </div>

          {/* ------------------------------------------ liste d'attente */}
          <Card className="p-5">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2 mb-3">
              <Hourglass className="h-4 w-4 text-amber-600" aria-hidden="true" />
              Liste d&apos;attente
            </h2>
            {resume.attente.length === 0 ? (
              <p className="text-sm text-slate-500">Personne n&apos;attend.</p>
            ) : (
              <ul className="space-y-2 list-none p-0 m-0">
                {resume.attente.map((p) => {
                  const jours = p.waitlisted_on
                    ? Math.floor(
                        (maintenant.getTime() -
                          new Date(`${p.waitlisted_on}T00:00:00`).getTime()) /
                          86_400_000,
                      )
                    : null;
                  return (
                    <li key={p.id} className="text-sm">
                      <Link
                        href={`/patients/${p.patient_id}`}
                        className="font-medium text-slate-800 hover:text-brand-700 hover:underline"
                      >
                        {p.patient ? patientName(p.patient) : "Dossier"}
                      </Link>
                      <span className="block text-xs text-slate-500">
                        {jours !== null
                          ? `Depuis ${jours} jour${jours > 1 ? "s" : ""}`
                          : "Date d'entrée non renseignée"}
                        {p.waitlist_priority === "prioritaire" && " · prioritaire"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* ------------------------------------------------ activité */}
          <Card className="p-5">
            <h2 className="font-semibold text-slate-800 mb-3">Activité {annee}</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-slate-500">Facturé</dt>
                <dd className="font-semibold text-slate-800 tabular-nums">
                  {formatCents(facture)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-slate-500">Encaissé</dt>
                <dd className="font-semibold text-brand-700 tabular-nums">
                  {formatCents(encaisse)}
                </dd>
              </div>
              {facture > encaisse && (
                <div className="flex items-baseline justify-between gap-2 pt-2 border-t border-slate-100">
                  <dt className="text-slate-500">Reste à encaisser</dt>
                  <dd className="font-medium text-amber-700 tabular-nums">
                    {formatCents(totaux.reste_du_cents)}
                  </dd>
                </div>
              )}
            </dl>
            <p className="text-xs text-slate-500 mt-3">
              Facturé et encaissé sont deux choses différentes. Les estimations
              de charges se lisent dans la comptabilité, et ne remplacent ni
              votre comptabilité légale, ni votre expert-comptable.
            </p>
            <Link
              href="/comptabilite"
              className="inline-flex items-center gap-1 text-sm text-brand-700 hover:underline mt-2"
            >
              Comptabilité <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </Card>
        </div>
      </div>

      {/* ------------------------------------------------ accès rapides */}
      <div className="grid sm:grid-cols-3 gap-3 mt-5">
        <AccesRapide
          href="/agenda"
          icon={<CalendarDays className="h-5 w-5" />}
          titre="Poser un rendez-vous"
        />
        <AccesRapide
          href="/patients"
          icon={<Users className="h-5 w-5" />}
          titre="Ouvrir un dossier"
        />
        <AccesRapide
          href="/bilans/nouveau"
          icon={<FileText className="h-5 w-5" />}
          titre="Commencer un bilan"
        />
      </div>
    </div>
  );
}

function AccesRapide({
  href,
  icon,
  titre,
}: {
  href: string;
  icon: React.ReactNode;
  titre: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 bg-white rounded-xl border border-slate-100 shadow-sm p-3.5 hover:border-brand-200 hover:shadow transition focus:outline-none focus:ring-2 focus:ring-brand-300"
    >
      <span className="h-10 w-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center group-hover:bg-brand-600 group-hover:text-white transition">
        {icon}
      </span>
      <span className="flex-1 text-sm font-medium text-slate-800">{titre}</span>
      <ArrowRight
        className="h-4 w-4 text-slate-300 group-hover:text-brand-500"
        aria-hidden="true"
      />
    </Link>
  );
}
