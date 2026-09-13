import { notFound } from "next/navigation";
import { formatCents } from "@/lib/money";
import { frDate } from "@/lib/format";
import { getCurrentPractice } from "@/lib/dossier/practice";
import { getAttestation } from "@/lib/attestations/queries";
import { formulePresence, libelleActe } from "@/lib/attestations/types";
import type { AttestationSnapshot } from "@/lib/attestations/types";
import { BandeauEtat, CoqueDocument, RefusBrouillon } from "@/components/Imprimable";
import { mentionEtatAttestation } from "@/lib/impression/mentions";

import type { Metadata } from "next";
/* LE TITRE EST STATIQUE, ET C'EST DÉLIBÉRÉ. Un titre qui porterait le nom du
   patient le ferait entrer dans l'historique du navigateur, parfois synchronisé
   entre appareils, parfois affiché devant quelqu'un d'autre. C'est le même
   raisonnement que celui de la page de consultation publique, et il vaut
   autant ici. Distinguer les pages entre elles suffit. */
export const metadata: Metadata = { title: "Attestation à imprimer · Psychomotime" };


/**
 * L'attestation telle qu'elle est remise.
 *
 * TOUT CE QUI S'IMPRIME VIENT DE L'INSTANTANÉ, figé à la signature. Un
 * rendez-vous peut être requalifié, un patient déménager, un praticien changer
 * de numéro professionnel : le document déjà remis ne change pas. Le relire
 * avec les données du jour produirait une attestation qui n'a jamais existé.
 *
 * CE QUI N'Y ENTRE PAS : la note interne, le motif de la demande, le parcours
 * de soin, la moindre observation. Ce document part chez un employeur, une
 * mutuelle, une administration — il dit qu'une personne est venue, ou qu'une
 * somme a été reçue, et rien d'autre.
 */
