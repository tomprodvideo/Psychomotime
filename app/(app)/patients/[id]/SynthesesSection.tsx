"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Plus, Send, Printer, Ban } from "lucide-react";
import { Dialogue } from "@/components/Dialogue";
import { frDate } from "@/lib/format";
import {
  MENTION_COMPTE_SEANCES,
  OBJECTIF_STATUS_IMPRIME,
  SYNTHESE_STATUS_LABELS,
  periodeParDefaut,
  type FaitsPeriode,
} from "@/lib/syntheses/types";
import { messageConsentement, type EtatConsentement } from "@/lib/courriers/types";
import type { SyntheseAvecDestinataire } from "@/lib/syntheses/queries";
import {
  annulerSynthese,
  enregistrerSynthese,
  releverLesFaits,
  remettreSynthese,
  supprimerBrouillonSynthese,
} from "../../syntheses/actions";
import type { OptionDestinataire } from "./CourriersSection";

const CHAMP =
  "w-full rounded-lg border border-slate-500 px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

export interface OptionParcours {
  id: string;
  libelle: string;
}

/**
 * Les synthèses de suivi d'un dossier.
 *
 * CE QUE CET ÉCRAN DOIT FAIRE COMPRENDRE : la synthèse a deux moitiés, et
 * elles n'ont pas le même auteur.
 *
 *  · Les ÉLÉMENTS DE LA PÉRIODE sont relevés par la base et figés à la remise.
 *    Ils sont affichés à part, dans un cadre gris, pour qu'on voie d'un coup
 *    d'œil ce qui n'a pas été écrit à la main.
 *  · LE TEXTE est écrit par la praticienne. Sans lui, la base refuse de
 *    remettre : des comptes seuls font un relevé, pas un compte rendu.
 *
 * L'écran ne propose AUCUNE phrase toute faite. Pas de « progression », pas de
 * flèche, pas d'objectif requalifié parce qu'un chiffre a bougé.
 */
export default function SynthesesSection({
  patientId,
  syntheses,
  parcours,
  destinataires,
  consentement,
  erreur,
  canWrite,
}: {
  patientId: string;
  syntheses: SyntheseAvecDestinataire[];
  parcours: OptionParcours[];
  destinataires: OptionDestinataire[];
  consentement: EtatConsentement;
  erreur: string | null;
  canWrite: boolean;
}) {
  const [edite, setEdite] = useState<SyntheseAvecDestinataire | "nouveau" | null>(
    null,
  );

  return (
    <section className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-slate-800">Synthèses de suivi</h2>
        {canWrite && (
          <button
            type="button"
            onClick={() => setEdite("nouveau")}
            className="inline-flex items-center gap-1.5 text-sm text-brand-700 hover:text-brand-900"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Rédiger
          </button>
        )}
      </div>

      {/* LE PRODUIT DIT CE QU'IL SAIT, IL NE BLOQUE PAS — même doctrine que le
          courrier de liaison. Elle vaut A FORTIORI ici : une synthèse emporte
          les objectifs de la prise en soin, donc davantage qu'un courrier. */}
      <p
        className={`text-xs mt-2 rounded-lg px-3 py-2 ${
          consentement === "retire"
            ? "bg-rose-50 text-rose-800 ring-1 ring-rose-200"
            : "text-slate-500"
        }`}
      >
        {messageConsentement(consentement)}
      </p>

      {erreur && (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          {erreur}
        </p>
      )}

      {syntheses.length === 0 ? (
        <p className="text-sm text-slate-500 mt-3">
          Aucune synthèse. Une synthèse de suivi couvre une période : ce qui a
          été fait, où en sont les objectifs, ce que vous observez et ce que
          vous ajustez.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100 list-none p-0 m-0">
          {syntheses.map((s) => (
            <LigneSynthese
              key={s.id}
              synthese={s}
              patientId={patientId}
              canWrite={canWrite}
              onEdit={() => setEdite(s)}
            />
          ))}
        </ul>
      )}

      {edite && (
        <DialogueSynthese
          patientId={patientId}
          synthese={edite === "nouveau" ? null : edite}
          parcours={parcours}
          destinataires={destinataires}
          onClose={() => setEdite(null)}
        />
      )}
    </section>
  );
}

