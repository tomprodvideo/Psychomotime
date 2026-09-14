import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { getCurrentPractice } from "@/lib/dossier/practice";
import {
  listAppointments,
  listAppointmentsToQualify,
  countAppointmentsToQualify,
  listPatients,
  seancesAvecNote,
} from "@/lib/dossier/queries";
import AgendaVue from "./AgendaVue";
import { ajouterJours, dateCivile, debutDuJour, lundiDe } from "@/lib/dateCivile";

import type { Metadata } from "next";
/* LE TITRE EST STATIQUE, ET C'EST DÉLIBÉRÉ. Un titre qui porterait le nom du
   patient le ferait entrer dans l'historique du navigateur, parfois synchronisé
   entre appareils, parfois affiché devant quelqu'un d'autre. C'est le même
   raisonnement que celui de la page de consultation publique, et il vaut
   autant ici. Distinguer les pages entre elles suffit. */
export const metadata: Metadata = { title: "Agenda · Psychomotime" };


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

  /* LE JOUR AFFICHÉ EST UN JOUR CIVIL DU CABINET, jamais « minuit du serveur ».
   * L'ancre était posée par `setHours(0, 0, 0, 0)` dans le fuseau du serveur,
   * puis relue en UTC par le navigateur : sur un serveur réglé sur Paris,
   * « jour suivant » ramenait au même jour et « précédent » reculait de deux ;
   * sur un serveur UTC, la journée affichée courait de 2 h à 2 h du matin, et
   * un rendez-vous à minuit et demi tombait la veille. */
  const fuseau = practice.timezone;
  const jourBrut = lire("jour");
  const jour =
    jourBrut && /^\d{4}-\d{2}-\d{2}$/.test(jourBrut) ? jourBrut : dateCivile(new Date(), fuseau);
  const vue = lire("vue") === "semaine" ? "semaine" : "jour";

  // Semaine commençant le lundi.
  const debutJour = vue === "semaine" ? lundiDe(jour) : jour;
  const finJour = ajouterJours(debutJour, vue === "semaine" ? 7 : 1);
  const debut = debutDuJour(debutJour, fuseau);
  const fin = debutDuJour(finJour, fuseau);

  const maintenant = new Date();

  const [rendezVous, aQualifier, totalAQualifier, patients] = await Promise.all([
    listAppointments(practice, debut, fin),
    listAppointmentsToQualify(practice, maintenant),
    countAppointmentsToQualify(practice, maintenant),
    listPatients(practice, { status: "actif", pageSize: 100 }),
  ]);

  /* Les séances qui portent déjà une note. Chargée APRÈS, parce qu'elle dépend
   * des identifiants qu'on vient d'obtenir — et en une seule requête, qui ne
   * rapporte que des identifiants : le corps d'une note clinique n'a rien à
   * faire dans la charge d'une page d'agenda. */
  const notees = await seancesAvecNote(practice, [
    ...rendezVous.map((r) => r.id),
    ...aQualifier.map((r) => r.id),
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
        debutJour={debutJour}
        finJour={finJour}
        fuseau={fuseau}
        maintenant={maintenant.toISOString()}
        rendezVous={rendezVous}
        aQualifier={aQualifier}
        totalAQualifier={totalAQualifier}
        seancesNotees={[...notees]}
        patients={patients.items}
        canWrite={practice.canWrite}
      />

      {rendezVous.length === 0 && aQualifier.length === 0 && (
        <p className="flex items-center gap-2 justify-center text-sm text-slate-500 mt-8">
          <CalendarDays className="h-4 w-4" aria-hidden="true" />
          Rien de prévu sur cette période.
        </p>
      )}
    </div>
  );
}
