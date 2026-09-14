import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Info, Printer } from "lucide-react";
import { formatCents } from "@/lib/money";
import { frDate } from "@/lib/format";
import { Card } from "@/components/ui";
import { getCurrentPractice } from "@/lib/dossier/practice";
import {
  getDocument,
  listCatalog,
  listSeancesFacturables,
} from "@/lib/compta/queries";
import {
  listContacts,
  listPathways,
  listPatients,
  listPatientContacts,
} from "@/lib/dossier/queries";
import { listLiens } from "@/lib/transmissions/queries";
import { contactName, patientName, ROLE_LABELS } from "@/lib/dossier/types";
import {
  BILLING_FUNDING_LABELS,
  KIND_LABELS,
  STATUS_LABELS,
  documentTitre,
  estModifiable,
} from "@/lib/compta/types";
import EnteteForm from "./EnteteForm";
import LignesEditeur from "./LignesEditeur";
import BarreActions from "./BarreActions";
import ReglementsSection from "./ReglementsSection";
import PanneauPartage from "../transmissions/PanneauPartage";

import type { Metadata } from "next";
import { dateCivile } from "@/lib/dateCivile";
/* LE TITRE EST STATIQUE, ET C'EST DÉLIBÉRÉ. Un titre qui porterait le nom du
   patient le ferait entrer dans l'historique du navigateur, parfois synchronisé
   entre appareils, parfois affiché devant quelqu'un d'autre. C'est le même
   raisonnement que celui de la page de consultation publique, et il vaut
   autant ici. Distinguer les pages entre elles suffit. */
export const metadata: Metadata = { title: "Pièce comptable · Psychomotime" };


/**
 * Une pièce comptable.
 *
 * L'écran a deux visages, et c'est le STATUT qui décide — pas un réglage :
 * un brouillon se modifie, une pièce émise se lit. Proposer un formulaire sur
 * une pièce émise reviendrait à promettre une modification que la base refuse.
 */