function LigneSynthese({
  synthese: s,
  patientId,
  canWrite,
  onEdit,
}: {
  synthese: SyntheseAvecDestinataire;
  patientId: string;
  canWrite: boolean;
  onEdit: () => void;
}) {
  const [pending, start] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [annulation, setAnnulation] = useState(false);

  const nom = s.recipient_is_patient
    ? "Remise à la personne suivie"
    : s.destinataire?.organisation_name?.trim() ||
      `${s.destinataire?.first_name ?? ""} ${s.destinataire?.last_name ?? ""}`.trim() ||
      "Destinataire";

  const agir = (
    action: (fd: FormData) => Promise<{ ok: boolean; error?: string }>,
    fd: FormData,
  ) => {
    setErreur(null);
    start(async () => {
      const res = await action(fd);
      if (!res.ok) setErreur(res.error ?? "L'action a échoué.");
      else setAnnulation(false);
    });
  };

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <p className="text-sm text-slate-800">
            Du {frDate(s.period_start)} au {frDate(s.period_end)}
            <span className="text-slate-500"> — {nom}</span>
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {/* L'état est ÉCRIT, pas seulement coloré. */}
            <span
              className={
                s.status === "emis"
                  ? "text-brand-700"
                  : s.status === "annule"
                    ? "text-rose-700"
                    : "text-amber-700"
              }
            >
              {SYNTHESE_STATUS_LABELS[s.status]}
            </span>
            {s.issued_on && ` le ${frDate(s.issued_on)}`}
            {s.snapshot?.faits &&
              ` · ${s.snapshot.faits.seances_honorees} séance${
                s.snapshot.faits.seances_honorees > 1 ? "s" : ""
              } honorée${s.snapshot.faits.seances_honorees > 1 ? "s" : ""}`}
            {s.cancellation_reason && ` · ${s.cancellation_reason}`}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {s.status !== "brouillon" && (
            <Link
              href={`/syntheses/${s.id}/document`}
              className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-brand-800"
            >
              <Printer className="h-3.5 w-3.5" aria-hidden="true" />
              Imprimer
            </Link>
          )}
          {canWrite && s.status === "brouillon" && (
            <>
              <button
                type="button"
                onClick={onEdit}
                className="text-xs text-brand-700 hover:underline"
              >
                Modifier
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  const fd = new FormData();
                  fd.set("id", s.id);
                  fd.set("patient_id", patientId);
                  agir(remettreSynthese, fd);
                }}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 border border-brand-200 rounded-lg px-2 py-1 hover:bg-brand-50 disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" aria-hidden="true" />
                Remettre
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  const fd = new FormData();
                  fd.set("id", s.id);
                  fd.set("patient_id", patientId);
                  agir(supprimerBrouillonSynthese, fd);
                }}
                className="text-xs text-slate-500 hover:text-rose-700 disabled:opacity-50"
              >
                Supprimer
              </button>
            </>
          )}
          {canWrite && s.status === "emis" && (
            <button
              type="button"
              onClick={() => setAnnulation(true)}
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-rose-700"
            >
              <Ban className="h-3.5 w-3.5" aria-hidden="true" />
              Annuler
            </button>
          )}
        </div>
      </div>

      {annulation && (
        <form
          className="mt-2 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            fd.set("id", s.id);
            fd.set("patient_id", patientId);
            agir(annulerSynthese, fd);
          }}
        >
          <div className="grow min-w-48">
            <label htmlFor={`motif-${s.id}`} className="block text-xs text-slate-600 mb-1">
              Pourquoi cette synthèse est-elle annulée ?
            </label>
            <input id={`motif-${s.id}`} name="reason" required className={CHAMP} />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="px-3 py-2 text-sm text-white bg-rose-700 hover:bg-rose-800 rounded-lg disabled:opacity-60"
          >
            Annuler la synthèse
          </button>
          <button
            type="button"
            onClick={() => setAnnulation(false)}
            className="px-2 py-2 text-sm text-slate-600"
          >
            Revenir
          </button>
        </form>
      )}

      {erreur && (
        <p role="alert" className="text-xs text-red-700 mt-1">
          {erreur}
        </p>
      )}
    </li>
  );
}

/**
 * Le relevé de la période.
 *
 * IL EST AFFICHÉ AVANT LE TEXTE, et dans un cadre qui le sépare nettement du
 * reste : c'est ce que la base a relevé, pas ce qu'elle a compris. Aucun de
 * ces nombres n'est commenté, comparé à un précédent ou assorti d'une flèche.
 */