export default async function DocumentAttestationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const practice = await getCurrentPractice();
  if (!practice) notFound();

  const complete = await getAttestation(practice, id);
  if (!complete) notFound();

  const a = complete.attestation;
  if (a.status === "brouillon") {
    // Un brouillon ne s'imprime pas : il n'est ni numéroté ni signé, et
    // sortirait de l'imprimante indiscernable d'un document définitif.
    return (
      <RefusBrouillon
        retour={{ href: `/comptabilite/attestations/${a.id}`, libelle: "Retour à l'attestation" }}
        titre="Cette attestation est un brouillon"
      >
        Ce brouillon n&apos;est pas signé. Signez-le pour obtenir le document à
        remettre.
      </RefusBrouillon>
    );
  }

  const s: AttestationSnapshot = a.snapshot ?? {};
  const emetteur = s.entite_juridique;
  const identifiants = (s.identifiants ?? []).filter((i) => i?.valeur);
  const destinataire = s.destinataire?.nom?.trim() ? s.destinataire : null;
  const seances = s.seances ?? [];
  const reglements = s.reglements ?? [];
  const factures = (s.factures ?? []).filter((f) => f?.numero);
  const signataire = s.praticien;
  const patient = s.patient;
  const payeurs = (s.payeurs ?? []).filter((p) => p && p.trim() !== "");

  /* La formule dépend de CE QUI EST ATTESTÉ. Un entretien parental n'atteste
   * pas la présence de l'enfant : la phrase cesse alors d'affirmer une
   * présence physique, et la nature de chaque acte s'imprime. */
  const formule = formulePresence(seances.map((x) => x.nature ?? "seance"));
  const detail = a.detail_nature || formule.forcerNature;

  const mention = mentionEtatAttestation({
    status: a.status,
    motif: a.cancellation_reason,
  });

  return (
    <CoqueDocument
      retour={{ href: `/comptabilite/attestations/${a.id}`, libelle: "Retour à l'attestation" }}
      /* « Une attestation déborde souvent sur une seconde page — une année
         scolaire fait une trentaine de dates. » Le rappel qui devait identifier
         cette page 2 ne s'imprimait qu'UNE fois, en bas de la dernière. Il se
         répète désormais en marge de chaque page. Le numéro reste : pour une
         pièce numérotée, c'est la clé qui rattache une page à son document. */
      rappel={{
        nature: a.number ? `Attestation n° ${a.number}` : "Attestation",
        personne: patient?.nom,
        date: frDate(a.issued_on),
      }}
      bandeau={
        mention && (
          <BandeauEtat ton="arret" trait="plein" titre={mention.titre}>
            {mention.texte}
          </BandeauEtat>
        )
      }
      note={
        <>
          Ce document est rendu à partir de l&apos;instantané figé à la signature :
          il ne changera plus, quelles que soient les modifications apportées
          ensuite au dossier ou à l&apos;agenda.
        </>
      }
    >
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
            <h1 className="text-xl font-semibold text-brand-700 tracking-tight uppercase">
              {a.kind === "presence"
                ? "Attestation de présence"
                : "Attestation de paiement"}
            </h1>
            <p className="text-slate-700 mt-1">{a.number}</p>
            {a.issued_on && (
              <p className="text-slate-500">{frDate(a.issued_on)}</p>
            )}
          </div>
        </header>

        {destinataire && (
          <section className="mb-8 text-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
              Remise à
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
          </section>
        )}

        <section className="text-sm text-slate-800 leading-relaxed space-y-4">
          <p>
            Je soussigné(e){" "}
            <strong className="font-medium">
              {signataire?.nom?.trim() || "—"}
            </strong>
            {signataire?.titre && `, ${signataire.titre}`}, atteste{" "}
            {a.kind === "paiement" ? "avoir reçu :" : "que :"}
          </p>

          {a.kind === "presence" ? (
            <p className="pl-4">
              <strong className="font-medium">
                {patient?.nom?.trim() || "—"}
              </strong>
              {patient?.ne_le && `, né(e) le ${frDate(patient.ne_le)}`}
            </p>
          ) : (
            /* QUI A PAYÉ. Écrire qu'un enfant « a réglé la somme de… » était
               faux, et privait la mutuelle du nom de son assuré. Plusieurs
               payeurs sont possibles : on les nomme tous plutôt que d'en
               choisir un. */
            <p className="pl-4">
              de{" "}
              <strong className="font-medium">
                {payeurs.length > 0 ? payeurs.join(", ") : "—"}
              </strong>
            </p>
          )}

          {a.kind === "presence" ? (
            <>
              <p>
                {formule.phrase}
                {a.period_start && ` du ${frDate(a.period_start)}`}
                {a.period_end && ` au ${frDate(a.period_end)}`}, aux dates
                suivantes :
              </p>
              <ul className="pl-4 list-none m-0 space-y-0.5">
                {seances.map((x, i) => (
                  <li key={`${x.date}-${i}`} className="text-slate-700">
                    {x.date ? frDate(x.date) : "—"}
                    {detail && x.nature && (
                      <span className="text-slate-500">
                        {" — "}
                        {libelleActe(x.nature, true)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <p>
                soit <strong className="font-medium">{seances.length}</strong>{" "}
                séance{seances.length > 1 ? "s" : ""}.
              </p>
            </>
          ) : (
            <>
              <p>
                la somme de{" "}
                <strong className="font-medium">
                  {formatCents(a.total_cents)}
                </strong>{" "}
                au titre des séances de psychomotricité de{" "}
                <strong className="font-medium">
                  {patient?.nom?.trim() || "—"}
                </strong>
                {patient?.ne_le && `, né(e) le ${frDate(patient.ne_le)}`}
                {a.period_start && `, du ${frDate(a.period_start)}`}
                {a.period_end && ` au ${frDate(a.period_end)}`}.
              </p>
              {reglements.length > 0 && (
                <>
                  <p>Règlements reçus :</p>
                  <ul className="pl-4 list-none m-0 space-y-0.5">
                    {reglements.map((r, i) => (
                      <li key={`${r.date}-${i}`} className="text-slate-700">
                        {r.date ? frDate(r.date) : "—"} —{" "}
                        {formatCents(r.montant_centimes ?? 0)}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {factures.length > 0 && (
                <p className="text-slate-600">
                  Facture{factures.length > 1 ? "s" : ""} concernée
                  {factures.length > 1 ? "s" : ""} :{" "}
                  {factures.map((f) => f.numero).join(", ")}.
                </p>
              )}
            </>
          )}

          {a.note && <p className="whitespace-pre-wrap">{a.note}</p>}

          <p className="text-slate-600">
            Attestation établie pour faire valoir ce que de droit.
          </p>
        </section>

        {/* UNE ATTESTATION SE SIGNE À LA MAIN. Sans place réservée, la
            signature atterrit sur le nom imprimé. Le bloc ne se coupe pas
            entre deux pages : une formule de clôture seule en bas de page,
            signature page suivante, ne ressemble à rien. */}
        <footer
          className="mt-12 text-sm text-right"
          style={{ breakInside: "avoid" }}
        >
          {a.issued_on && (
            <p className="text-slate-600">
              Fait à {emetteur?.ville?.trim() || "…"}, le {frDate(a.issued_on)}
            </p>
          )}
          <p className="text-xs uppercase tracking-wide text-slate-500 mt-8">
            Signature et cachet
          </p>
          <div className="h-24 border-b border-slate-200 mt-1" aria-hidden="true" />
          <p className="text-slate-800 font-medium mt-1">
            {signataire?.nom?.trim() || ""}
          </p>
          {signataire?.titre && (
            <p className="text-slate-600 text-xs">{signataire.titre}</p>
          )}
        </footer>

    </CoqueDocument>
  );
}