export default async function PiecePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const practice = await getCurrentPractice();
  if (!practice) notFound();

  const piece = await getDocument(practice, id);
  if (!piece) notFound();

  const { document: d, lignes } = piece;
  const modifiable = estModifiable(d) && practice.canWrite;
  /* Le jour proposé pour ÉMETTRE la pièce et pour recevoir un règlement, dans le
     fuseau du cabinet. En UTC, le 1er janvier à 0 h 30 à Paris, il proposait le
     31 décembre — et la série suit l'année de la date d'émission : la facture
     aurait été numérotée dans la série de l'année close. L'émission d'une pièce
     n'a pas de garde de date future (`0014`) : la corriger ne fait rien
     refuser. */
  const aujourdhui = dateCivile(new Date(), practice.timezone);

  const [
    catalogue,
    patients,
    contacts,
    parcours,
    seances,
    liens,
    entourage,
    contactsCabinet,
  ] = await Promise.all([
    modifiable ? listCatalog(practice) : Promise.resolve([]),
    modifiable
      ? listPatients(practice, { pageSize: 100 })
      : Promise.resolve({ items: [] } as { items: { id: string; first_name: string; last_name: string; preferred_name: string | null }[] }),
    modifiable ? listContacts(practice) : Promise.resolve([]),
    modifiable && d.patient_id
      ? listPathways(practice, d.patient_id)
      : Promise.resolve([]),
    modifiable && d.patient_id
      ? listSeancesFacturables(practice, d.patient_id)
      : Promise.resolve([]),
    listLiens(practice, { type: "billing_document", id }),
    /* LES CONTACTS DU PANNEAU DE PARTAGE, chargés SANS CONDITION.
     *
     * Ils ne l'étaient que si la pièce était `modifiable` — c'est-à-dire en
     * brouillon. Or le panneau de partage ne s'affiche QUE sur une pièce
     * émise : les deux conditions étaient mutuellement exclusives, et la
     * liste « Destinataire » était donc TOUJOURS VIDE en service. La garde
     * d'appartenance posée en base (`0017`) ne s'exerçait jamais, et six mois
     * plus tard un lien s'appelait « maman ».
     *
     * Ils viennent de L'ENTOURAGE DU DOSSIER, pas du cabinet entier : la
     * raison déjà écrite pour le destinataire d'une attestation vaut plus
     * encore pour un lien — adresser à la famille d'un autre patient un
     * document qui nomme celui-ci.
     *
     * Trouvé par la relecture métier du lot 7. */
    d.patient_id
      ? listPatientContacts(practice, d.patient_id)
      : Promise.resolve([]),
    listContacts(practice),
  ]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <Link
        href="/comptabilite"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Comptabilité
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">
            {documentTitre(d)}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {STATUS_LABELS[d.status]}
            {d.issued_on && ` · émise le ${frDate(d.issued_on)}`}
            {piece.patient_nom && ` · ${piece.patient_nom}`}
          </p>
        </div>
        {practice.canWrite && (
          <BarreActions
            document={d}
            nbLignes={lignes.length}
            aujourdhui={aujourdhui}
          />
        )}
      </div>

      {d.snapshot?.origine === "reprise_v1" && <BandeauReprise piece={piece} />}

      {d.rectifies_number && (
        <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 mb-5">
          <FileText className="h-5 w-5 shrink-0 text-slate-500 mt-0.5" aria-hidden="true" />
          <div className="text-sm text-slate-600">
            <p>
              {KIND_LABELS[d.kind]} rectifiant la facture{" "}
              <strong>{d.rectifies_number}</strong>
              {d.rectifies_issued_on && ` du ${frDate(d.rectifies_issued_on)}`}.
            </p>
            {d.rectification_reason && (
              <p className="text-slate-500 mt-0.5">{d.rectification_reason}</p>
            )}
          </div>
        </div>
      )}

      {piece.rectifications.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 mb-5">
          <Info className="h-5 w-5 shrink-0 text-amber-500 mt-0.5" aria-hidden="true" />
          <div className="text-sm text-amber-900">
            <p className="font-medium">Cette pièce a été rectifiée</p>
            <ul className="list-none p-0 m-0 mt-1 space-y-0.5">
              {piece.rectifications.map((r) => (
                <li key={r.id}>
                  <Link href={`/comptabilite/${r.id}`} className="underline">
                    {KIND_LABELS[r.kind]} {r.number ?? "(brouillon)"}
                  </Link>
                  {r.issued_on && ` du ${frDate(r.issued_on)}`} —{" "}
                  {formatCents(r.total_cents)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {modifiable && (
          <Card className="p-5">
            <h2 className="font-semibold text-slate-800 mb-4">
              Destinataire et rattachement
            </h2>
            <EnteteForm
              document={d}
              patients={patients.items.map((p) => ({
                id: p.id,
                nom: patientName(p),
              }))}
              contacts={contacts.map((c) => ({ id: c.id, nom: contactName(c) }))}
              parcours={parcours.map((p) => ({
                id: p.id,
                nom: `${p.label ?? "Parcours de soin"}${p.started_on ? ` — depuis le ${frDate(p.started_on)}` : ""}`,
              }))}
            />
          </Card>
        )}

        {!modifiable && <Recapitulatif piece={piece} />}

        <Card>
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">Prestations</h2>
            {!modifiable && (
              <Link
                href={`/comptabilite/${d.id}/document`}
                className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-brand-700"
              >
                <Printer className="h-4 w-4" aria-hidden="true" />
                Document imprimable
              </Link>
            )}
          </div>
          <LignesEditeur
            documentId={d.id}
            lignes={lignes}
            catalogue={catalogue}
            seances={seances}
            modifiable={modifiable}
          />
        </Card>

        {d.status !== "brouillon" && (
          <PanneauPartage
            sujetType="billing_document"
            sujetId={d.id}
            liens={liens.items}
            contacts={[
              ...entourage.map((l) => ({
                id: l.contact.id,
                nom: contactName(l.contact),
                role: ROLE_LABELS[l.role] ?? l.role,
                email: l.contact.email,
                groupe: "dossier" as const,
              })),
              /* Le cabinet ENTIER, en second groupe. En production, aucun des
               * dossiers portant une pièce émise n'a d'entourage saisi : s'en
               * tenir au dossier laisserait la liste vide et renverrait à la
               * saisie libre — le défaut qu'on corrige. */
              ...contactsCabinet
                .filter((c) => !entourage.some((l) => l.contact.id === c.id))
                .map((c) => ({
                  id: c.id,
                  nom: contactName(c),
                  email: c.email,
                  groupe: "cabinet" as const,
                })),
            ]}
            modifiable={practice.canWrite}
          />
        )}

        {d.kind !== "devis" && d.status !== "brouillon" && (
          <ReglementsSection
            documentId={d.id}
            reglements={piece.reglements}
            solde={piece.solde_cents}
            modifiable={practice.canWrite}
            aujourdhui={aujourdhui}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Ce que la pièce dit d'elle-même une fois émise.
 *
 * Les valeurs viennent de l'INSTANTANÉ quand il en porte : une pièce ancienne
 * doit se relire avec les informations de son époque, et non avec celles
 * d'aujourd'hui.
 */
function Recapitulatif({
  piece,
}: {
  piece: NonNullable<Awaited<ReturnType<typeof getDocument>>>;
}) {
  const d = piece.document;
  const s = d.snapshot;
  const payeur = s?.payeur?.nom?.trim();

  return (
    <Card className="p-5">
      <h2 className="font-semibold text-slate-800 mb-3">Récapitulatif</h2>
      <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <Ligne terme="Nature" valeur={KIND_LABELS[d.kind]} />
        {d.number && <Ligne terme="Numéro" valeur={d.number} />}
        {d.issued_on && (
          <Ligne terme="Date d'émission" valeur={frDate(d.issued_on)} />
        )}
        {d.due_on && <Ligne terme="Échéance" valeur={frDate(d.due_on)} />}
        {d.valid_until && (
          <Ligne terme="Valable jusqu'au" valeur={frDate(d.valid_until)} />
        )}
        {(d.period_start || d.period_end) && (
          <Ligne
            terme="Période de rattachement"
            valeur={[
              d.period_start && `du ${frDate(d.period_start)}`,
              d.period_end && `au ${frDate(d.period_end)}`,
            ]
              .filter(Boolean)
              .join(" ")}
          />
        )}
        <Ligne
          terme="Adressée à"
          valeur={payeur || piece.patient_nom || "Non précisé"}
        />
        {d.funding_scheme && (
          <Ligne
            terme="Financement"
            valeur={BILLING_FUNDING_LABELS[d.funding_scheme]}
          />
        )}
        <Ligne terme="Total" valeur={formatCents(d.total_cents)} />
      </dl>

      {d.note && (
        <p className="text-sm text-slate-600 whitespace-pre-wrap mt-3 pt-3 border-t border-slate-100">
          {d.note}
        </p>
      )}
      {d.internal_note && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Note interne — jamais imprimée
          </p>
          <p className="text-sm text-slate-600 whitespace-pre-wrap mt-0.5">
            {d.internal_note}
          </p>
        </div>
      )}
    </Card>
  );
}

function BandeauReprise({
  piece,
}: {
  piece: NonNullable<Awaited<ReturnType<typeof getDocument>>>;
}) {
  const e = piece.document.snapshot?.estimations_v1;
  const retro = e?.retrocession_centimes ?? 0;
  const urssaf = e?.urssaf_centimes ?? 0;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 mb-5">
      <Info className="h-5 w-5 shrink-0 text-slate-500 mt-0.5" aria-hidden="true" />
      <div className="text-sm text-slate-600">
        <p className="font-medium text-slate-700">
          Pièce reprise de la version précédente
        </p>
        <p>
          Elle a été établie avant la refonte. Son numéro, sa date et son montant
          sont conservés à l&apos;identique.
        </p>
        {(retro > 0 || urssaf > 0) && (
          <p className="text-xs text-slate-500 mt-1">
            Estimations d&apos;alors, conservées à titre d&apos;information —
            elles ne figurent sur aucun document et ne sont dues par personne :
            rétrocession {formatCents(retro)}, URSSAF {formatCents(urssaf)}.
          </p>
        )}
        {piece.document.patient_id === null && piece.patient_nom && (
          <p className="text-xs text-slate-500 mt-1">
            Le dossier patient n&apos;est pas rattaché : la facture d&apos;origine
            désignait un dossier d&apos;un autre cabinet. Le nom qu&apos;elle
            portait est conservé.
          </p>
        )}
      </div>
    </div>
  );
}

function Ligne({ terme, valeur }: { terme: string; valeur: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{terme}</dt>
      <dd className="text-slate-700">{valeur}</dd>
    </div>
  );
}
