import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, Archive } from "lucide-react";
import { frDate } from "@/lib/format";
import { formatAgeAt } from "@/lib/age";
import { getCurrentPractice } from "@/lib/dossier/practice";
import {
  countPatientSessions,
  findPossibleDuplicates,
  getPatient,
  listConsents,
  listContacts,
  listNotes,
  listObjectives,
  listPathways,
  listPatientAppointments,
  listPatientContacts,
} from "@/lib/dossier/queries";
import { patientName } from "@/lib/dossier/types";
import PatientFormDialog from "../PatientFormDialog";
import ArchiveControls from "./ArchiveControls";
import EntourageSection from "./EntourageSection";
import ParcoursSection from "./ParcoursSection";
import NotesSection from "./NotesSection";
import ConsentementsSection from "./ConsentementsSection";
import SeancesSection from "./SeancesSection";

export default async function FichePatientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const practice = await getCurrentPractice();
  if (!practice) notFound();

  const patient = await getPatient(practice, id);
  if (!patient) notFound();

  // Toutes les lectures du dossier en parallèle : elles ne dépendent pas
  // les unes des autres, et les enchaîner n'apporterait qu'un écran plus lent.
  const maintenant = new Date();
  const [
    entourage,
    parcours,
    notes,
    consentements,
    contacts,
    doublons,
    rendezVous,
    comptes,
  ] = await Promise.all([
    listPatientContacts(practice, patient.id),
    listPathways(practice, patient.id),
    listNotes(practice, patient.id),
    listConsents(practice, patient.id),
    listContacts(practice),
    findPossibleDuplicates(practice, patient),
    listPatientAppointments(practice, patient.id),
    countPatientSessions(practice, patient.id, maintenant),
  ]);

  const objectifs = await listObjectives(
    practice,
    parcours.map((p) => p.id),
  );

  const age = formatAgeAt(patient.birth_date, maintenant);
  const archive = patient.status === "archive";

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <Link
        href="/patients"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Tous les dossiers
      </Link>

      {/* ------------------------------------------------------------ en-tête */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">
            {patientName(patient)}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {patient.birth_date ? (
              <>
                Né(e) le {frDate(patient.birth_date)}
                {age && <> · {age} aujourd&apos;hui</>}
              </>
            ) : (
              "Date de naissance non renseignée"
            )}
          </p>
          {patient.birth_name && (
            <p className="text-xs text-slate-400 mt-0.5">
              Nom de naissance : {patient.birth_name}
            </p>
          )}
        </div>
        {practice.canWrite && (
          <div className="flex items-center gap-2">
            <PatientFormDialog patient={patient} />
            <ArchiveControls
              patientId={patient.id}
              archived={archive}
              reason={patient.archive_reason}
            />
          </div>
        )}
      </div>

      {archive && (
        <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 mb-6">
          <Archive
            className="h-5 w-5 shrink-0 text-slate-400 mt-0.5"
            aria-hidden="true"
          />
          <div className="text-sm text-slate-600">
            <p className="font-medium text-slate-700">Dossier archivé</p>
            <p>
              {patient.archived_at && `Archivé le ${frDate(patient.archived_at.slice(0, 10))}. `}
              {patient.archive_reason ?? "Aucun motif renseigné."}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Rien n&apos;a été effacé : le dossier reste consultable, et ses
              pièces comptables avec lui.
            </p>
          </div>
        </div>
      )}

      {doublons.length > 0 && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 mb-6"
        >
          <AlertTriangle
            className="h-5 w-5 shrink-0 text-amber-500 mt-0.5"
            aria-hidden="true"
          />
          <div className="text-sm text-amber-900">
            <p className="font-medium">Doublon possible</p>
            <p>
              {doublons.length === 1 ? "Un autre dossier porte" : `${doublons.length} autres dossiers portent`}{" "}
              le même nom et la même date de naissance :{" "}
              {doublons.map((d, i) => (
                <span key={d.id}>
                  {i > 0 && ", "}
                  <Link href={`/patients/${d.id}`} className="underline font-medium">
                    {patientName(d)}
                  </Link>
                </span>
              ))}
              .
            </p>
            <p className="text-xs text-amber-800 mt-1">
              Deux homonymes nés le même jour existent : c&apos;est un signalement,
              pas un blocage. Rien n&apos;est fusionné automatiquement.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* ------------------------------------------------------- coordonnées */}
        {(patient.email ||
          patient.phone ||
          patient.address_line1 ||
          patient.administrative_notes) && (
          <section
            aria-labelledby="titre-coordonnees"
            className="bg-white rounded-xl border border-slate-100 shadow-sm p-5"
          >
            <h2
              id="titre-coordonnees"
              className="font-semibold text-slate-800 mb-3"
            >
              Coordonnées et organisation
            </h2>
            <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {patient.email && <Ligne terme="E-mail" valeur={patient.email} />}
              {patient.phone && <Ligne terme="Téléphone" valeur={patient.phone} />}
              {patient.address_line1 && (
                <Ligne
                  terme="Adresse"
                  valeur={[
                    patient.address_line1,
                    patient.address_line2,
                    [patient.postal_code, patient.city].filter(Boolean).join(" "),
                  ]
                    .filter(Boolean)
                    .join(", ")}
                />
              )}
            </dl>
            {patient.administrative_notes && (
              <p className="text-sm text-slate-600 whitespace-pre-wrap mt-3 pt-3 border-t border-slate-100">
                {patient.administrative_notes}
              </p>
            )}
          </section>
        )}

        <EntourageSection
          patientId={patient.id}
          liens={entourage}
          contacts={contacts}
          canWrite={practice.canWrite}
        />

        <SeancesSection appointments={rendezVous} counts={comptes} />

        <ParcoursSection
          patientId={patient.id}
          parcours={parcours}
          objectifs={objectifs}
          contacts={contacts}
          canWrite={practice.canWrite}
          canReadClinical={practice.canReadClinical}
        />

        {practice.canReadClinical ? (
          <NotesSection
            patientId={patient.id}
            notes={notes}
            parcours={parcours}
            canWrite={practice.canWrite}
          />
        ) : (
          <section className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <h2 className="font-semibold text-slate-800">Notes cliniques</h2>
            <p className="text-sm text-slate-500 mt-1">
              Votre rôle dans ce cabinet ne donne pas accès aux notes cliniques
              ni aux objectifs thérapeutiques. Ce n&apos;est pas un défaut
              d&apos;affichage : la base elle-même les refuse.
            </p>
          </section>
        )}

        <ConsentementsSection
          patientId={patient.id}
          consentements={consentements}
          contacts={contacts}
          canWrite={practice.canWrite}
        />
      </div>
    </div>
  );
}

function Ligne({ terme, valeur }: { terme: string; valeur: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{terme}</dt>
      <dd className="text-slate-700">{valeur}</dd>
    </div>
  );
}