function ReleveDeLaPeriode({
  faits,
  erreur,
  enCours,
  avecAbsences,
}: {
  faits: FaitsPeriode | null;
  erreur: string | null;
  enCours: boolean;
  avecAbsences: boolean;
}) {
  return (
    <div className="rounded-lg bg-slate-50 ring-1 ring-slate-200 px-4 py-3">
      <p className="text-xs font-medium text-slate-700">
        Relevé de la période — repris du dossier
      </p>
      <p className="text-xs text-slate-500 mt-0.5">
        Ces éléments sont lus dans l&apos;agenda et le parcours, et figés au
        moment de la remise. Le logiciel n&apos;en tire aucune conclusion.
      </p>

      {erreur ? (
        <p role="alert" className="text-sm text-red-700 mt-2">
          {erreur}
        </p>
      ) : !faits ? (
        <p className="text-sm text-slate-500 mt-2" aria-live="polite">
          {enCours ? "Relevé en cours…" : "Choisissez une période."}
        </p>
      ) : (
        <div className="mt-2 space-y-1.5" aria-live="polite">
          <p className="text-sm text-slate-800">
            {faits.seances_honorees} séance
            {faits.seances_honorees > 1 ? "s" : ""} honorée
            {faits.seances_honorees > 1 ? "s" : ""} sur la période
            {avecAbsences && (
              <span className="text-slate-600">
                {" · "}
                {faits.absences} rendez-vous non honoré
                {faits.absences > 1 ? "s" : ""}
                {" · "}
                {faits.annulees_par_le_cabinet} séance
                {faits.annulees_par_le_cabinet > 1 ? "s" : ""} annulée
                {faits.annulees_par_le_cabinet > 1 ? "s" : ""} par le cabinet
              </span>
            )}
          </p>

          {/* L'AVERTISSEMENT QUI EMPÊCHE UN ZÉRO DE MENTIR. Un parcours dont
              les rendez-vous ne portent pas ce parcours afficherait zéro sans
              rien dire. Il s'adresse à elle, avant la remise, et ne part pas
              avec le document. */}
          {faits.honorees_sans_parcours > 0 && (
            <p className="text-xs text-amber-800 bg-amber-50 ring-1 ring-amber-200 rounded px-2 py-1.5">
              {faits.honorees_sans_parcours} séance
              {faits.honorees_sans_parcours > 1 ? "s" : ""} honorée
              {faits.honorees_sans_parcours > 1 ? "s" : ""} de la période n
              {faits.honorees_sans_parcours > 1 ? "e sont" : "'est"} rattachée
              {faits.honorees_sans_parcours > 1 ? "s" : ""} à aucun parcours :
              {faits.honorees_sans_parcours > 1 ? " elles ne sont" : " elle n'est"}{" "}
              pas compt{faits.honorees_sans_parcours > 1 ? "ées" : "ée"} ci-dessus.
              Cette remarque ne figurera pas sur le document.
            </p>
          )}
          {faits.parcours_ouvert_le && (
            <p className="text-sm text-slate-600">
              Parcours ouvert le {frDate(faits.parcours_ouvert_le)}
            </p>
          )}

          {faits.objectifs.length > 0 ? (
            <ul className="text-sm text-slate-700 mt-1 space-y-0.5 list-none p-0">
              {faits.objectifs.map((o, i) => (
                <li key={i}>
                  {o.intitule}
                  {/* LE VOCABULAIRE DE L'IMPRESSION, pas celui de l'écran des
                      objectifs. Ce panneau est un aperçu de ce qui partira :
                      lui montrer « Abandonné » ici et imprimer « Non
                      poursuivi » là ferait découvrir la différence sur le
                      document déjà remis. */}
                  <span className="text-slate-500">
                    {" — "}
                    {OBJECTIF_STATUS_IMPRIME[o.statut ?? ""] ?? o.statut}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">
              Aucun objectif posé sur ce parcours.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function DialogueSynthese({
  patientId,
  synthese,
  parcours,
  destinataires,
  onClose,
}: {
  patientId: string;
  synthese: SyntheseAvecDestinataire | null;
  parcours: OptionParcours[];
  destinataires: OptionDestinataire[];
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  const defaut = periodeParDefaut();
  const [parcoursId, setParcoursId] = useState(
    synthese?.pathway_id ?? (parcours.length === 1 ? parcours[0].id : ""),
  );
  const [du, setDu] = useState(synthese?.period_start ?? defaut.du);
  const [au, setAu] = useState(synthese?.period_end ?? defaut.au);
  const [auPatient, setAuPatient] = useState(
    synthese ? synthese.recipient_is_patient : true,
  );
  const [avecAbsences, setAvecAbsences] = useState(
    synthese?.detail_absences ?? false,
  );

  /* LE RELEVÉ SUIT LA PÉRIODE. Il est refait à chaque changement de parcours
   * ou de borne, et il PORTE LA CLÉ pour laquelle il a été demandé : un relevé
   * revenu après un changement de période afficherait sinon un chiffre que la
   * remise ne figerait pas. Comparer la clé rendue à la clé courante dit aussi,
   * sans état supplémentaire, qu'un relevé est en cours. */
  const cle = `${parcoursId}|${du}|${au}`;
  const periodeValide = Boolean(du && au && au >= du);
  const [releve, setReleve] = useState<{
    cle: string;
    faits: FaitsPeriode | null;
    erreur: string | null;
  } | null>(null);

  useEffect(() => {
    if (!periodeValide) return;
    let annule = false;
    releverLesFaits(patientId, parcoursId || null, du, au).then((res) => {
      if (annule) return;
      setReleve(
        res.ok
          ? { cle, faits: res.value, erreur: null }
          : { cle, faits: null, erreur: res.error ?? "Relevé impossible." },
      );
    });
    return () => {
      annule = true;
    };
  }, [patientId, parcoursId, du, au, cle, periodeValide]);

  const aJour = releve?.cle === cle ? releve : null;

  const soumettre = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("patient_id", patientId);
    if (synthese) fd.set("id", synthese.id);
    setErreur(null);
    start(async () => {
      const res = await enregistrerSynthese(fd);
      if (!res.ok) {
        setErreur(res.error ?? "L'enregistrement a échoué.");
        return;
      }
      onClose();
    });
  };

  return (
    <Dialogue
      ouvert
      onFermer={onClose}
      taille="large"
      titre={synthese ? "Modifier la synthèse" : "Synthèse de suivi"}
      description="Les éléments de la période sont relevés dans le dossier. Ce qu'ils signifient, c'est vous qui l'écrivez."
    >
      <form onSubmit={soumettre} className="px-6 py-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <label htmlFor="pathway_id" className="block text-sm text-slate-700 mb-1">
              Parcours
            </label>
            <select
              id="pathway_id"
              name="pathway_id"
              value={parcoursId}
              onChange={(e) => setParcoursId(e.target.value)}
              className={CHAMP}
            >
              <option value="">Aucun parcours rattaché</option>
              {parcours.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.libelle}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">
              Sans parcours, la synthèse compte toutes les séances du dossier et
              ne reprend aucun objectif.
            </p>
          </div>

          <div>
            <label htmlFor="period_start" className="block text-sm text-slate-700 mb-1">
              Du
            </label>
            <input
              type="date"
              id="period_start"
              name="period_start"
              required
              value={du}
              onChange={(e) => setDu(e.target.value)}
              className={CHAMP}
            />
          </div>
          <div>
            <label htmlFor="period_end" className="block text-sm text-slate-700 mb-1">
              Au
            </label>
            <input
              type="date"
              id="period_end"
              name="period_end"
              required
              value={au}
              onChange={(e) => setAu(e.target.value)}
              className={CHAMP}
            />
          </div>
        </div>

        <ReleveDeLaPeriode
          faits={aJour?.faits ?? null}
          erreur={aJour?.erreur ?? null}
          enCours={periodeValide && !aJour}
          avecAbsences={avecAbsences}
        />

        {/* ------------------------------------------------- ce qu'elle écrit */}
        {/* LE CADRE VIENT AVANT L'OBSERVATION, et avant tout parce qu'il manquait :
            sans lui, ce qui a été FAIT était représenté par un nombre et ce qui
            est OBSERVÉ par de la prose. Ce déséquilibre est la cause de la
            lecture comptable, pas sa conséquence. */}
        <div>
          <label htmlFor="means" className="block text-sm text-slate-700 mb-1">
            Cadre et moyens mis en œuvre
          </label>
          <textarea
            id="means"
            name="means"
            rows={4}
            defaultValue={synthese?.means ?? ""}
            aria-describedby="aide-cadre"
            className={CHAMP}
          />
          <p id="aide-cadre" className="text-xs text-slate-500 mt-1">
            Rythme, durée, modalité, ce qui a été travaillé. Rien n&apos;est
            déduit des dates : un rythme calculé serait une interprétation.
          </p>
        </div>

        <div>
          <label htmlFor="observed_evolution" className="block text-sm text-slate-700 mb-1">
            Ce que vous observez sur la période
          </label>
          <textarea
            id="observed_evolution"
            name="observed_evolution"
            rows={7}
            defaultValue={synthese?.observed_evolution ?? ""}
            aria-describedby="aide-observation"
            className={CHAMP}
          />
          <p id="aide-observation" className="text-xs text-slate-500 mt-1">
            Sans ce texte, la synthèse ne peut pas être remise : les nombres
            ci-dessus ne parlent pas d&apos;eux-mêmes.
          </p>
        </div>

        <div>
          <label htmlFor="adjustments" className="block text-sm text-slate-700 mb-1">
            Ce que vous ajustez pour la suite
          </label>
          <textarea
            id="adjustments"
            name="adjustments"
            rows={5}
            defaultValue={synthese?.adjustments ?? ""}
            className={CHAMP}
          />
        </div>

        <div>
          <label htmlFor="next_step" className="block text-sm text-slate-700 mb-1">
            Suite proposée
          </label>
          <textarea
            id="next_step"
            name="next_step"
            rows={3}
            defaultValue={synthese?.next_step ?? ""}
            aria-describedby="aide-suite"
            className={CHAMP}
          />
          <p id="aide-suite" className="text-xs text-slate-500 mt-1">
            C&apos;est ce qu&apos;un prescripteur cherche en premier. Aucune
            liste de choix ici : le vocabulaire d&apos;une décision clinique ne
            se choisit pas dans un menu.
          </p>
        </div>

        {/* --------------------------------------------------- destinataire */}
        <fieldset className="border border-slate-200 rounded-lg px-4 py-3">
          <legend className="text-sm text-slate-700 px-1">
            À qui cette synthèse est-elle remise ?
          </legend>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="recipient_is_patient"
              checked={auPatient}
              onChange={(e) => setAuPatient(e.target.checked)}
              className="h-4 w-4"
            />
            À la personne suivie, ou à son entourage présent
          </label>

          <div className="mt-3">
            <label
              htmlFor="recipient_contact_id"
              className="block text-sm text-slate-700 mb-1"
            >
              Ou à un destinataire nommé
            </label>
            <select
              id="recipient_contact_id"
              name="recipient_contact_id"
              defaultValue={synthese?.recipient_contact_id ?? ""}
              className={CHAMP}
            >
              <option value="">Aucun</option>
              {(
                [
                  ["dossier", "Entourage du dossier"],
                  ["cabinet", "Autres contacts du cabinet"],
                ] as const
              ).map(([g, titre]) => {
                const options = destinataires.filter((d) => d.groupe === g);
                if (options.length === 0) return null;
                return (
                  <optgroup key={g} label={titre}>
                    {options.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.nom}
                        {d.role ? ` — ${d.role}` : ""}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          </div>
        </fieldset>

        {/* ------------------------------------------------------ assiduité */}
        <div>
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="detail_absences"
              checked={avecAbsences}
              onChange={(e) => setAvecAbsences(e.target.checked)}
              className="h-4 w-4 mt-0.5"
            />
            <span>
              Faire figurer les rendez-vous non honorés
              <span className="block text-xs text-slate-500">
                Utile à une structure qui suit un parcours contractualisé.
                Ailleurs, c&apos;est une information que le destinataire n&apos;a
                pas demandée. Les séances annulées par le cabinet figureront
                aussi : un chiffre à sens unique ne dit pas la même chose.
              </span>
            </span>
          </label>
        </div>

        <div>
          <label htmlFor="note" className="block text-sm text-slate-700 mb-1">
            Mention à faire figurer sur le document
          </label>
          <input
            id="note"
            name="note"
            defaultValue={synthese?.note ?? ""}
            className={CHAMP}
          />
        </div>

        <div>
          <label htmlFor="internal_note" className="block text-sm text-slate-700 mb-1">
            Note interne (jamais imprimée)
          </label>
          <input
            id="internal_note"
            name="internal_note"
            defaultValue={synthese?.internal_note ?? ""}
            className={CHAMP}
          />
        </div>

        <p className="text-xs text-slate-500">{MENTION_COMPTE_SEANCES}</p>

        {erreur && (
          <p role="alert" className="text-sm text-red-700">
            {erreur}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600">
            Annuler
          </button>
          <button
            type="submit"
            disabled={pending}
            className="px-5 py-2 text-sm text-white bg-brand-600 hover:bg-brand-700 rounded-lg disabled:opacity-60"
          >
            {pending ? "Enregistrement…" : "Enregistrer le brouillon"}
          </button>
        </div>
      </form>
    </Dialogue>
  );
}
