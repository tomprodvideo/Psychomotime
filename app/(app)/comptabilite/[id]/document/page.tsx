import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { formatCents } from "@/lib/money";
import { frDate } from "@/lib/format";
import { getCurrentPractice } from "@/lib/dossier/practice";
import { getDocument } from "@/lib/compta/queries";
import { KIND_LABELS } from "@/lib/compta/types";
import type { DocumentSnapshot } from "@/lib/compta/types";
import BoutonImprimer from "./BoutonImprimer";

import type { Metadata } from "next";
/* LE TITRE EST STATIQUE, ET C'EST DÉLIBÉRÉ. Un titre qui porterait le nom du
   patient le ferait entrer dans l'historique du navigateur, parfois synchronisé
   entre appareils, parfois affiché devant quelqu'un d'autre. C'est le même
   raisonnement que celui de la page de consultation publique, et il vaut
   autant ici. Distinguer les pages entre elles suffit. */
export const metadata: Metadata = { title: "Document à imprimer · Psychomotime" };


/**
 * Le document tel qu'il est remis.
 *
 * TOUT CE QUI S'IMPRIME VIENT DE L'INSTANTANÉ, figé à l'émission. C'est le
 * cœur du dispositif : une facture de l'an dernier doit se réimprimer
 * exactement comme elle a été remise, même si l'adresse du cabinet, sa forme
 * juridique ou son régime fiscal ont changé depuis. Relire les valeurs du jour
 * produirait un document qui n'a jamais existé.
 *
 * CE QUI N'Y ENTRE PAS : la note interne, les estimations reprises de la
 * version précédente, le solde, les règlements. Ce document dit ce qui est dû
 * et pourquoi ; le reste appartient au cabinet.
 *
 * UNE ABSENCE N'EST PAS REMPLACÉE. Une mention que l'instantané ne porte pas
 * est retirée du document, jamais comblée par une valeur plausible.
 */
