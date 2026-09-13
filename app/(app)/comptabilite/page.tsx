import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, BookOpen, Download, Link2, Receipt, ShieldCheck, TrendingDown, Wallet } from "lucide-react";
import { formatCents } from "@/lib/money";
import { frDate } from "@/lib/format";
import { Card, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { getCurrentPractice } from "@/lib/dossier/practice";
import { listCharges, listDocuments } from "@/lib/compta/queries";

import {
  KIND_SHORT,
  STATUS_LABELS,
  documentTitre,
  resumeCharges,
} from "@/lib/compta/types";
import type { DocumentListItem } from "@/lib/compta/queries";
import { resoudrePeriode, versParams } from "./periode";
import SelecteurPeriode from "./SelecteurPeriode";
import NouvellePiece from "./NouvellePiece";

import type { Metadata } from "next";
/* LE TITRE EST STATIQUE, ET C'EST DÉLIBÉRÉ. Un titre qui porterait le nom du
   patient le ferait entrer dans l'historique du navigateur, parfois synchronisé
   entre appareils, parfois affiché devant quelqu'un d'autre. C'est le même
   raisonnement que celui de la page de consultation publique, et il vaut
   autant ici. Distinguer les pages entre elles suffit. */
export const metadata: Metadata = { title: "Comptabilité · Psychomotime" };


/**
 * Comptabilité — la période d'abord.
 *
 * POURQUOI LES TOTAUX PORTENT SUR TOUTE LA PÉRIODE, et non sur la page
 * affichée : « 12 450 € encaissés » ne peut pas vouloir dire « sur les
 * vingt-cinq lignes visibles ». Si le plafond de sécurité est atteint, l'écran
 * le dit — un total partiel présenté comme complet est pire qu'un total absent.
 */
export default async function ComptabilitePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const practice = await getCurrentPractice();
  if (!practice) notFound();

  const aujourdhui = new Date();
  const periode = resoudrePeriode(params, aujourdhui);

  const [pieces, charges] = await Promise.all([
    listDocuments(practice, {
      du: periode.du,
      au: periode.au,
      brouillons: true,
    }),
    listCharges(practice, { du: periode.du, au: periode.au }),
  ]);

  const totaux = pieces.totaux;
  const chargesResume = resumeCharges(charges.items);
  const net = totaux.encaisse_cents - chargesResume.total_cents;

  const anneeCourante = aujourdhui.getFullYear();
  const annees = Array.from({ length: 6 }, (_, i) => anneeCourante - i);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <PageHeader title="Comptabilité" subtitle={periode.libelle}>
        {practice.canWrite && <NouvellePiece />}
      </PageHeader>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <SelecteurPeriode
          mode={periode.mode}
          annee={periode.du ? Number(periode.du.slice(0, 4)) : anneeCourante}
          mois={periode.du ? Number(periode.du.slice(5, 7)) : aujourdhui.getMonth() + 1}
          du={periode.du}
          au={periode.au}
          anneesDisponibles={annees}
        />
        <div className="flex items-center gap-3 text-sm">
          <Link
            href="/comptabilite/reglements"
            className="inline-flex items-center gap-1.5 text-slate-600 hover:text-brand-700"
          >
            <Wallet className="h-4 w-4" aria-hidden="true" />
            Règlements
          </Link>
          <Link
            href="/comptabilite/attestations"
            className="inline-flex items-center gap-1.5 text-slate-600 hover:text-brand-700"
          >
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Attestations
          </Link>
          <Link
            href="/comptabilite/charges"
            className="inline-flex items-center gap-1.5 text-slate-600 hover:text-brand-700"
          >
            <TrendingDown className="h-4 w-4" aria-hidden="true" />
            Charges
          </Link>
          <Link
            href="/comptabilite/transmissions"
            className="inline-flex items-center gap-1.5 text-slate-600 hover:text-brand-700"
          >
            <Link2 className="h-4 w-4" aria-hidden="true" />
            Documents transmis
          </Link>
          <Link
            href="/comptabilite/catalogue"
            className="inline-flex items-center gap-1.5 text-slate-600 hover:text-brand-700"
          >
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            Catalogue
          </Link>
          <a
            href={`/comptabilite/export?${versParams(periode, aujourdhui).toString()}`}
            className="inline-flex items-center gap-1.5 text-slate-600 hover:text-brand-700"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Exporter
          </a>
        </div>
      </div>

      {(pieces.erreur || charges.erreur) && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 mb-5"
        >
          <AlertTriangle
            className="h-5 w-5 shrink-0 text-rose-500 mt-0.5"
            aria-hidden="true"
          />
          <p className="text-sm text-rose-900">
            {pieces.erreur ?? charges.erreur}{" "}
            <strong>
              Ne recopiez aucun des montants ci-dessous : ils ne sont pas ceux de
              votre comptabilité.
            </strong>{" "}
            Rechargez la page ; si le problème persiste, reconnectez-vous.
          </p>
        </div>
      )}

      {pieces.tronque && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 mb-5"
        >
          <AlertTriangle
            className="h-5 w-5 shrink-0 text-amber-500 mt-0.5"
            aria-hidden="true"
          />
          <p className="text-sm text-amber-900">
            Cette période contient plus de pièces que l&apos;écran n&apos;en
            charge. <strong>Les totaux ci-dessous sont donc incomplets.</strong>{" "}
            Choisissez une période plus courte pour obtenir des montants exacts.
          </p>
        </div>
      )}

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5 mb-6">
        <StatCard
          label="Facturé"
          value={formatCents(totaux.emis_cents)}
          accent="brand"
          hint={`${totaux.pieces - totaux.brouillons} pièce(s) émise(s)`}
        />
        <StatCard
          label="Encaissé"
          value={formatCents(totaux.encaisse_cents)}
          accent="emerald"
        />
        <StatCard
          label="Reste dû"
          value={formatCents(totaux.reste_du_cents)}
          accent={totaux.reste_du_cents > 0 ? "amber" : "slate"}
        />
        <StatCard
          label="Charges"
          value={formatCents(chargesResume.total_cents)}
          accent="rose"
          hint={chargesResume.detail}
        />
        <StatCard
          label="Net encaissé"
          value={formatCents(net)}
          accent={net >= 0 ? "slate" : "rose"}
          hint="Encaissé moins charges"
        />
      </div>

      {totaux.avoirs_cents > 0 && (
        <p className="text-xs text-slate-500 mb-4">
          {formatCents(totaux.avoirs_cents)} d&apos;avoirs sur la période :
          déduits du facturé, ils ne sont pas comptés comme un encaissement.
        </p>
      )}

      <Card>
        {pieces.items.length === 0 ? (
          <EmptyState
            icon={<Receipt className="h-6 w-6" />}
            title="Aucune pièce sur cette période"
            description="Les factures, devis et avoirs que vous établirez apparaîtront ici, avec leur solde."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">
                Pièces comptables de la période {periode.libelle}
              </caption>
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                  <th scope="col" className="px-4 py-2.5 font-medium">Pièce</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Date</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Patient</th>
                  <th scope="col" className="px-4 py-2.5 font-medium text-right">Montant</th>
                  <th scope="col" className="px-4 py-2.5 font-medium text-right">Reste dû</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">État</th>
                </tr>
              </thead>
              <tbody>
                {pieces.items.map((d) => (
                  <LignePiece key={d.id} d={d} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function LignePiece({ d }: { d: DocumentListItem }) {
  const brouillon = d.status === "brouillon";
  const annulee = d.status === "annule_par_avoir" || d.status === "remplace";

  return (
    <tr className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
      <td className="px-4 py-2.5">
        <Link
          href={`/comptabilite/${d.id}`}
          className="font-medium text-slate-700 hover:text-brand-700"
        >
          {d.number ?? documentTitre(d)}
        </Link>
        <span className="block text-xs text-slate-500">
          {KIND_SHORT[d.kind]}
          {d.repris_de_v1 && " · repris de la version précédente"}
        </span>
      </td>
      <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">
        {d.issued_on ? frDate(d.issued_on) : "—"}
      </td>
      <td className="px-4 py-2.5 text-slate-600">
        {d.patient_id ? (
          <Link
            href={`/patients/${d.patient_id}`}
            className="hover:text-brand-700"
          >
            {d.patient_nom}
          </Link>
        ) : d.patient_nom ? (
          <span title="Le dossier lié n'existe plus ; le nom porté par la pièce est conservé.">
            {d.patient_nom}{" "}
            <span className="text-xs text-slate-500">(dossier non lié)</span>
          </span>
        ) : (
          <span className="text-slate-500">—</span>
        )}
      </td>
      <td
        className={`px-4 py-2.5 text-right tabular-nums ${
          annulee ? "text-slate-500 line-through" : "text-slate-700"
        }`}
      >
        {d.kind === "avoir" && "− "}
        {formatCents(d.total_cents)}
      </td>
      <td className="px-4 py-2.5 text-right tabular-nums">
        {brouillon || d.kind === "devis" || d.kind === "avoir" || annulee ? (
          <span className="text-slate-300">—</span>
        ) : d.solde_cents > 0 ? (
          <span className="text-amber-600 font-medium">
            {formatCents(d.solde_cents)}
          </span>
        ) : d.solde_cents < 0 ? (
          // Un solde négatif est un TROP-PERÇU. L'afficher « Soldée » le
          // rendait invisible ici, alors que la pièce, elle, l'annonce.
          <span className="text-rose-600" title="Encaissé au-delà du montant dû">
            + {formatCents(-d.solde_cents)}
          </span>
        ) : (
          <span className="text-emerald-600">Soldée</span>
        )}
      </td>
      <td className="px-4 py-2.5">
        <EtatPastille statut={d.status} />
      </td>
    </tr>
  );
}

function EtatPastille({ statut }: { statut: DocumentListItem["status"] }) {
  const couleurs: Record<string, string> = {
    brouillon: "bg-slate-100 text-slate-600",
    emis: "bg-brand-50 text-brand-700",
    accepte: "bg-emerald-50 text-emerald-700",
    refuse: "bg-slate-100 text-encre-faible",
    expire: "bg-slate-100 text-encre-faible",
    remplace: "bg-amber-50 text-amber-700",
    annule_par_avoir: "bg-amber-50 text-amber-700",
  };
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${couleurs[statut]}`}
    >
      {STATUS_LABELS[statut]}
    </span>
  );
}
