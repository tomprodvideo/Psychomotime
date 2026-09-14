import Link from "next/link";
import { Archive, ChevronRight, Users } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/ui";
import { frDate } from "@/lib/format";
import { formatAgeAt } from "@/lib/age";
import { dateCivile } from "@/lib/dateCivile";
import { getCurrentPractice } from "@/lib/dossier/practice";
import { listPatients } from "@/lib/dossier/queries";
import { patientName } from "@/lib/dossier/types";
import PatientFormDialog from "./PatientFormDialog";
import PatientsToolbar from "./PatientsToolbar";
import CreatePracticeCard from "./CreatePracticeCard";

import type { Metadata } from "next";
/* LE TITRE EST STATIQUE, ET C'EST DÉLIBÉRÉ. Un titre qui porterait le nom du
   patient le ferait entrer dans l'historique du navigateur, parfois synchronisé
   entre appareils, parfois affiché devant quelqu'un d'autre. C'est le même
   raisonnement que celui de la page de consultation publique, et il vaut
   autant ici. Distinguer les pages entre elles suffit. */
export const metadata: Metadata = { title: "Dossiers · Psychomotime" };


export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const practice = await getCurrentPractice();

  // Un compte sans cabinet n'est pas une erreur : c'est un compte tout juste
  // créé. On le conduit là où il doit aller plutôt que d'afficher une liste
  // vide sans explication.
  if (!practice) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
        <PageHeader title="Bienvenue" subtitle="Une dernière étape avant de commencer." />
        <CreatePracticeCard />
      </div>
    );
  }

  const lire = (k: string) => {
    const v = params[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const search = lire("q") ?? "";
  const statut = (lire("statut") as "actif" | "archive" | "tous") ?? "actif";
  const page = Math.max(1, Number.parseInt(lire("page") ?? "1", 10) || 1);

  const resultats = await listPatients(practice, {
    search,
    status: ["actif", "archive", "tous"].includes(statut) ? statut : "actif",
    page,
  });

  // L'âge se lit toujours à une date explicite. Ici, c'est aujourd'hui, et
  // c'est légitime : on affiche l'âge courant d'un dossier, pas l'âge à une
  // passation. Sur un document, ce sera la date de passation.
  /* Le JOUR CIVIL du cabinet, et non un instant : un instant était lu dans le
     fuseau du serveur, et un enfant dont c'est l'anniversaire à 00 h 30 à Paris
     s'affichait avec l'âge de la veille. */
  const aujourdhui = dateCivile(new Date(), practice?.timezone);

  const aucunResultat = resultats.items.length === 0;
  const rechercheEnCours = search.trim().length > 0 || statut !== "actif";

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <PageHeader
        title="Patients"
        subtitle={
          resultats.total === 0
            ? practice.practiceName
            : `${resultats.total} dossier${resultats.total > 1 ? "s" : ""}${
                statut === "actif" ? " actif" + (resultats.total > 1 ? "s" : "") : ""
              } · ${practice.practiceName}`
        }
      >
        {practice.canWrite && <PatientFormDialog />}
      </PageHeader>

      <PatientsToolbar search={search} statut={statut} />

      {aucunResultat ? (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
          {rechercheEnCours ? (
            <EmptyState
              icon={<Users className="h-6 w-6" />}
              title="Aucun dossier ne correspond"
              description={
                statut === "archive"
                  ? "Aucun dossier archivé ne correspond à cette recherche."
                  : "Essayez un autre terme, ou élargissez la recherche aux dossiers archivés."
              }
              action={
                <Link
                  href="/patients?statut=tous"
                  className="text-sm font-medium text-brand-700 hover:underline"
                >
                  Chercher dans tous les dossiers
                </Link>
              }
            />
          ) : (
            <EmptyState
              icon={<Users className="h-6 w-6" />}
              title="Aucun dossier pour l'instant"
              description="Créez un premier dossier : vous pourrez y rattacher l'entourage, un parcours de soin, des bilans et des factures."
              action={practice.canWrite ? <PatientFormDialog /> : undefined}
            />
          )}
        </div>
      ) : (
        <>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 list-none p-0 m-0">
            {resultats.items.map((p) => {
              const age = formatAgeAt(p.birth_date, aujourdhui);
              return (
                <li key={p.id}>
                  <Link
                    href={`/patients/${p.id}`}
                    className="group block h-full bg-white rounded-xl border border-slate-100 shadow-sm p-4 hover:border-brand-200 hover:shadow focus:outline-none focus:ring-2 focus:ring-brand-300 transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          aria-hidden="true"
                          className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center font-semibold uppercase ${
                            p.status === "archive"
                              ? "bg-slate-100 text-encre-faible"
                              : "bg-brand-100 text-brand-700"
                          }`}
                        >
                          {(p.first_name?.[0] ?? "") + (p.last_name?.[0] ?? "")}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800 truncate">
                            {patientName(p)}
                          </p>
                          <p className="text-xs text-slate-500">
                            {p.birth_date
                              ? `${frDate(p.birth_date)}${age ? ` · ${age}` : ""}`
                              : "Date de naissance non renseignée"}
                          </p>
                        </div>
                      </div>
                      <ChevronRight
                        aria-hidden="true"
                        className="h-5 w-5 shrink-0 text-slate-300 group-hover:text-brand-400"
                      />
                    </div>
                    {p.status === "archive" && (
                      <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">
                        <Archive className="h-3 w-3" aria-hidden="true" />
                        Archivé{p.archived_at ? ` le ${frDate(p.archived_at.slice(0, 10))}` : ""}
                      </p>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>

          {resultats.pageCount > 1 && (
            <nav
              aria-label="Pagination des dossiers"
              className="flex items-center justify-center gap-2 mt-6 text-sm"
            >
              <PageLink
                page={page - 1}
                search={search}
                statut={statut}
                disabled={page <= 1}
              >
                Précédent
              </PageLink>
              <span className="text-slate-500" aria-current="page">
                Page {page} sur {resultats.pageCount}
              </span>
              <PageLink
                page={page + 1}
                search={search}
                statut={statut}
                disabled={page >= resultats.pageCount}
              >
                Suivant
              </PageLink>
            </nav>
          )}
        </>
      )}
    </div>
  );
}

function PageLink({
  page,
  search,
  statut,
  disabled,
  children,
}: {
  page: number;
  search: string;
  statut: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="px-3 py-1.5 rounded-lg text-slate-300 cursor-default">
        {children}
      </span>
    );
  }
  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (statut !== "actif") params.set("statut", statut);
  params.set("page", String(page));
  return (
    <Link
      href={`/patients?${params.toString()}`}
      className="px-3 py-1.5 rounded-lg text-brand-700 hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-300"
    >
      {children}
    </Link>
  );
}
