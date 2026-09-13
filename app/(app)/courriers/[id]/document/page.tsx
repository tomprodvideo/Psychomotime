import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { frDate } from "@/lib/format";
import { getCurrentPractice } from "@/lib/dossier/practice";
import { getCourrier } from "@/lib/courriers/queries";
import { liste } from "@/lib/liste";
import { BandeauEtat, CoqueDocument, RefusBrouillon } from "@/components/Imprimable";

/* LE TITRE EST STATIQUE, ET C'EST DÉLIBÉRÉ. Un titre portant le nom du patient
   le ferait entrer dans l'historique du navigateur, parfois synchronisé,
   parfois affiché devant un tiers. Même raisonnement que pour la page de
   consultation publique. */
export const metadata: Metadata = { title: "Courrier à imprimer · Psychomotime" };

/**
 * Le courrier de liaison, tel qu'il est remis.
 *
 * IL LIT L'INSTANTANÉ, PAS LES DONNÉES VIVANTES. Un courrier remis se relit
 * dans dix ans tel qu'il a été remis : avec le nom que portait le cabinet ce
 * jour-là, le titre et l'identifiant professionnel du signataire à cette date,
 * et le nom du destinataire tel qu'il était alors. Recalculer ces mentions à
 * l'affichage ferait changer un document déjà parti.
 */
export default async function CourrierDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const practice = await getCurrentPractice();
  if (!practice) notFound();

  const c = await getCourrier(practice, id);
  if (!c) notFound();

  /* UN BROUILLON NE S'IMPRIME PAS. Il n'a ni date de remise ni instantané : il
     sortirait de l'imprimante indiscernable d'un courrier réellement remis.
     Même refus que pour une pièce comptable en brouillon. */
  if (c.status === "brouillon" || !c.snapshot) {
    return (
      <RefusBrouillon
        retour={{ href: `/patients/${c.patient_id}`, libelle: "Retour au dossier" }}
        titre="Ce courrier est un brouillon"
      >
        Il n&apos;a pas encore été remis : il ne porte ni date, ni identité du
        signataire. Imprimé tel quel, son destinataire le prendrait pour un
        courrier définitif. Remettez-le depuis le dossier, puis revenez ici.
      </RefusBrouillon>
    );
  }

  const s = c.snapshot;
  const e = s.entite_juridique;
  const d = s.destinataire;
  const identifiants = liste<{ type?: string; valeur?: string }>(s.identifiants).filter(
    (i) => i?.valeur,
  );

  return (
    <CoqueDocument
      retour={{ href: `/patients/${c.patient_id}`, libelle: "Retour au dossier" }}
      /* CE DOCUMENT N'AVAIT AUCUN RAPPEL DE PAGE, et aucune note d'instantané :
         c'était le seul des écrits cliniques à n'avoir ni l'un ni l'autre. */
      rappel={{
        nature: "Courrier de liaison",
        personne: s.patient?.nom,
        date: frDate(s.emis_le ?? c.issued_on ?? ""),
      }}
      bandeau={
        c.status === "annule" && (
          <BandeauEtat ton="arret" trait="plein" titre="Courrier annulé">
            {c.cancellation_reason}
          </BandeauEtat>
        )
      }
      note={
        <>
          Ce document est rendu à partir de l&apos;instantané figé à la remise : il
          ne changera plus, quelles que soient les modifications apportées ensuite
          au dossier.
        </>
      }
    >
        <header className="flex justify-between gap-8 mb-10">
          <div className="text-sm">
            {s.cabinet?.nom && (
              <p className="font-semibold text-slate-800">{s.cabinet.nom}</p>
            )}
            {s.praticien?.nom && <p>{s.praticien.nom}</p>}
            {s.praticien?.titre && <p className="text-slate-600">{s.praticien.titre}</p>}
            {e?.adresse && <p className="text-slate-600">{e.adresse}</p>}
            {(e?.code_postal || e?.ville) && (
              <p className="text-slate-600">
                {[e?.code_postal, e?.ville].filter(Boolean).join(" ")}
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

          {/* LE DESTINATAIRE EST NOMMÉ, en haut à droite, comme sur une lettre.
              C'est la propriété qui définit ce document. */}
          <div className="text-sm text-right">
            {d?.nom && <p className="font-medium text-slate-800">{d.nom}</p>}
            {d?.profession && <p className="text-slate-600">{d.profession}</p>}
            {d?.adresse && <p className="text-slate-600">{d.adresse}</p>}
            {(d?.code_postal || d?.ville) && (
              <p className="text-slate-600">
                {[d?.code_postal, d?.ville].filter(Boolean).join(" ")}
              </p>
            )}
          </div>
        </header>

        <p className="text-right text-sm text-slate-600 mb-8">
          {e?.ville ? `${e.ville}, le ` : "Le "}
          {frDate(s.emis_le ?? c.issued_on ?? "")}
        </p>

        {/* CE DOCUMENT NE SE NOMMAIT PAS.
            Des sept documents imprimables, c'était le seul dont le corps
            n'avait AUCUN titre : sa seule structure était « Objet : » en gras.
            Deux conséquences. Sur le papier, la page ne dit pas ce qu'elle
            est — elle arrive dans un dossier où elle côtoiera une attestation
            et un compte rendu. Et un lecteur d'écran qui parcourt les titres
            de cette page n'en trouvait aucun : 1.3.1 Information et relations,
            niveau A.

            Le titre porte la NATURE du document, constante ; l'objet, qui est
            la phrase de la praticienne, reste dessous et à sa place. */}
        <h1 className="text-base font-semibold text-slate-900 mb-4">
          Courrier de liaison
        </h1>

        <p className="mb-6">
          <span className="font-semibold">Objet : </span>
          {c.subject}
        </p>

        {/* LE PATIENT : nom et date de naissance. Un confrère doit pouvoir
            identifier la personne sans ambiguïté — deux homonymes existent.
            Rien d'autre du dossier n'entre ici : ce que ce courrier dit du
            patient, c'est ce que la praticienne a écrit. */}
        <p className="mb-8 text-slate-700">
          Concernant{" "}
          <span className="font-medium">{s.patient?.nom ?? "—"}</span>
          {s.patient?.ne_le && <>, né(e) le {frDate(s.patient.ne_le)}</>}.
        </p>

        <div className="whitespace-pre-wrap mb-12">{c.body}</div>

        <div className="flex justify-end">
          <div className="text-sm text-right">
            <p className="text-slate-500 mb-10">Signature</p>
            {s.praticien?.nom && <p className="font-medium">{s.praticien.nom}</p>}
            {s.praticien?.titre && <p className="text-slate-600">{s.praticien.titre}</p>}
          </div>
        </div>
    </CoqueDocument>
  );
}
