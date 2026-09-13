import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { frDate } from "@/lib/format";
import { formatAgeAt } from "@/lib/age";
import { OBJECTIF_STATUS_IMPRIME, type ObjectifFige } from "@/lib/syntheses/types";
import type { SyntheseAvecDestinataire } from "@/lib/syntheses/queries";
import { liste } from "@/lib/liste";

/**
 * La synthèse de suivi, telle qu'elle est remise.
 *
 * ELLE LIT L'INSTANTANÉ, PAS LES DONNÉES VIVANTES — et ici ce n'est pas une
 * précaution de forme. Les faits de cette page sont RECALCULABLES : une séance
 * ajoutée après coup, un objectif requalifié le mois suivant, et un document
 * déjà remis afficherait d'autres chiffres que ceux lus par son destinataire.
 * Tout vient donc de `snapshot`.
 *
 * Séparée de la route pour qu'elle puisse être rendue sur un jeu fictif sans
 * session ni base : c'est ce qui rend son apparence vérifiable.
 */
export default function DocumentSynthese({
  synthese: syn,
}: {
  synthese: SyntheseAvecDestinataire;
}) {
  /* UN BROUILLON NE S'IMPRIME PAS. Il n'a ni date de remise ni instantané : il
     sortirait de l'imprimante indiscernable d'une synthèse réellement remise. */
  if (syn.status === "brouillon" || !syn.snapshot) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <Link
          href={`/patients/${syn.patient_id}`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Retour au dossier
        </Link>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
          <h1 className="font-semibold text-slate-800">
            Cette synthèse est un brouillon
          </h1>
          <p className="text-sm text-slate-600 mt-2">
            Elle n&apos;a pas encore été remise : ses éléments ne sont pas figés
            et elle ne porte ni date, ni identité du signataire. Imprimée telle
            quelle, son destinataire la prendrait pour un document définitif.
            Remettez-la depuis le dossier, puis revenez ici.
          </p>
        </div>
      </div>
    );
  }

  const s = syn.snapshot;
  const e = s.entite_juridique;
  const d = s.destinataire;
  const f = s.faits;
  const objectifs = liste<ObjectifFige>(f?.objectifs);
  const identifiants = liste<{ type?: string; valeur?: string }>(s.identifiants).filter(
    (i) => i?.valeur,
  );
  const seances = f?.seances_honorees ?? 0;
  const absences = f?.absences ?? 0;
  const annulees = f?.annulees_par_le_cabinet ?? 0;
  const finDePeriode = s.periode?.au ?? syn.period_end;

  /* L'ÂGE SE LIT À LA FIN DE LA PÉRIODE, pas au jour de la remise. Sur un écrit
     d'évolution concernant un enfant, l'âge est le premier repère de lecture —
     et un écrit « janvier-juin » remis en septembre qui annonce l'âge de
     septembre décale tout ce qui suit. C'est la correction déjà payée sur les
     bilans (C-4) : `formatAgeAt` EXIGE une date de référence.
     Le calcul est déterministe à partir de l'instantané : deux valeurs figées
     donnent toujours le même résultat, il n'y a donc rien à figer de plus. */
  const age = s.patient?.ne_le ? formatAgeAt(s.patient.ne_le, finDePeriode) : null;

  return (
    <div className="py-8 px-4 print:p-0">
      <div className="max-w-3xl mx-auto mb-4 no-print">
        <Link
          href={`/patients/${syn.patient_id}`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Retour au dossier
        </Link>
      </div>

      <article className="print-area max-w-3xl mx-auto bg-white shadow-sm border border-slate-200 rounded-lg px-12 py-10 print:shadow-none print:border-0 text-[13px] leading-relaxed text-slate-800">
        {syn.status === "annule" && (
          <p className="mb-6 border-2 border-dashed border-arret-trait bg-arret-fond px-4 py-3 rounded-lg text-arret-encre print:bg-white">
            <span className="font-semibold uppercase tracking-wide text-xs">
              Synthèse annulée
            </span>
            {syn.cancellation_reason && (
              <span className="block text-xs mt-1">{syn.cancellation_reason}</span>
            )}
          </p>
        )}

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

          <div className="text-sm text-right">
            {d?.nom ? (
              <>
                <p className="font-medium text-slate-800">{d.nom}</p>
                {d.profession && <p className="text-slate-600">{d.profession}</p>}
                {d.adresse && <p className="text-slate-600">{d.adresse}</p>}
                {(d.code_postal || d.ville) && (
                  <p className="text-slate-600">
                    {[d.code_postal, d.ville].filter(Boolean).join(" ")}
                  </p>
                )}
              </>
            ) : (
              /* REMISE EN MAIN PROPRE. Le document le DIT, plutôt que de
                 laisser un blanc : dans un an, il faut pouvoir savoir à qui
                 cette synthèse a été donnée. */
              s.remise === "a_la_personne_suivie" && (
                <p className="text-slate-600">Remise à la personne suivie</p>
              )
            )}
          </div>
        </header>

        <p className="text-right text-sm text-slate-600 mb-8">
          {e?.ville ? `${e.ville}, le ` : "Le "}
          {frDate(s.emis_le ?? syn.issued_on ?? "")}
        </p>

        <h1 className="text-base font-semibold text-slate-900 mb-1">
          Synthèse de suivi en psychomotricité
        </h1>
        <p className="text-slate-600 mb-8">
          Période du {frDate(s.periode?.du ?? syn.period_start)} au{" "}
          {frDate(s.periode?.au ?? syn.period_end)}
        </p>

        <p className="mb-8 text-slate-700">
          Concernant <span className="font-medium">{s.patient?.nom ?? "—"}</span>
          {s.patient?.ne_le && <>, né(e) le {frDate(s.patient.ne_le)}</>}
          {age && <> — {age} au terme de la période</>}.
        </p>

        {/* ---------------------------------------------- le relevé, en faits */}
        <section className="mb-8">
          <h2 className="font-semibold text-slate-900 mb-2">Déroulé de la période</h2>
          {syn.means && <div className="whitespace-pre-wrap mb-2">{syn.means}</div>}
          <ul className="list-none p-0 m-0 space-y-1">
            {f?.parcours_ouvert_le && (
              <li>Prise en soin ouverte le {frDate(f.parcours_ouvert_le)}.</li>
            )}
            <li>
              {seances} séance{seances > 1 ? "s" : ""} honorée
              {seances > 1 ? "s" : ""} sur la période.
            </li>
            {/* LES RENDEZ-VOUS NON HONORÉS NE S'IMPRIMENT QUE SI ELLE L'A
                DEMANDÉ — ET LES DEUX CÔTÉS À LA FOIS. Imprimer les absences de
                la famille sans les séances que le cabinet a annulées donne le
                chiffre à sens unique qu'un financeur retiendra. */}
            {syn.detail_absences && (
              <>
                <li>
                  {absences} rendez-vous non honoré{absences > 1 ? "s" : ""} du
                  fait de la personne ou de sa famille.
                </li>
                <li>
                  {annulees} séance{annulees > 1 ? "s" : ""} annulée
                  {annulees > 1 ? "s" : ""} du fait du cabinet.
                </li>
              </>
            )}
          </ul>
          {/* LA MENTION VIENT DE L'INSTANTANÉ, pas du code : elle doit se relire
              telle qu'elle a été remise. */}
          {s.mentions?.comptes && (
            <p className="text-[11px] text-slate-500 mt-2 leading-snug">
              {s.mentions.comptes}
            </p>
          )}
        </section>

        {/* ------------------------------------- les objectifs, tels que posés */}
        {/* `detail_objectifs` décide en amont : quand elle les retire, la clé
            n'est même pas figée dans l'instantané. Ici, on n'a donc rien à
            filtrer — l'absence de la liste EST la décision. */}
        {objectifs.length > 0 && (
          <section className="mb-8">
            {/* LE TITRE DIT À QUELLE DATE CES ÉTATS ONT ÉTÉ RELEVÉS. Le statut
                d'un objectif est celui du jour de la remise — on ne sait pas
                reconstituer un statut passé, et laisser croire qu'il est celui
                de la fin de période serait une affirmation fausse. */}
            <h2 className="font-semibold text-slate-900 mb-2">
              Objectifs de la prise en soin, et leur état au{" "}
              {frDate(s.emis_le ?? syn.issued_on ?? "")}
            </h2>
            <ul className="list-none p-0 m-0 space-y-1">
              {objectifs.map((o, i) => (
                <li key={i}>
                  {o.intitule}
                  <span className="text-slate-600">
                    {" — "}
                    {OBJECTIF_STATUS_IMPRIME[o.statut ?? ""] ?? o.statut}
                    {o.revu_le && <>, revu le {frDate(o.revu_le)}</>}
                  </span>
                  {/* SES MOTS À ELLE, à côté du mot du logiciel. */}
                  {o.note_de_reevaluation && (
                    <span className="block text-slate-700 pl-4">
                      {o.note_de_reevaluation}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ------------------------------------------------- ce qu'elle écrit */}
        <section className="mb-8">
          <h2 className="font-semibold text-slate-900 mb-2">Ce que j&apos;observe</h2>
          <div className="whitespace-pre-wrap">{syn.observed_evolution}</div>
        </section>

        {syn.adjustments && (
          <section className="mb-8">
            <h2 className="font-semibold text-slate-900 mb-2">
              Ajustements pour la suite
            </h2>
            <div className="whitespace-pre-wrap">{syn.adjustments}</div>
          </section>
        )}

        {syn.next_step && (
          <section className="mb-8">
            <h2 className="font-semibold text-slate-900 mb-2">Suite proposée</h2>
            <div className="whitespace-pre-wrap">{syn.next_step}</div>
          </section>
        )}

        {syn.note && <p className="mb-8 text-slate-700">{syn.note}</p>}

        <div className="flex justify-end mt-12">
          <div className="text-sm text-right">
            <p className="text-slate-500 mb-10">Signature</p>
            {s.praticien?.nom && <p className="font-medium">{s.praticien.nom}</p>}
            {s.praticien?.titre && <p className="text-slate-600">{s.praticien.titre}</p>}
          </div>
        </div>

        {/* Une synthèse déborde facilement sur une seconde page : deux blocs de
            prose et une liste d'objectifs. Sans ce rappel, la page 2
            n'identifie ni le document, ni la personne, ni la période. */}
        <p className="hidden print:block text-xs text-slate-500 mt-6">
          Synthèse de suivi — {s.patient?.nom ?? "—"} — du{" "}
          {frDate(s.periode?.du ?? syn.period_start)} au{" "}
          {frDate(s.periode?.au ?? syn.period_end)}
        </p>
      </article>

      <p className="text-xs text-slate-500 mt-4 max-w-3xl mx-auto no-print">
        Ce document est rendu à partir de l&apos;instantané figé à la remise : il
        ne changera plus, quelles que soient les modifications apportées ensuite
        au dossier, à l&apos;agenda ou aux objectifs.
      </p>
    </div>
  );
}