export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const practice = await getCurrentPractice();
  if (!practice) notFound();

  const piece = await getDocument(practice, id);
  if (!piece) notFound();

  const d = piece.document;
  if (d.status === "brouillon") {
    // Un brouillon ne s'imprime pas : il n'a ni numéro ni date, et sortirait
    // de l'imprimante indiscernable d'un document définitif.
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <Link
          href={`/comptabilite/${d.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Retour à la pièce
        </Link>
        <p className="text-slate-600">
          Ce brouillon n&apos;a pas encore de numéro ni de date d&apos;émission.
          Émettez-le pour obtenir le document à remettre.
        </p>
      </div>
    );
  }

  const s: DocumentSnapshot = d.snapshot ?? {};
  const emetteur = s.entite_juridique;
  const payeurTiers = Boolean(s.payeur?.nom?.trim());
  const destinataire = payeurTiers ? s.payeur : (s.patient ?? null);
  /* QUAND UN TIERS PAIE, LE DOCUMENT DOIT DIRE AU TITRE DE QUI.
   * Sans cette mention, une facture réglée par une grand-mère, une MDPH ou une
   * plateforme ne nomme nulle part l'enfant soigné : la famille qui la
   * transmet à sa mutuelle n'a rien à produire. L'instantané porte déjà le
   * nom du patient — il suffisait de l'imprimer. */
  const patientConcerne = payeurTiers ? s.patient?.nom?.trim() : null;
  const identifiants = (s.identifiants ?? []).filter((i) => i?.valeur);

  /* ── CE DOCUMENT VAUT-IL ENCORE ? ────────────────────────────────────────
   *
   * Sept statuts existent ; cette page n'en traitait qu'UN — le brouillon,
   * qu'elle refuse d'imprimer. Les cinq autres sortaient de l'imprimante
   * strictement identiques à une pièce vivante. Une facture annulée par avoir,
   * remise à une mutuelle, ne disait nulle part qu'elle était annulée.
   *
   * Le produit prend pourtant la peine de marquer l'annulation sur
   * l'attestation et sur les quatre écrits cliniques. Il ne la marquait pas
   * sur la seule pièce qui sert à se faire rembourser.
   *
   * CHAQUE MENTION DIT LA CONSÉQUENCE, ET LE RECOURS QUAND IL Y EN A UN.
   * « Ce document est annulé » ne dit ni l'une ni l'autre : le lecteur ne sait
   * ni ce qu'il ne peut plus faire, ni quelle pièce demander à la place.
   *
   * ELLE TIENT SANS COULEUR. Un mot en capitales, un trait de 2 px, et la
   * teinte seulement en troisième — c'est la recette que l'attestation avait
   * déjà trouvée. `print:bg-white` retire l'aplat : sur une imprimante
   * monochrome, un fond teinté devient un gris qui dégrade le texte posé
   * dessus. Le trait, lui, reste un trait.
   */
  const feminin = d.kind === "facture" || d.kind === "facture_de_remplacement";
  const accord = feminin ? "e" : "";
  /* « Ce avoir » : l'élision ne se déduit pas du genre. On la pose. */
  const ce = feminin ? "Cette" : d.kind === "avoir" ? "Cet" : "Ce";
  const nomPiece = KIND_LABELS[d.kind].toUpperCase();
  /* La pièce qui rectifie celle-ci : c'est elle qu'il faut aller chercher. */
  const rectifiant =
    piece.rectifications.find((r) => r.status !== "brouillon") ?? null;
  const refRectifiant = rectifiant?.number
    ? `n° ${rectifiant.number}${
        rectifiant.issued_on ? ` du ${frDate(rectifiant.issued_on)}` : ""
      }`
    : null;

  const mention: { titre: string; texte: string } | null =
    d.status === "annule_par_avoir"
      ? {
          titre: `${nomPiece} ANNULÉ${accord.toUpperCase()} PAR AVOIR`,
          texte: refRectifiant
            ? `Cette pièce a été annulée par l'avoir ${refRectifiant}. Elle ne peut pas servir de justificatif.`
            : "Cette pièce a été annulée par un avoir. Elle ne peut pas servir de justificatif.",
        }
      : d.status === "remplace"
        ? {
            titre: `${nomPiece} REMPLACÉ${accord.toUpperCase()}`,
            texte: refRectifiant
              ? `Cette pièce a été remplacée par la pièce ${refRectifiant}, qui seule fait foi.`
              : "Cette pièce a été remplacée. C'est la pièce de remplacement qui fait foi.",
          }
        : d.status === "refuse"
          ? {
              titre: `${nomPiece} REFUSÉ${accord.toUpperCase()}`,
              texte: `${ce} ${KIND_LABELS[
                d.kind
              ].toLowerCase()} n'a pas été accepté${accord}. Les montants indiqués n'engagent personne.`,
            }
          : d.status === "expire"
            ? {
                titre: `${nomPiece} EXPIRÉ${accord.toUpperCase()}`,
                texte: d.valid_until
                  ? `${ce} ${KIND_LABELS[d.kind].toLowerCase()} était valable jusqu'au ${frDate(
                      d.valid_until,
                    )}. Les montants indiqués ne sont plus engageants.`
                  : `${ce} ${KIND_LABELS[
                      d.kind
                    ].toLowerCase()} a dépassé sa durée de validité. Les montants indiqués ne sont plus engageants.`,
              }
            : null;
  const exonere = piece.lignes.every(
    (l) => l.vat_treatment === "exoneration_soins",
  );

  /* LA MENTION « ACQUITTÉE » EST CE QU'UNE FAMILLE DEMANDE LE PLUS SOUVENT
   * pour un remboursement. Ce n'est pas une attestation de paiement — elle ne
   * porte ni la période ni le détail des règlements — mais c'est un fait que
   * le document peut énoncer : cette facture-ci a été réglée, à cette date.
   *
   * Elle ne s'affiche QUE si le solde est nul ET qu'un règlement a été imputé.
   * Une facture à zéro euro n'est pas une facture acquittée. */
  const encaisse = piece.reglements.reduce((s, r) => s + r.amount_cents, 0);
  const acquitteeLe =
    d.kind !== "devis" && piece.solde_cents === 0 && encaisse > 0
      ? piece.reglements[piece.reglements.length - 1]?.received_on
      : null;

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5 no-print">
        <Link
          href={`/comptabilite/${d.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Retour à la pièce
        </Link>
        <BoutonImprimer />
      </div>

      <article className="print-area bg-white rounded-xl border border-slate-100 shadow-sm p-8 sm:p-10">
        {mention && (
          <p
            className="border-2 border-arret-trait bg-arret-fond print:bg-white text-arret-encre text-center px-4 py-3 mb-8 rounded-lg"
            style={{ breakInside: "avoid" }}
          >
            <span className="font-semibold uppercase tracking-wide text-sm">
              {mention.titre}
            </span>
            <span className="block text-xs mt-1">{mention.texte}</span>
          </p>
        )}

        <header className="flex justify-between gap-8 mb-10">
          <div className="text-sm text-slate-700">
            {s.cabinet?.nom && (
              <p className="font-semibold text-slate-800">{s.cabinet.nom}</p>
            )}
            {emetteur?.denomination && <p>{emetteur.denomination}</p>}
            {emetteur?.adresse && <p>{emetteur.adresse}</p>}
            {(emetteur?.code_postal || emetteur?.ville) && (
              <p>
                {[emetteur.code_postal, emetteur.ville].filter(Boolean).join(" ")}
              </p>
            )}
            {identifiants.length > 0 && (
              <p className="text-xs text-slate-500 mt-2">
                {identifiants
                  .map((i) => `${(i.type ?? "").toUpperCase()} ${i.valeur}`)
                  .join(" · ")}
              </p>
            )}
          </div>

          <div className="text-right text-sm">
            <h1 className="text-2xl font-semibold text-brand-700 tracking-tight">
              {KIND_LABELS[d.kind].toUpperCase()}
            </h1>
            <p className="text-slate-700 mt-1">{d.number}</p>
            {d.issued_on && (
              <p className="text-slate-500">{frDate(d.issued_on)}</p>
            )}
            {d.due_on && (
              <p className="text-slate-500 mt-1">
                Échéance : {frDate(d.due_on)}
              </p>
            )}
            {d.valid_until && (
              <p className="text-slate-500 mt-1">
                Valable jusqu&apos;au {frDate(d.valid_until)}
              </p>
            )}
          </div>
        </header>

        {destinataire?.nom && (
          <section className="mb-8 text-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
              Destinataire
            </p>
            <p className="text-slate-800 font-medium">{destinataire.nom}</p>
            {destinataire.adresse && (
              <p className="text-slate-600">{destinataire.adresse}</p>
            )}
            {(destinataire.code_postal || destinataire.ville) && (
              <p className="text-slate-600">
                {[destinataire.code_postal, destinataire.ville]
                  .filter(Boolean)
                  .join(" ")}
              </p>
            )}
            {patientConcerne && (
              <p className="text-slate-700 mt-2">
                Au titre des séances de{" "}
                <strong className="font-medium">{patientConcerne}</strong>
              </p>
            )}
          </section>
        )}

        {d.rectifies_number && (
          <p className="text-sm text-slate-600 mb-6">
            {KIND_LABELS[d.kind]} rectifiant la facture {d.rectifies_number}
            {d.rectifies_issued_on && ` du ${frDate(d.rectifies_issued_on)}`}
            {d.rectification_reason && ` — ${d.rectification_reason}`}.
          </p>
        )}

        {(d.period_start || d.period_end) && (
          <p className="text-sm text-slate-600 mb-4">
            Période : {d.period_start && `du ${frDate(d.period_start)}`}
            {d.period_end && ` au ${frDate(d.period_end)}`}
          </p>
        )}

        <table className="w-full text-sm mb-8">
          <caption className="sr-only">Détail des prestations</caption>
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
              <th scope="col" className="py-2 font-medium">Prestation</th>
              <th scope="col" className="py-2 font-medium text-right w-24">P.U.</th>
              <th scope="col" className="py-2 font-medium text-right w-16">Qté</th>
              <th scope="col" className="py-2 font-medium text-right w-28">Montant</th>
            </tr>
          </thead>
          <tbody>
            {piece.lignes.map((l) => (
              <tr key={l.id} className="border-b border-slate-100 align-top">
                <td className="py-3 pr-4">
                  <span className="text-slate-800">{l.label}</span>
                  {l.intro && (
                    <span className="block text-slate-500 mt-0.5">{l.intro}</span>
                  )}
                  {l.service_dates.length > 0 && (
                    <span className="block text-slate-600 mt-0.5">
                      {/* Les dates sont imprimées dans les deux cas : « 3 date(s) »
                          n'apprend rien à qui reçoit la facture, alors que les
                          dates elles-mêmes sont ce qu'une mutuelle demande. Le
                          réglage ne change que la mise en forme. */}
                      {l.date_render === "par_date"
                        ? l.service_dates.map((x) => frDate(x)).join(", ")
                        : `Séance${l.service_dates.length > 1 ? "s" : ""} du ${l.service_dates
                            .map((x) => frDate(x))
                            .join(", ")}`}
                    </span>
                  )}
                  {l.note && (
                    <span className="block text-slate-500 mt-0.5 italic">
                      {l.note}
                    </span>
                  )}
                </td>
                <td className="py-3 text-right text-slate-600 tabular-nums">
                  {formatCents(l.unit_price_cents)}
                </td>
                <td className="py-3 text-right text-slate-600 tabular-nums">
                  {l.pricing === "forfait" ? "—" : l.quantity}
                </td>
                <td className="py-3 text-right text-slate-800 tabular-nums">
                  {formatCents(l.amount_cents)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="pt-4 text-right font-medium text-slate-700">
                Total {d.kind === "avoir" ? "de l'avoir" : "à régler"}
              </td>
              <td className="pt-4 text-right text-lg font-semibold text-slate-900 tabular-nums">
                {formatCents(d.total_cents)}
              </td>
            </tr>
          </tfoot>
        </table>

        {d.note && (
          <p className="text-sm text-slate-700 whitespace-pre-wrap mb-6">
            {d.note}
          </p>
        )}

        {acquitteeLe && (
          <p className="text-sm font-medium text-slate-800 mb-4">
            Facture acquittée le {frDate(acquitteeLe)}.
          </p>
        )}

        {exonere && (
          <p className="text-xs text-slate-500">
            TVA non applicable — exonération des soins.
          </p>
        )}
      </article>

      <p className="text-xs text-slate-500 mt-4 no-print">
        Ce document est rendu à partir de l&apos;instantané figé à
        l&apos;émission : il ne changera plus, quelles que soient les
        modifications apportées ensuite au cabinet ou au dossier.
      </p>
    </div>
  );
}
