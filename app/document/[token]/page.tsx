import type { Metadata } from "next";
import { formatCents } from "@/lib/money";
import { liste } from "@/lib/liste";
import { frDate } from "@/lib/format";
import { getDocumentPublic } from "@/lib/transmissions/queries";
import type { DocumentPublic } from "@/lib/transmissions/types";
import { KIND_LABELS } from "@/lib/compta/types";
import { BandeauEtat, CoqueDocument } from "@/components/Imprimable";
import { mentionEtatAttestation, mentionEtatPiece } from "@/lib/impression/mentions";

/* Le contrat public transmet `kind` en chaîne libre : une nature inconnue ne
   doit pas imprimer « undefined ». */
const NATURE_PIECE: Record<string, string> = KIND_LABELS;
import { formulePresence, libelleActe } from "@/lib/attestations/types";

/**
 * Consultation d'un document par son lien.
 *
 * SEULE PAGE DU PRODUIT ACCESSIBLE SANS COMPTE. Ce qu'elle affiche vient
 * entièrement de `public.shared_document`, qui est la définition unique du
 * contenu public — cette page ne décide de rien et ne lit aucune table.
 *
 * LE TITRE NE DIT PAS CE QUE C'EST. « Votre document » plutôt que « Facture » :
 * le titre d'un onglet se retrouve dans un historique de navigation, parfois
 * synchronisé, parfois partagé avec un poste de travail. Qu'une personne suive
 * des séances de psychomotricité n'a pas à s'y lire.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
  title: "Votre document",
  referrer: "no-referrer",
};

// Rien n'est mis en cache : le contenu dépend d'un jeton et chaque consultation
// est tracée.
export const dynamic = "force-dynamic";

export default async function DocumentPublicPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const { document, trop_de_consultations } = await getDocumentPublic(token);

  if (trop_de_consultations) {
    return (
      <Cadre titre="Trop de consultations">
        Ce lien a été ouvert un très grand nombre de fois dans l&apos;heure.
        Réessayez un peu plus tard.
      </Cadre>
    );
  }

  /* UNE SEULE RÉPONSE POUR TROIS CAUSES. Jeton inconnu, expiré ou révoqué :
   * rien ne les distingue ici, parce que rien ne les distingue en base. Dire
   * « ce lien a expiré » à qui tâtonne lui apprendrait qu'il a existé. */
  if (!document) {
    return (
      <Cadre titre="Ce lien n'est plus valide">
        Il a peut-être expiré, ou été retiré par le cabinet. Demandez-en un
        nouveau à la personne qui vous l&apos;a transmis.
      </Cadre>
    );
  }

  const mention =
    document.nature === "billing_document"
      ? mentionEtatPiece({
          kind: document.kind,
          status: document.etat,
          validUntil: document.valable_jusqu_au,
          /* Le contrat public ne transmet pas la pièce qui rectifie celle-ci :
             la mention le dit donc sans numéro, plutôt que d'en inventer un. */
          rectifiant: null,
        })
      : mentionEtatAttestation({
          status: document.etat,
          motif: document.motif_annulation,
        });

  return (
    <CoqueDocument
      contexte="Document transmis par votre praticien"
      /* AUCUN JAVASCRIPT POUR IMPRIMER, ici plus qu'ailleurs : c'est la seule
         page ouverte sans compte, et l'impression du navigateur y suffit. Le
         bouton vide et caché qui occupait cette place ne faisait rien. */
      imprimer={false}
      rappel={{
        nature:
          document.nature === "billing_document"
            ? `${NATURE_PIECE[document.kind] ?? "Pièce"}${document.numero ? ` n° ${document.numero}` : ""}`
            : `Attestation${document.numero ? ` n° ${document.numero}` : ""}`,
        personne: document.patient?.nom,
        date: frDate(document.emise_le),
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
          Ce lien est personnel. Il cesse de fonctionner à son expiration, ou
          dès que le cabinet le retire.
        </>
      }
    >
      {document.nature === "billing_document" ? (
        <Piece d={document} />
      ) : (
        <Attestation d={document} />
      )}
    </CoqueDocument>
  );
}

/* ==========================================================================
 *  Les deux rendus
 * ========================================================================== */

