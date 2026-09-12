import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Link2 } from "lucide-react";
import { frDate } from "@/lib/format";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { getCurrentPractice } from "@/lib/dossier/practice";
import { listLiensDuCabinet } from "@/lib/transmissions/queries";
import { ETAT_LIEN_LABELS, etatLien } from "@/lib/transmissions/types";

/**
 * Ce qui est accessible dehors, en ce moment.
 *
 * POURQUOI CET ÉCRAN EXISTE. Un lien ne se voyait que depuis la pièce qu'il
 * partage. Savoir ce qui était ouvert supposait donc d'ouvrir les pièces une à
 * une — c'est-à-dire ne jamais le savoir. Or c'est précisément la question
 * qu'on se pose le jour où quelque chose ne va pas : qu'est-ce qui circule,
 * depuis quand, et chez qui.
 *
 * CE QU'IL NE MONTRE PAS, ET NE POURRA JAMAIS MONTRER : les jetons. La base
 * n'en garde que l'empreinte. Chaque ligne porte les quatre derniers caractères
 * du sien — de quoi reconnaître un lien dans une conversation, pas de quoi le
 * reconstituer.
 *
 * L'ORDRE EST CELUI DE L'INQUIÉTUDE : ce qui est encore ouvert d'abord, le
 * reste ensuite. Un lien clos n'appelle aucune décision.
 */
export default async function TransmissionsPage() {
  const practice = await getCurrentPractice();
  if (!practice) notFound();

  const maintenant = new Date();
  const { items, erreur } = await listLiensDuCabinet(practice);

  const rang = { actif: 0, expire: 1, revoque: 2 } as const;
  const liens = [...items].sort((a, b) => {
    const ra = rang[etatLien(a, maintenant)];
    const rb = rang[etatLien(b, maintenant)];
    if (ra !== rb) return ra - rb;
    return b.created_at.localeCompare(a.created_at);
  });
  const ouverts = liens.filter((l) => etatLien(l, maintenant) === "actif");

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <Link
        href="/comptabilite"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        Comptabilité
      </Link>

      <PageHeader
        title="Documents transmis"
        subtitle={
          ouverts.length === 0
            ? "Aucun lien n'est ouvert en ce moment."
            : `${ouverts.length} lien${ouverts.length > 1 ? "s" : ""} encore ouvert${
                ouverts.length > 1 ? "s" : ""
              }, sur ${liens.length} au total.`
        }
      />

      {erreur && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          {erreur}
        </p>
      )}

      {liens.length === 0 && !erreur ? (
        <EmptyState
          icon={<Link2 className="w-6 h-6" aria-hidden="true" />}
          title="Aucun document transmis"
          description="Un lien se crée depuis une facture ou une attestation déjà émise."
        />
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100">
            {liens.map((l) => {
              const etat = etatLien(l, maintenant);
              return (
                <li key={l.id} className="py-3 flex flex-wrap gap-x-4 gap-y-1 items-baseline">
                  <span className="text-sm text-slate-800">
                    {l.sujet ? (
                      <Link
                        href={l.sujet.href}
                        className="underline decoration-slate-300 underline-offset-2 hover:decoration-slate-600"
                      >
                        {l.sujet.titre}
                        {l.sujet.numero ? ` ${l.sujet.numero}` : ""}
                      </Link>
                    ) : (
                      /* La pièce n'est plus lisible : le lien reste, et le dit.
                         Le taire laisserait croire qu'il n'existe pas. */
                      <span className="text-slate-500 italic">
                        Pièce non accessible
                      </span>
                    )}
                    {l.sujet?.patient && (
                      <span className="text-slate-500"> — {l.sujet.patient}</span>
                    )}
                  </span>

                  <span className="text-xs text-slate-500">
                    {l.recipient_label?.trim()
                      ? `à ${l.recipient_label.trim()}`
                      : "destinataire non noté"}
                  </span>

                  <span className="text-xs text-slate-400 font-mono">…{l.token_hint}</span>

                  {/* L'état ne se lit pas à la couleur seule : il est écrit. */}
                  <span
                    className={
                      "text-xs rounded-full px-2 py-0.5 " +
                      (etat === "actif"
                        ? "bg-emerald-50 text-emerald-800"
                        : "bg-slate-100 text-slate-600")
                    }
                  >
                    {ETAT_LIEN_LABELS[etat]}
                    {etat === "actif" && ` jusqu'au ${frDate(l.expires_at)}`}
                  </span>

                  <span className="text-xs text-slate-500 ml-auto">
                    {l.access_count === 0
                      ? "jamais consulté"
                      : `${l.access_count} consultation${l.access_count > 1 ? "s" : ""}`}
                    {l.last_accessed_at && `, la dernière le ${frDate(l.last_accessed_at)}`}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <p className="text-xs text-slate-400 mt-4">
        Un lien se révoque depuis la pièce qu&apos;il partage. La révocation
        empêche de rouvrir le document ; elle n&apos;efface pas ce qui a déjà
        été lu.
      </p>
    </div>
  );
}
