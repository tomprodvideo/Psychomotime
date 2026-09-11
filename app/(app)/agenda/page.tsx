import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { getCurrentPractice } from "@/lib/dossier/practice";
import { listAppointments, listAppointmentsToQualify, listPatients } from "@/lib/dossier/queries";
import AgendaVue from "./AgendaVue";

/**
 * Agenda du cabinet.
 *
 * PRÉSENTÉ EN LISTE, PAS EN GRILLE, et c'est un choix. Une grille horaire sert
 * à repérer un trou dans une journée dense ; un cabinet libéral en compte
 * rarement plus d'une dizaine, et ce qui coûte du temps n'est pas de les
 * trouver, c'est de CONSTATER ce qui s'est passé pour chacun. La liste met donc
 * l'issue au premier plan, et les rendez-vous passés non qualifiés tout en haut.
 *
 * La période affichée vient de l'URL : un lien vers une semaine précise est
 * partageable, et le retour arrière fonctionne.
 */
export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const practice = await getCurrentPractice();

  if (!practice) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
        <PageHeader title="Agenda" />
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 text-sm text-slate-600">
          Aucun cabinet n&apos;est rattaché à votre compte.{" "}
          <Link href="/patients" className="text-brand-700 underline">
            Créez-le d&apos;abord
          </Link>
          .
        </div>
      </div>
    );
  }

  const lire = (k: string) => {
    const v = params[k];
    return Array.isArray(v) ? v[0] : v;
  };

  // L'ancre de la période est explicite. À défaut, aujourd'hui — mais la
  // décision est prise ici, une fois, et non dispersée dans l'affichage.
  const ancreBrute = lire("jour");
  const ancre =
    ancreBrute && /^\d{4}-\d{2}-\d{2}$/.test(ancreBrute)
      ? new Date(`${ancreBrute}T12:00:00`)
      : new Date();
  const vue = lire("vue") === "semaine" ? "semaine" : "jour";

  const debut = new Date(ancre);
  debut.setHours(0, 0, 0, 0);
  if (vue === "semaine") {
    // Semaine commençant le lundi.
    const jour = (debut.getDay() + 6) % 7;
    debut.setDate(debut.getDate() - jour);
  }
  const fin = new Date(debut);
  fin.setDate(fin.getDate() + (vue === "semaine" ? 7 : 1));

  const maintenant = new Date();

  const [rendezVous, aQualifier, patients] = await Promise.all([
    listAppointments(practice, debut, fin),
    listAppointmentsToQualify(practice, maintenant),
    listPatients(practice, { status: "actif", pageSize: 100 }),
  ]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <PageHeader
        title="Agenda"
        subtitle={practice.practiceName}
      >
        {!practice.canWrite && (
          <span className="text-xs text-slate-500">Lecture seule</span>
        )}
      </PageHeader>

      <AgendaVue
        vue={vue}
        debut={debut.toISOString()}
        fin={fin.toISOString()}
        maintenant={maintenant.toISOString()}
        rendezVous={rendezVous}
        aQualifier={aQualifier}
        patients={patients.items}
        canWrite={practice.canWrite}
      />

      {rendezVous.length === 0 && aQualifier.length === 0 && (
        <p className="flex items-center gap-2 justify-center text-sm text-slate-400 mt-8">
          <CalendarDays className="h-4 w-4" aria-hidden="true" />
          Rien de prévu sur cette période.
        </p>
      )}
    </div>
  );
}