function EnTete({
  d,
  titre,
}: {
  d: DocumentPublic;
  titre: string;
}) {
  const e = d.emetteur;
  const echeance = d.nature === "billing_document" ? d.echeance : null;
  const valableJusquAu =
    d.nature === "billing_document" ? d.valable_jusqu_au : null;
  const identifiants = liste<{ type?: string; valeur?: string }>(e.identifiants)
    .filter((i) => i?.valeur);
  return (
    <header className="flex justify-between gap-8 mb-10">
      <div className="text-sm text-slate-700">
        {e.cabinet && <p className="font-semibold text-slate-800">{e.cabinet}</p>}
        {e.entite?.denomination && <p>{e.entite.denomination}</p>}
        {e.entite?.adresse && <p>{e.entite.adresse}</p>}
        {(e.entite?.code_postal || e.entite?.ville) && (
          <p>{[e.entite.code_postal, e.entite.ville].filter(Boolean).join(" ")}</p>
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
          {titre}
        </h1>
        {d.numero && <p className="text-slate-700 mt-1">{d.numero}</p>}
        {d.emise_le && <p className="text-slate-500">{frDate(d.emise_le)}</p>}
        {/* Échéance et validité étaient servies et jamais affichées : la
            version papier les porte, celle-ci les taisait. Un devis arrivait
            ainsi sans la seule date qui le rend opposable. */}
        {echeance && (
          <p className="text-slate-500 mt-1">Échéance : {frDate(echeance)}</p>
        )}
        {valableJusquAu && (
          <p className="text-slate-500 mt-1">
            Valable jusqu&apos;au {frDate(valableJusquAu)}
          </p>
        )}
      </div>
    </header>
  );
}

function Destinataire({
  personne,
  auTitreDe,
}: {
  personne: { nom?: string | null; adresse?: string | null; code_postal?: string | null; ville?: string | null } | null;
  auTitreDe?: string | null;
}) {
  if (!personne?.nom) return null;
  return (
    <section className="mb-8 text-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
        Destinataire
      </p>
      <p className="text-slate-800 font-medium">{personne.nom}</p>
      {personne.adresse && <p className="text-slate-600">{personne.adresse}</p>}
      {(personne.code_postal || personne.ville) && (
        <p className="text-slate-600">
          {[personne.code_postal, personne.ville].filter(Boolean).join(" ")}
        </p>
      )}
      {auTitreDe && (
        <p className="text-slate-700 mt-2">
          Au titre des séances de{" "}
          <strong className="font-medium">{auTitreDe}</strong>
        </p>
      )}
    </section>
  );
}

const TITRES_PIECE: Record<string, string> = {
  devis: "Devis",
  facture: "Facture",
  facture_de_remplacement: "Facture de remplacement",
  avoir: "Avoir",
};

function Piece({ d }: { d: Extract<DocumentPublic, { nature: "billing_document" }> }) {
  const lignes = liste<NonNullable<typeof d.lignes>[number]>(d.lignes);
  const exonere = lignes.every((l) => l.tva === "exoneration_soins");
  const payeurTiers = Boolean(d.destinataire?.nom?.trim());

  return (
    <>
      <EnTete d={d} titre={TITRES_PIECE[d.kind] ?? "Document"} />
      <Destinataire
        personne={payeurTiers ? d.destinataire : { nom: d.patient?.nom ?? null }}
        auTitreDe={payeurTiers ? (d.patient?.nom ?? null) : null}
      />

      {d.rectifie_numero && (
        <p className="text-sm text-slate-600 mb-6">
          {TITRES_PIECE[d.kind]} rectifiant la facture {d.rectifie_numero}
          {d.rectifie_emise_le && ` du ${frDate(d.rectifie_emise_le)}`}
          {d.rectification_motif && ` — ${d.rectification_motif}`}.
        </p>
      )}

      {(d.periode_debut || d.periode_fin) && (
        <p className="text-sm text-slate-600 mb-4">
          Période : {d.periode_debut && `du ${frDate(d.periode_debut)}`}
          {d.periode_fin && ` au ${frDate(d.periode_fin)}`}
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
          {lignes.map((l, i) => (
            <tr key={`${l.libelle}-${i}`} className="border-b border-slate-100 align-top">
              <td className="py-3 pr-4">
                <span className="text-slate-800">{l.libelle}</span>
                {l.intro && <span className="block text-slate-500 mt-0.5">{l.intro}</span>}
                {/* La praticienne choisit la mise en forme des dates de
                    séance ; le réglage était servi et ignoré ici, si bien que
                    la version reçue par lien ne présentait pas ses dates comme
                    la version imprimée. */}
                {liste<string>(l.dates).length > 0 && (
                  <span className="block text-slate-600 mt-0.5">
                    {l.rendu_dates === "par_date"
                      ? liste<string>(l.dates).map((x) => frDate(x)).join(", ")
                      : `Séance${liste<string>(l.dates).length > 1 ? "s" : ""} du ${liste<string>(
                          l.dates,
                        )
                          .map((x) => frDate(x))
                          .join(", ")}`}
                  </span>
                )}
                {l.note && (
                  <span className="block text-slate-500 mt-0.5 italic">{l.note}</span>
                )}
              </td>
              <td className="py-3 text-right text-slate-600 tabular-nums">
                {formatCents(l.prix_unitaire_centimes)}
              </td>
              <td className="py-3 text-right text-slate-600 tabular-nums">
                {l.tarification === "forfait" ? "—" : l.quantite}
              </td>
              <td className="py-3 text-right text-slate-800 tabular-nums">
                {formatCents(l.montant_centimes)}
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
              {formatCents(d.total_centimes)}
            </td>
          </tr>
        </tfoot>
      </table>

      {d.acquittee_le && (
        <p className="text-sm font-medium text-slate-800 mb-4">
          Facture acquittée le {frDate(d.acquittee_le)}.
        </p>
      )}

      {d.mention && (
        <p className="text-sm text-slate-700 whitespace-pre-wrap mb-6">{d.mention}</p>
      )}

      {exonere && lignes.length > 0 && (
        <p className="text-xs text-slate-500">
          TVA non applicable — exonération des soins.
        </p>
      )}
    </>
  );
}

function Attestation({ d }: { d: Extract<DocumentPublic, { nature: "attestation" }> }) {
  const seances = liste<NonNullable<typeof d.seances>[number]>(d.seances);
  const reglements = liste<NonNullable<typeof d.reglements>[number]>(d.reglements);
  const payeurs = liste<string>(d.payeurs).filter((p) => typeof p === "string" && p.trim() !== "");
  const factures = liste<NonNullable<typeof d.factures>[number]>(d.factures).filter((f) => f?.numero);
  const formule = formulePresence(seances.map((x) => x.nature ?? "seance"));
  const detail = d.detail_nature || formule.forcerNature;
  const signataire = d.emetteur.praticien;

  return (
    <>
      <EnTete
        d={d}
        titre={
          d.kind === "presence"
            ? "Attestation de présence"
            : "Attestation de paiement"
        }
      />
      <Destinataire personne={d.destinataire} />

      <section className="text-sm text-slate-800 leading-relaxed space-y-4">
        <p>
          Je soussigné(e){" "}
          <strong className="font-medium">{signataire?.nom?.trim() || "—"}</strong>
          {signataire?.titre && `, ${signataire.titre}`}, atteste{" "}
          {d.kind === "paiement" ? "avoir reçu :" : "que :"}
        </p>

        {d.kind === "presence" ? (
          <>
            <p className="pl-4">
              <strong className="font-medium">{d.patient?.nom?.trim() || "—"}</strong>
              {d.patient?.ne_le && `, né(e) le ${frDate(d.patient.ne_le)}`}
            </p>
            <p>
              {formule.phrase}
              {d.periode_debut && ` du ${frDate(d.periode_debut)}`}
              {d.periode_fin && ` au ${frDate(d.periode_fin)}`}, aux dates
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
            <p className="pl-4">
              de{" "}
              <strong className="font-medium">
                {payeurs.length > 0 ? payeurs.join(", ") : "—"}
              </strong>
            </p>
            <p>
              la somme de{" "}
              <strong className="font-medium">
                {formatCents(d.total_centimes)}
              </strong>{" "}
              au titre des séances de psychomotricité de{" "}
              <strong className="font-medium">{d.patient?.nom?.trim() || "—"}</strong>
              {d.patient?.ne_le && `, né(e) le ${frDate(d.patient.ne_le)}`}
              {d.periode_debut && `, du ${frDate(d.periode_debut)}`}
              {d.periode_fin && ` au ${frDate(d.periode_fin)}`}.
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

        {d.mention && <p className="whitespace-pre-wrap">{d.mention}</p>}

        <p className="text-slate-600">
          Attestation établie pour faire valoir ce que de droit.
        </p>
      </section>

      <footer className="mt-12 text-sm text-right" style={{ breakInside: "avoid" }}>
        {d.emise_le && (
          <p className="text-slate-600">
            Fait à {d.emetteur.entite?.ville?.trim() || "…"}, le{" "}
            {frDate(d.emise_le)}
          </p>
        )}
        <p className="text-slate-800 font-medium mt-8">
          {signataire?.nom?.trim() || ""}
        </p>
        {signataire?.titre && (
          <p className="text-slate-600 text-xs">{signataire.titre}</p>
        )}
      </footer>
    </>
  );
}

function Cadre({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="max-w-md bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-center">
        <h1 className="font-semibold text-slate-800">{titre}</h1>
        <p className="text-sm text-slate-600 mt-2">{children}</p>
      </div>
    </div>
  );
}
