import { frDate } from "@/lib/format";
import { formatAgeAt } from "@/lib/age";
import {
  FINANCEMENT_LABELS,
  OBJECTIF_STATUS_IMPRIME,
  type ObjectifFige,
} from "@/lib/fins/types";
import type { FinAvecDestinataire } from "@/lib/fins/queries";
import { liste } from "@/lib/liste";
import { BandeauEtat, CoqueDocument, RefusBrouillon } from "@/components/Imprimable";

/**
 * L'écrit de fin de prise en soin, tel qu'il est remis.
 *
 * IL LIT L'INSTANTANÉ, PAS LES DONNÉES VIVANTES. Un parcours peut être rouvert,
 * un objectif requalifié, une séance ajoutée : le document déjà remis doit
 * rester ce que son destinataire a lu. La base pose d'ailleurs la réciproque —
 * un parcours qui porte un écrit remis ne se rouvre plus.
 *
 * Séparé de la route pour pouvoir être rendu sur un jeu fictif, sans session
 * ni base : c'est ce qui rend son apparence vérifiable.
 */
export default function DocumentFin({ ecrit }: { ecrit: FinAvecDestinataire }) {
  /* UN BROUILLON NE S'IMPRIME PAS. Il n'a ni date de remise ni instantané : il
     sortirait de l'imprimante indiscernable d'un écrit réellement remis. */
  if (ecrit.status === "brouillon" || !ecrit.snapshot) {
    return (
      <RefusBrouillon
        retour={{ href: `/patients/${ecrit.patient_id}`, libelle: "Retour au dossier" }}
        titre="Cet écrit est un brouillon"
      >
            Il n&apos;a pas encore été remis : ses éléments ne sont pas figés et
            il ne porte ni date, ni identité du signataire. Imprimé tel quel, son
            destinataire le prendrait pour un document définitif. Remettez-le
            depuis le dossier, puis revenez ici.
      </RefusBrouillon>
    );
  }

  const s = ecrit.snapshot;
  const e = s.entite_juridique;
  const d = s.destinataire;
  const f = s.faits;
  const p = f?.parcours;
  const objectifs = liste<ObjectifFige>(f?.objectifs);
  const identifiants = liste<{ type?: string; valeur?: string }>(s.identifiants).filter(
    (i) => i?.valeur,
  );

  /* L'ÂGE SE LIT À LA FIN DE LA PRISE EN SOIN, pas au jour de la remise. Sur un
     écrit qui rend compte d'un épisode, l'âge du jour décalerait tout ce qui
     suit. `formatAgeAt` EXIGE une date de référence — c'est la correction C-4,
     déjà payée sur les bilans. */
  const finDeParcours = p?.clos_le ?? null;
  const age =
    s.patient?.ne_le && finDeParcours
      ? formatAgeAt(s.patient.ne_le, finDeParcours)
      : null;

  return (
    <CoqueDocument
      retour={{ href: `/patients/${ecrit.patient_id}`, libelle: "Retour au dossier" }}
      rappel={{
        nature: "Fin de prise en soin",
        personne: s.patient?.nom,
        date: p?.clos_le ? `close le ${frDate(p.clos_le)}` : null,
      }}
      bandeau={
        ecrit.status === "annule" && (
          <BandeauEtat ton="arret" trait="plein" titre="Écrit annulé">
            {ecrit.cancellation_reason}
          </BandeauEtat>
        )
      }
      note={
        <>
          Ce document est rendu à partir de l&apos;instantané figé à la remise : il
          ne changera plus, quelles que soient les modifications apportées ensuite
          au dossier, au parcours ou aux objectifs.
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
              /* À QUI IL A ÉTÉ REMIS, OU À PERSONNE — et le document le DIT.
                 « Versé au dossier, non remis » RÉPOND à la question, là où un
                 blanc la laisserait ouverte. */
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

        <h1 className="text-base font-semibold text-slate-900 mb-1">
          Fin de prise en soin en psychomotricité
        </h1>
        {(p?.ouvert_le || p?.clos_le) && (
          <p className="text-slate-600 mb-6">
            Prise en soin
            {p?.ouvert_le && <> ouverte le {frDate(p.ouvert_le)}</>}
            {p?.clos_le && <>, close le {frDate(p.clos_le)}</>}.
          </p>
        )}

        <p className="mb-8 text-slate-700">
          Concernant <span className="font-medium">{s.patient?.nom ?? "—"}</span>
          {s.patient?.ne_le && <>, né(e) le {frDate(s.patient.ne_le)}</>}
          {age && <> — {age} au terme de la prise en soin</>}.
        </p>

        {/* LA SEULE PHRASE QUE LE LOGICIEL ÉCRIT SUR CE DOCUMENT. Elle constate,
            elle n'explique pas. Ce qui s'est passé, c'est elle qui l'écrit. */}
        {s.mentions?.nature && (
          <p className="mb-8 text-slate-800">{s.mentions.nature}</p>
        )}

        {ecrit.context && (
          <section className="mb-8">
            <h2 className="font-semibold text-slate-900 mb-2">
              Contexte de la demande
            </h2>
            <div className="whitespace-pre-wrap">{ecrit.context}</div>
          </section>
        )}

        <section className="mb-8">
          <h2 className="font-semibold text-slate-900 mb-2">
            Déroulé de la prise en soin
          </h2>
          {ecrit.means && <div className="whitespace-pre-wrap mb-2">{ecrit.means}</div>}
          <ul className="list-none p-0 m-0 space-y-1">
            <li>
              {f?.seances_honorees ?? 0} séance
              {(f?.seances_honorees ?? 0) > 1 ? "s" : ""} honorée
              {(f?.seances_honorees ?? 0) > 1 ? "s" : ""}.
            </li>
            {f?.derniere_seance_le && (
              <li>Dernière séance le {frDate(f.derniere_seance_le)}.</li>
            )}
            {ecrit.detail_absences && (
              <>
                <li>
                  {f?.absences ?? 0} rendez-vous non honoré
                  {(f?.absences ?? 0) > 1 ? "s" : ""} du fait de la personne ou
                  de sa famille.
                </li>
                <li>
                  {f?.annulees_par_le_cabinet ?? 0} séance
                  {(f?.annulees_par_le_cabinet ?? 0) > 1 ? "s" : ""} annulée
                  {(f?.annulees_par_le_cabinet ?? 0) > 1 ? "s" : ""} du fait du
                  cabinet.
                </li>
              </>
            )}
            {f?.prescripteur?.nom && (
              <li>
                Adressé(e) par {f.prescripteur.nom}
                {f.prescripteur.profession && <>, {f.prescripteur.profession}</>}
                {f.prescripteur.prescrit_le && (
                  <> — prescription du {frDate(f.prescripteur.prescrit_le)}</>
                )}
                .
              </li>
            )}
            {ecrit.detail_financement && f?.financement && (
              <li>
                Cadre : {FINANCEMENT_LABELS[f.financement] ?? f.financement}.
              </li>
            )}
          </ul>
          {s.mentions?.comptes && (
            <p className="text-[11px] text-slate-500 mt-2 leading-snug">
              {s.mentions.comptes}
            </p>
          )}
        </section>

        {/* CE QU'ELLE OBSERVE VIENT AVANT LA GRILLE DES OBJECTIFS, et c'est
            délibéré : le lecteur doit rencontrer son texte avant la liste de
            statuts, faute de quoi la grille devient le titre du document. */}
        <section className="mb-8">
          <h2 className="font-semibold text-slate-900 mb-2">
            Ce que j&apos;observe au terme de la prise en soin
          </h2>
          <div className="whitespace-pre-wrap">{ecrit.observed}</div>
        </section>

        {objectifs.length > 0 && (
          <section className="mb-8">
            <h2 className="font-semibold text-slate-900 mb-2">
              Objectifs de la prise en soin, et leur état au{" "}
              {frDate(s.emis_le ?? ecrit.issued_on ?? "")}
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

        {ecrit.closure_reason && (
          <section className="mb-8">
            <h2 className="font-semibold text-slate-900 mb-2">
              Ce qui met fin à la prise en soin
            </h2>
            <div className="whitespace-pre-wrap">{ecrit.closure_reason}</div>
          </section>
        )}

        {ecrit.remains_open && (
          <section className="mb-8">
            <h2 className="font-semibold text-slate-900 mb-2">Ce qui reste ouvert</h2>
            <div className="whitespace-pre-wrap">{ecrit.remains_open}</div>
          </section>
        )}

        {ecrit.handover && (
          <section className="mb-8">
            <h2 className="font-semibold text-slate-900 mb-2">Relais et suite</h2>
            <div className="whitespace-pre-wrap">{ecrit.handover}</div>
          </section>
        )}

        {ecrit.resumption && (
          <section className="mb-8">
            <h2 className="font-semibold text-slate-900 mb-2">
              Si la prise en soin devait reprendre
            </h2>
            <div className="whitespace-pre-wrap">{ecrit.resumption}</div>
          </section>
        )}

        {ecrit.note && <p className="mb-8 text-slate-700">{ecrit.note}</p>}

        <div className="flex justify-end mt-12">
          <div className="text-sm text-right">
            <p className="text-slate-500 mb-10">Signature</p>
            {s.praticien?.nom && <p className="font-medium">{s.praticien.nom}</p>}
            {s.praticien?.titre && <p className="text-slate-600">{s.praticien.titre}</p>}
          </div>
        </div>

        {/* Cet écrit déborde facilement : sept rubriques de prose. Sans ce
            rappel, la page 2 n'identifie ni le document ni la personne. */}
    </CoqueDocument>
  );
}
