import Link from "next/link";
import { ArrowLeft, FlaskConical, ShieldAlert } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/ui";
import { getCurrentPractice } from "@/lib/dossier/practice";
import {
  listBandSets,
  listInstruments,
  listScales,
  listVocabularies,
} from "@/lib/dossier/queries";
import type { BandSetRow, InstrumentScale } from "@/lib/dossier/types";
import RegistreClient from "./RegistreClient";

import type { Metadata } from "next";
/* LE TITRE EST STATIQUE, ET C'EST DÉLIBÉRÉ. Un titre qui porterait le nom du
   patient le ferait entrer dans l'historique du navigateur, parfois synchronisé
   entre appareils, parfois affiché devant quelqu'un d'autre. C'est le même
   raisonnement que celui de la page de consultation publique, et il vaut
   autant ici. Distinguer les pages entre elles suffit. */
export const metadata: Metadata = { title: "Instruments · Psychomotime" };


/**
 * Registre des instruments.
 *
 * CE QUE CETTE PAGE PERMET, et ce qu'elle refuse.
 *
 * Elle enregistre des DÉSIGNATIONS et des propriétés déclarées : le nom d'un
 * instrument, son éditeur, sa plage d'âge annoncée, la population de référence.
 * Elle n'accueille ni items, ni consignes, ni feuilles de cotation, ni tables
 * d'étalonnage — le schéma lui-même n'a pas de place pour les recevoir.
 *
 * Le produit ne livre AUCUN instrument, AUCUNE échelle et AUCUN découpage
 * pré-rempli. Livrer un découpage repris d'un manuel serait reproduire du
 * contenu éditeur ; en livrer un inventé serait pire.
 */
export default async function RegistrePage() {
  const practice = await getCurrentPractice();

  if (!practice) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
        <PageHeader title="Instruments" />
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 text-sm text-slate-600">
          Aucun cabinet n&apos;est rattaché à votre compte.
        </div>
      </div>
    );
  }

  const [instruments, vocabulaires] = await Promise.all([
    listInstruments(practice),
    listVocabularies(practice),
  ]);

  // Échelles et découpages de chaque instrument. Le registre reste petit par
  // nature — une dizaine d'instruments au plus — donc tout se charge d'un coup.
  const echellesParInstrument: Record<string, InstrumentScale[]> = {};
  const decoupagesParEchelle: Record<string, BandSetRow[]> = {};

  for (const instrument of instruments) {
    const echelles = await listScales(practice, instrument.id);
    echellesParInstrument[instrument.id] = echelles;
    for (const echelle of echelles) {
      decoupagesParEchelle[echelle.id] = await listBandSets(practice, echelle.id);
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <Link
        href="/parametres"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Paramètres
      </Link>

      <PageHeader
        title="Instruments"
        subtitle="Les outils que vous employez, vos échelles et vos découpages."
      />

      <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 mb-6">
        <ShieldAlert
          className="h-5 w-5 shrink-0 text-slate-500 mt-0.5"
          aria-hidden="true"
        />
        <div className="text-sm text-slate-600">
          <p className="font-medium text-slate-700">
            Ce registre note ce que vous employez, il ne contient aucun matériel
            de test.
          </p>
          <p className="mt-1">
            Ni items, ni consignes, ni grilles de cotation, ni tables
            d&apos;étalonnage : ces contenus appartiennent à leurs éditeurs.
            Rien n&apos;est livré pré-rempli — les bornes, les mots et les
            couleurs sont les vôtres, et le compte rendu citera la source que
            vous aurez indiquée.
          </p>
        </div>
      </div>

      {instruments.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
          <EmptyState
            icon={<FlaskConical className="h-6 w-6" />}
            title="Aucun instrument enregistré"
            description="Ajoutez les outils que vous employez. Un instrument commence toujours en « référence seule » : il est nommé, et vous écrivez vos résultats en texte libre. Vous décidez ensuite s'il vous sert de cahier de scores."
            action={
              practice.canWrite ? (
                <RegistreClient
                  instruments={[]}
                  echelles={{}}
                  decoupages={{}}
                  vocabulaires={vocabulaires}
                  canWrite={practice.canWrite}
                  seulementBoutonAjout
                />
              ) : undefined
            }
          />
        </div>
      ) : (
        <RegistreClient
          instruments={instruments}
          echelles={echellesParInstrument}
          decoupages={decoupagesParEchelle}
          vocabulaires={vocabulaires}
          canWrite={practice.canWrite}
        />
      )}
    </div>
  );
}
