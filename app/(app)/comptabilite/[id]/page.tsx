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
import { listContacts, listPathways, listPatients } from "@/lib/dossier/queries";
import { contactName, patientName } from "@/lib/dossier/types";
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
  const aujourdhui = new Date().toISOString().slice(0, 10);

  const [catalogue, patients, contacts, parcours, seances] = await Promise.all([
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
          <FileText className="h-5 w-5 shrink-0 text-slate-400 mt-0.5" aria-hidden="true" />
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
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
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
      <Info className="h-5 w-5 shrink-0 text-slate-400 mt-0.5" aria-hidden="true" />
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
      <dt className="text-xs text-slate-400">{terme}</dt>
      <dd className="text-slate-700">{valeur}</dd>
    </div>
  );
}
