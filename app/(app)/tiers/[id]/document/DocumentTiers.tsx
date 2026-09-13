import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { frDate } from "@/lib/format";
import { USAGE_TITRES, type UsageTiers } from "@/lib/tiers/types";
import type { EcritTiersAvecDestinataire } from "@/lib/tiers/queries";
import { liste } from "@/lib/liste";

/**
 * L'écrit pour un tiers non soignant, tel qu'il est remis.
 *
 * IL LIT L'INSTANTANÉ. Et ici, la moitié de ce qui compte est dans ce qui
 * N'Y EST PAS : tout ce qu'elle n'a pas demandé à faire figurer a été retiré à
 * la remise, pas seulement masqué. Cette page n'a donc rien à filtrer —
 * l'absence d'une clé EST la décision.
 *
 * LA MENTION DE CADRE S'IMPRIME TOUJOURS. C'est elle qui empêche ce document
 * d'être lu comme une pièce officielle, dans un dossier où il en côtoiera.
 */
export default function DocumentTiers({
  ecrit,
}: {
  ecrit: EcritTiersAvecDestinataire;
}) {
  if (ecrit.status === "brouillon" || !ecrit.snapshot) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <Link
          href={`/patients/${ecrit.patient_id}`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Retour au dossier
        </Link>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
          <h1 className="font-semibold text-slate-800">Cet écrit est un brouillon</h1>
          <p className="text-sm text-slate-600 mt-2">
            Il n&apos;a pas encore été remis : ses éléments ne sont pas figés et
            il ne porte ni date, ni identité du signataire. Imprimé tel quel,
            son destinataire le prendrait pour un document définitif.
          </p>
        </div>
      </div>
    );
  }

  const s = ecrit.snapshot;
  const e = s.entite_juridique;
  const d = s.destinataire;
  const f = s.faits;
  const objectifs = liste<{ intitule?: string | null; statut?: string | null }>(
    f?.objectifs,
  );
  const identifiants = liste<{ type?: string; valeur?: string }>(s.identifiants).filter(
    (i) => i?.valeur,
  );
  const titre =
    USAGE_TITRES[(s.usage ?? ecrit.intended_use) as UsageTiers] ??
    "Écrit à l'attention d'un tiers";

  return (
    <div className="py-8 px-4 print:p-0">
      <div className="max-w-3xl mx-auto mb-4 no-print">
        <Link
          href={`/patients/${ecrit.patient_id}`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Retour au dossier
        </Link>
      </div>

      <article className="print-area max-w-3xl mx-auto bg-white shadow-sm border border-slate-200 rounded-lg px-12 py-10 print:shadow-none print:border-0 text-[13px] leading-relaxed text-slate-800">
        {ecrit.status === "annule" && (
          <p className="mb-6 border-2 border-dashed border-rose-600 bg-rose-50 px-4 py-3 rounded-lg text-rose-900 print:bg-white">
            <span className="font-semibold uppercase tracking-wide text-xs">
              Écrit annulé
            </span>
            {ecrit.cancellation_reason && (
              <span className="block text-xs mt-1">{ecrit.cancellation_reason}</span>
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
              s.mentions?.remise && (
                <p className="text-slate-600">{s.mentions.remise}</p>
              )
            )}
          </div>
        </header>

        <p className="text-right text-sm text-slate-600 mb-8">
          {e?.ville ? `${e.ville}, le ` : "Le "}
          {frDate(s.emis_le ?? ecrit.issued_on ?? "")}
        </p>

        <h1 className="text-base font-semibold text-slate-900 mb-6">{titre}</h1>

        {/* DE LA PERSONNE : nom et date de naissance. Rien d'autre — pas
            d'adresse, qui n'a aucune utilité pour ce lecteur et serait une
            donnée de plus circulant dans un dossier administratif. */}
        <p className="mb-8 text-slate-700">
          Concernant <span className="font-medium">{s.patient?.nom ?? "—"}</span>
          {s.patient?.ne_le && <>, né(e) le {frDate(s.patient.ne_le)}</>}.
        </p>

        {ecrit.context && (
          <section className="mb-8">
            <h2 className="font-semibold text-slate-900 mb-2">
              Contexte de la demande
            </h2>
            <div className="whitespace-pre-wrap">{ecrit.context}</div>
          </section>
        )}

        {/* LES CONDITIONS D'OBSERVATION VIENNENT AVANT CE QUI EST OBSERVÉ, et
            c'est délibéré : elles situent tout ce qui suit et empêchent de le
            lire comme un verdict. */}
        <section className="mb-8">
          <h2 className="font-semibold text-slate-900 mb-2">
            Cadre et conditions d&apos;observation
          </h2>
          {ecrit.observation_setting && (
            <div className="whitespace-pre-wrap mb-2">{ecrit.observation_setting}</div>
          )}
          <ul className="list-none p-0 m-0 space-y-1">
            {f?.premiere_seance_le && (
              <li>
                Suivi(e) au cabinet depuis le {frDate(f.premiere_seance_le)}
                {f?.derniere_seance_le && (
                  <>, dernière séance le {frDate(f.derniere_seance_le)}</>
                )}
                .
              </li>
            )}
            {ecrit.detail_seances && f?.seances_honorees !== undefined && (
              <li>{f.seances_honorees} séances honorées.</li>
            )}
            {ecrit.detail_prescripteur && f?.prescripteur?.nom && (
              <li>
                Adressé(e) par {f.prescripteur.nom}
                {f.prescripteur.profession && <>, {f.prescripteur.profession}</>}
                {f.prescripteur.prescrit_le && (
                  <> — prescription du {frDate(f.prescripteur.prescrit_le)}</>
                )}
                .
              </li>
            )}
            {ecrit.detail_professionnels && ecrit.professionnels && (
              <li>{ecrit.professionnels}</li>
            )}
          </ul>
          {s.mentions?.comptes && (
            <p className="text-[11px] text-slate-500 mt-2 leading-snug">
              {s.mentions.comptes}
            </p>
          )}
        </section>

        <section className="mb-8">
          <h2 className="font-semibold text-slate-900 mb-2">Ce que j&apos;observe</h2>
          <div className="whitespace-pre-wrap">{ecrit.observed}</div>
        </section>

        {ecrit.daily_impact && (
          <section className="mb-8">
            <h2 className="font-semibold text-slate-900 mb-2">
              Retentissement au quotidien
            </h2>
            <div className="whitespace-pre-wrap">{ecrit.daily_impact}</div>
          </section>
        )}

        {ecrit.what_helps && (
          <section className="mb-8">
            <h2 className="font-semibold text-slate-900 mb-2">
              Ce qui aide, tel que je l&apos;observe
            </h2>
            <div className="whitespace-pre-wrap">{ecrit.what_helps}</div>
          </section>
        )}

        {ecrit.proposals && (
          <section className="mb-8">
            {/* L'INTITULÉ DIT QUE C'EST UNE PROPOSITION. Écrire une décision à
                la place de qui décide est hors compétence — et se retourne :
                un dossier qui AFFIRME un droit est plus faible qu'un dossier
                qui ÉTABLIT un retentissement. */}
            <h2 className="font-semibold text-slate-900 mb-2">
              Ce que je propose, à la discrétion de qui décide
            </h2>
            <div className="whitespace-pre-wrap">{ecrit.proposals}</div>
          </section>
        )}

        {objectifs.length > 0 && (
          <section className="mb-8">
            <h2 className="font-semibold text-slate-900 mb-2">
              Objectifs de la prise en soin
            </h2>
            <ul className="list-none p-0 m-0 space-y-1">
              {objectifs.map((o, i) => (
                <li key={i}>{o.intitule}</li>
              ))}
            </ul>
          </section>
        )}

        {ecrit.detail_scores && s.mentions?.chiffres && (
          <p className="text-[11px] text-slate-500 mb-8 leading-snug">
            {s.mentions.chiffres}
          </p>
        )}

        {ecrit.note && <p className="mb-8 text-slate-700">{ecrit.note}</p>}

        {/* LA MENTION DE CADRE, TOUJOURS IMPRIMÉE. C'est elle qui empêche ce
            document d'être lu comme une pièce officielle. */}
        {s.mentions?.cadre && (
          <section className="mb-8 border-t border-slate-200 pt-4">
            <h2 className="font-semibold text-slate-900 mb-2">
              Portée de cet écrit
            </h2>
            <p className="text-slate-700">{s.mentions.cadre}</p>
            {ecrit.limits_note && (
              <p className="text-slate-700 mt-2 whitespace-pre-wrap">
                {ecrit.limits_note}
              </p>
            )}
            {s.mentions.remise && d?.nom && (
              <p className="text-slate-700 mt-2">{s.mentions.remise}</p>
            )}
          </section>
        )}

        <div className="flex justify-end mt-12">
          <div className="text-sm text-right">
            <p className="text-slate-500 mb-10">Signature</p>
            {s.praticien?.nom && <p className="font-medium">{s.praticien.nom}</p>}
            {s.praticien?.titre && <p className="text-slate-600">{s.praticien.titre}</p>}
          </div>
        </div>

        <p className="hidden print:block text-xs text-slate-500 mt-6">
          {titre} — {s.patient?.nom ?? "—"} —{" "}
          {frDate(s.emis_le ?? ecrit.issued_on ?? "")}
        </p>
      </article>

      <p className="text-xs text-slate-500 mt-4 max-w-3xl mx-auto no-print">
        Ce document est rendu à partir de l&apos;instantané figé à la remise.
        Tout ce que vous n&apos;avez pas demandé à faire figurer en a été
        RETIRÉ, pas seulement masqué : il ne conserve pas ce qu&apos;il n&apos;a
        pas dit.
      </p>
    </div>
  );
}
