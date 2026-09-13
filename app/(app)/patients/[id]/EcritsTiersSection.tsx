"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Plus, Send, Printer, Ban, CornerDownLeft } from "lucide-react";
import { Dialogue } from "@/components/Dialogue";
import { CHAMP } from "@/components/Champ";
import { Avertissement, SectionDossier } from "@/components/SectionDossier";
import { frDate } from "@/lib/format";
import {
  MODE_REMISE_TIERS_AIDES,
  MODE_REMISE_TIERS_LABELS,
  TIERS_STATUS_LABELS,
  TIERS_STATUS_TONS,
  USAGE_AIDES,
  USAGE_LABELS,
  messageAccordTiers,
  type FaitsTiers,
  type ModeRemiseTiers,
  type UsageTiers,
} from "@/lib/tiers/types";
import type { EcritTiersAvecDestinataire } from "@/lib/tiers/queries";
import {
  annulerEcritTiers,
  enregistrerEcritTiers,
  releverPourTiers,
  remettreEcritTiers,
  supprimerBrouillonTiers,
} from "../../tiers/actions";
import type { OptionDestinataire } from "./CourriersSection";
import type { OptionParcours } from "./SynthesesSection";
import { Statut } from "@/components/Statut";

/**
 * Les écrits destinés à un tiers non soignant.
 *
 * CE QUE CET ÉCRAN DOIT FAIRE COMPRENDRE, et qui le distingue des trois autres :
 *
 *  · L'ACCORD DE PARTAGE DÉCIDE ICI. Sur le courrier, la synthèse et l'écrit
 *    de fin, le produit le DIT sans l'exiger — parce que l'échange au sein
 *    d'une équipe de soins est présumé autorisé. Une école n'en est pas une.
 *    L'écran montre l'état AVANT qu'elle écrive : un refus au moment de
 *    remettre, sur un écrit déjà rédigé, arrive trop tard.
 *
 *  · TOUT EST FAUX PAR DÉFAUT. Un résultat chiffré lu par un enseignant, des
 *    objectifs dans un dossier administratif, le nom du médecin qui a
 *    adressé : chacun est une divulgation que le destinataire n'a pas demandée
 *    et que la personne n'a pas choisie.
 *
 *  · DESTINATAIRE N'EST PAS DESTINATION. « Remis à la personne, qui
 *    transmettra » n'a aucun destinataire nommé, et le document le dit.
 */
export default function EcritsTiersSection({
  patientId,
  patientNom,
  patientNeLe,
  ecrits,
  parcours,
  destinataires,
  erreur,
  canWrite,
}: {
  patientId: string;
  patientNom: string;
  patientNeLe: string | null;
  ecrits: EcritTiersAvecDestinataire[];
  parcours: OptionParcours[];
  destinataires: OptionDestinataire[];
  erreur: string | null;
  canWrite: boolean;
}) {
  const [edite, setEdite] = useState<EcritTiersAvecDestinataire | "nouveau" | null>(
    null,
  );

  return (
    <SectionDossier
      id="ecrits-tiers"
      titre="Écrits pour l'école ou un organisme"
      erreur={erreur}
      action={
        canWrite && (
          <button
            type="button"
            onClick={() => setEdite("nouveau")}
            className="inline-flex items-center gap-1.5 text-sm text-brand-700 hover:text-brand-900"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Rédiger
          </button>
        )
      }
    >
      {ecrits.length === 0 ? (
        <p className="text-sm text-slate-500 mt-3">
          Aucun écrit. Celui-ci part chez quelqu&apos;un qui n&apos;est pas un
          professionnel de santé.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100 list-none p-0 m-0">
          {ecrits.map((e) => (
            <LigneTiers
              key={e.id}
              ecrit={e}
              patientId={patientId}
              canWrite={canWrite}
              onEdit={() => setEdite(e)}
            />
          ))}
        </ul>
      )}

      {edite && (
        <DialogueTiers
          patientId={patientId}
          patientNom={patientNom}
          patientNeLe={patientNeLe}
          ecrit={edite === "nouveau" ? null : edite}
          parcours={parcours}
          destinataires={destinataires}
          onClose={() => setEdite(null)}
        />
      )}
    </SectionDossier>
  );
}

function LigneTiers({
  ecrit: e,
  patientId,
  canWrite,
  onEdit,
}: {
  ecrit: EcritTiersAvecDestinataire;
  patientId: string;
  canWrite: boolean;
  onEdit: () => void;
}) {
  const [pending, start] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [annulation, setAnnulation] = useState(false);

  const nom =
    e.delivery_mode === "destinataire"
      ? e.destinataire?.organisation_name?.trim() ||
        `${e.destinataire?.first_name ?? ""} ${e.destinataire?.last_name ?? ""}`.trim() ||
        "Destinataire"
      : MODE_REMISE_TIERS_LABELS[e.delivery_mode];

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
            {USAGE_LABELS[e.intended_use]}
            <span className="text-slate-500"> — {nom}</span>
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            <Statut
              ton={TIERS_STATUS_TONS[e.status]}
              libelle={TIERS_STATUS_LABELS[e.status]}
            />
            {e.issued_on && ` le ${frDate(e.issued_on)}`}
            {/* CE QUI DISTINGUE UNE REMISE SANS ACCORD, jusque dans la liste :
                c'est ce qu'on cherchera en premier si la question se pose. */}
            {e.status === "emis" &&
              e.snapshot?.consentement_partage !== "accorde" &&
              " · remis sans accord enregistré"}
            {e.cancellation_reason && ` · ${e.cancellation_reason}`}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {e.status !== "brouillon" && (
            <Link
              href={`/tiers/${e.id}/document`}
              className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-brand-800"
            >
              <Printer className="h-3.5 w-3.5" aria-hidden="true" />
              Imprimer
            </Link>
          )}
          {canWrite && e.status === "brouillon" && (
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
                  fd.set("id", e.id);
                  fd.set("patient_id", patientId);
                  agir(remettreEcritTiers, fd);
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
                  fd.set("id", e.id);
                  fd.set("patient_id", patientId);
                  agir(supprimerBrouillonTiers, fd);
                }}
                className="text-xs text-slate-500 hover:text-rose-700 disabled:opacity-50"
              >
                Supprimer
              </button>
            </>
          )}
          {canWrite && e.status === "emis" && (
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
          onSubmit={(ev) => {
            ev.preventDefault();
            const fd = new FormData(ev.currentTarget);
            fd.set("id", e.id);
            fd.set("patient_id", patientId);
            agir(annulerEcritTiers, fd);
          }}
        >
          <div className="grow min-w-48">
            <label htmlFor={`motif-tiers-${e.id}`} className="block text-xs text-slate-600 mb-1">
              Pourquoi cet écrit est-il annulé ?
            </label>
            <input id={`motif-tiers-${e.id}`} name="reason" required className={CHAMP} />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="px-3 py-2 text-sm text-white bg-rose-700 hover:bg-rose-800 rounded-lg disabled:opacity-60"
          >
            Annuler l&apos;écrit
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

function DialogueTiers({
  patientId,
  patientNom,
  patientNeLe,
  ecrit,
  parcours,
  destinataires,
  onClose,
}: {
  patientId: string;
  patientNom: string;
  patientNeLe: string | null;
  ecrit: EcritTiersAvecDestinataire | null;
  parcours: OptionParcours[];
  destinataires: OptionDestinataire[];
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  const [parcoursId, setParcoursId] = useState(
    ecrit?.pathway_id ?? (parcours.length === 1 ? parcours[0].id : ""),
  );
  const [usage, setUsage] = useState<UsageTiers>(ecrit?.intended_use ?? "ecole");
  const [mode, setMode] = useState<ModeRemiseTiers>(
    ecrit?.delivery_mode ?? "personne_suivie",
  );
  const [contexte, setContexte] = useState(ecrit?.context ?? "");
  const [nommerPros, setNommerPros] = useState(ecrit?.detail_professionnels ?? false);
  const [avecChiffres, setAvecChiffres] = useState(ecrit?.detail_scores ?? false);
  const [avecObjectifs, setAvecObjectifs] = useState(ecrit?.detail_objectifs ?? false);
  const [avecSeances, setAvecSeances] = useState(ecrit?.detail_seances ?? false);
  const [avecPrescripteur, setAvecPrescripteur] = useState(
    ecrit?.detail_prescripteur ?? false,
  );

  const cle = parcoursId || "aucun";
  const [releve, setReleve] = useState<{
    cle: string;
    faits: FaitsTiers | null;
    erreur: string | null;
  } | null>(null);

  useEffect(() => {
    let annule = false;
    releverPourTiers(patientId, parcoursId || null).then((res) => {
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
  }, [patientId, parcoursId, cle]);

  const aJour = releve?.cle === cle ? releve : null;
  const faits = aJour?.faits ?? null;
  const accord = faits ? messageAccordTiers(faits.accord_partage) : null;

  const soumettre = (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    fd.set("patient_id", patientId);
    if (ecrit) fd.set("id", ecrit.id);
    setErreur(null);
    start(async () => {
      const res = await enregistrerEcritTiers(fd);
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
      titre={ecrit ? "Modifier l'écrit" : "Écrit pour l'école ou un organisme"}
      description={`${patientNom}${patientNeLe ? ` · né(e) le ${frDate(patientNeLe)}` : ""}`}
    >
      <form onSubmit={soumettre} className="px-6 py-5 space-y-4">
        {/* L'ACCORD EN PREMIER : c'est lui qui décide si cet écrit pourra
            partir, et le savoir après avoir tout rédigé ne sert à rien. */}
        {accord && (
          <p
            className={`text-sm rounded-lg px-3 py-2 ${
              accord.ton === "bloquer"
                ? "bg-rose-50 text-rose-900 ring-1 ring-rose-300"
                : accord.ton === "avertir"
                  ? "bg-amber-50 text-amber-900 ring-1 ring-amber-200"
                  : "bg-slate-50 text-slate-600 ring-1 ring-slate-200"
            }`}
          >
            {accord.texte}
          </p>
        )}

        <fieldset className="border border-slate-200 rounded-lg px-4 py-3">
          <legend className="text-sm text-slate-700 px-1">
            À quel usage cet écrit est-il destiné ?
          </legend>
          <div className="space-y-2 mt-1">
            {(Object.keys(USAGE_LABELS) as UsageTiers[]).map((u) => (
              <label key={u} className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="intended_use"
                  value={u}
                  checked={usage === u}
                  onChange={() => setUsage(u)}
                  className="h-4 w-4 mt-0.5"
                />
                <span>
                  {USAGE_LABELS[u]}
                  <span className="block text-xs text-slate-500">{USAGE_AIDES[u]}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="tiers_pathway" className="block text-sm text-slate-700 mb-1">
            Prise en soin concernée
          </label>
          <select
            id="tiers_pathway"
            name="pathway_id"
            value={parcoursId}
            onChange={(ev) => setParcoursId(ev.target.value)}
            className={CHAMP}
          >
            <option value="">Aucun parcours rattaché</option>
            {parcours.map((p) => (
              <option key={p.id} value={p.id}>
                {p.libelle}
              </option>
            ))}
          </select>
        </div>

        {faits && faits.honorees_hors_parcours > 0 && (
          <Avertissement compact>
            Le dossier porte {faits.honorees_hors_parcours} séance
            {faits.honorees_hors_parcours > 1 ? "s" : ""} honorée
            {faits.honorees_hors_parcours > 1 ? "s" : ""} hors du parcours
            retenu. Les bornes ci-dessous ne couvrent donc pas tout le suivi.
          </Avertissement>
        )}

        {faits?.premiere_seance_le && (
          <p className="text-xs text-slate-500">
            Repris du dossier, et figé à la remise : suivi(e) depuis le{" "}
            {frDate(faits.premiere_seance_le)}
            {faits.derniere_seance_le && (
              <>, dernière séance le {frDate(faits.derniere_seance_le)}</>
            )}
            .
          </p>
        )}

        {/* ------------------------------------------------- ce qu'elle écrit */}
        <div className="space-y-2">
          <label htmlFor="tiers_context" className="block text-sm text-slate-700">
            Contexte de la demande
          </label>
          {faits?.motif_demande_a_reprendre && (
            <div className="rounded-lg bg-slate-50 ring-1 ring-slate-200 px-3 py-2">
              <p className="text-xs font-medium text-slate-700">
                Motif noté à l&apos;ouverture du parcours
              </p>
              <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">
                {faits.motif_demande_a_reprendre}
              </p>
              <button
                type="button"
                onClick={() => setContexte(faits.motif_demande_a_reprendre ?? "")}
                className="mt-1.5 inline-flex items-center gap-1 text-xs text-brand-700 hover:text-brand-900"
              >
                <CornerDownLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Reprendre ce texte
              </button>
              <p className="text-xs text-slate-500 mt-1">
                C&apos;est la parole du demandeur, parfois celle d&apos;un tiers.
                Elle ne part jamais telle quelle : ce qui s&apos;imprime est ce
                que vous écrivez ci-dessous.
              </p>
            </div>
          )}
          <textarea
            id="tiers_context"
            name="context"
            rows={3}
            value={contexte}
            onChange={(ev) => setContexte(ev.target.value)}
            className={CHAMP}
          />
        </div>

        <div>
          <label
            htmlFor="tiers_setting"
            className="block text-sm text-slate-700 mb-1"
          >
            Conditions d&apos;observation
          </label>
          <textarea
            id="tiers_setting"
            name="observation_setting"
            rows={3}
            defaultValue={ecrit?.observation_setting ?? ""}
            aria-describedby="aide-tiers-setting"
            className={CHAMP}
          />
          <p id="aide-tiers-setting" className="text-xs text-slate-500 mt-1">
            Où, quand, sur combien de temps. C&apos;est ce qui situe tout ce qui
            suit et empêche de le lire comme un verdict.
          </p>
        </div>

        <div>
          <label htmlFor="tiers_observed" className="block text-sm text-slate-700 mb-1">
            Ce que vous observez
          </label>
          <textarea
            id="tiers_observed"
            name="observed"
            rows={7}
            defaultValue={ecrit?.observed ?? ""}
            aria-describedby="aide-tiers-observed"
            className={CHAMP}
          />
          <p id="aide-tiers-observed" className="text-xs text-slate-500 mt-1">
            Le lecteur n&apos;a pas le cadre pour lire une hypothèse ou un terme
            clinique, et ce document circulera. « Dans un texte copié au
            tableau, la tenue du crayon se crispe au bout de trois lignes » se
            lit par tout le monde et ne qualifie personne.
          </p>
        </div>

        <div>
          <label htmlFor="tiers_impact" className="block text-sm text-slate-700 mb-1">
            Retentissement au quotidien
          </label>
          <textarea
            id="tiers_impact"
            name="daily_impact"
            rows={4}
            defaultValue={ecrit?.daily_impact ?? ""}
            className={CHAMP}
          />
        </div>

        <div>
          <label htmlFor="tiers_helps" className="block text-sm text-slate-700 mb-1">
            Ce qui aide, tel que vous l&apos;observez
          </label>
          <textarea
            id="tiers_helps"
            name="what_helps"
            rows={3}
            defaultValue={ecrit?.what_helps ?? ""}
            aria-describedby="aide-tiers-helps"
            className={CHAMP}
          />
          <p id="aide-tiers-helps" className="text-xs text-slate-500 mt-1">
            Des observations, pas des consignes : une psychomotricienne ne
            prescrit pas une pédagogie.
          </p>
        </div>

        <div>
          <label htmlFor="tiers_proposals" className="block text-sm text-slate-700 mb-1">
            Ce que vous proposez
          </label>
          <textarea
            id="tiers_proposals"
            name="proposals"
            rows={3}
            defaultValue={ecrit?.proposals ?? ""}
            aria-describedby="aide-tiers-proposals"
            className={CHAMP}
          />
          <p id="aide-tiers-proposals" className="text-xs text-slate-500 mt-1">
            Imprimé comme une proposition, à la discrétion de qui décide. Un
            dossier qui AFFIRME un droit est plus faible qu&apos;un dossier qui
            ÉTABLIT un retentissement.
          </p>
        </div>

        {/* ----------------------------------------------------- la remise */}
        <fieldset className="border border-slate-200 rounded-lg px-4 py-3">
          <legend className="text-sm text-slate-700 px-1">
            Comment cet écrit est-il remis ?
          </legend>
          <div className="space-y-2 mt-1">
            {(Object.keys(MODE_REMISE_TIERS_LABELS) as ModeRemiseTiers[]).map((m) => (
              <label key={m} className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="delivery_mode"
                  value={m}
                  checked={mode === m}
                  onChange={() => setMode(m)}
                  className="h-4 w-4 mt-0.5"
                />
                <span>
                  {MODE_REMISE_TIERS_LABELS[m]}
                  <span className="block text-xs text-slate-500">
                    {MODE_REMISE_TIERS_AIDES[m]}
                  </span>
                </span>
              </label>
            ))}
          </div>

          {mode === "destinataire" && (
            <div className="mt-3">
              <label
                htmlFor="tiers_recipient"
                className="block text-sm text-slate-700 mb-1"
              >
                Destinataire
              </label>
              <select
                id="tiers_recipient"
                name="recipient_contact_id"
                required
                defaultValue={ecrit?.recipient_contact_id ?? ""}
                className={CHAMP}
              >
                <option value="">Choisir…</option>
                {(
                  [
                    ["dossier", "Entourage du dossier"],
                    ["cabinet", "Autres contacts du cabinet"],
                  ] as const
                ).map(([g, titre]) => {
                  const options = destinataires.filter((x) => x.groupe === g);
                  if (options.length === 0) return null;
                  return (
                    <optgroup key={g} label={titre}>
                      {options.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.nom}
                          {x.role ? ` — ${x.role}` : ""}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            </div>
          )}
        </fieldset>

        {/* ---------------------------------------- ce qui s'ajoute, ou non */}
        <fieldset className="border border-slate-200 rounded-lg px-4 py-3 space-y-2">
          <legend className="text-sm text-slate-700 px-1">
            Ce que vous ajoutez — rien n&apos;y figure par défaut
          </legend>
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="detail_scores"
              checked={avecChiffres}
              onChange={(ev) => setAvecChiffres(ev.target.checked)}
              className="h-4 w-4 mt-0.5"
            />
            <span>
              Faire figurer des résultats chiffrés
              <span className="block text-xs text-slate-500">
                Un enseignant n&apos;a pas de quoi lire un écart-type, et un
                dossier le lira comme une mesure de la personne. Une mention
                s&apos;imprimera pour rappeler que c&apos;est une performance à
                une date donnée.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="detail_objectifs"
              checked={avecObjectifs}
              onChange={(ev) => setAvecObjectifs(ev.target.checked)}
              className="h-4 w-4 mt-0.5"
            />
            <span>
              Faire figurer les objectifs de la prise en soin
              <span className="block text-xs text-slate-500">
                Écrits en termes cliniques, pour un lecteur clinique.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="detail_seances"
              checked={avecSeances}
              onChange={(ev) => setAvecSeances(ev.target.checked)}
              className="h-4 w-4 mt-0.5"
            />
            <span>Faire figurer le nombre de séances honorées</span>
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="detail_prescripteur"
              checked={avecPrescripteur}
              onChange={(ev) => setAvecPrescripteur(ev.target.checked)}
              className="h-4 w-4 mt-0.5"
            />
            <span>
              Nommer le médecin qui a adressé
              <span className="block text-xs text-slate-500">
                Le nommer révèle à l&apos;école quel médecin la famille consulte.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="detail_professionnels"
              checked={nommerPros}
              onChange={(ev) => setNommerPros(ev.target.checked)}
              className="h-4 w-4 mt-0.5"
            />
            <span>
              Nommer les autres professionnels qui interviennent
              <span className="block text-xs text-slate-500">
                Lister le circuit de soins d&apos;un enfant dans un dossier est
                la divulgation la plus large que cet écrit puisse faire. Saisi à
                la main : le produit ne le déduit jamais du dossier.
              </span>
            </span>
          </label>
          {nommerPros && (
            <textarea
              name="professionnels"
              rows={2}
              defaultValue={ecrit?.professionnels ?? ""}
              placeholder="Ceux que vous choisissez de nommer, et eux seuls."
              className={CHAMP}
            />
          )}
        </fieldset>

        {/* ----------------------------------------- la dérogation, si besoin */}
        {faits?.accord_partage === "absent" && (
          <div>
            <label
              htmlFor="tiers_override"
              className="block text-sm text-slate-700 mb-1"
            >
              Pourquoi remettre cet écrit sans accord enregistré ?
            </label>
            <textarea
              id="tiers_override"
              name="consent_override_reason"
              rows={2}
              defaultValue={ecrit?.consent_override_reason ?? ""}
              aria-describedby="aide-tiers-override"
              className={CHAMP}
            />
            <p id="aide-tiers-override" className="text-xs text-slate-500 mt-1">
              Ce motif reste au cabinet et ne s&apos;imprime jamais. Il est figé
              avec l&apos;écrit, et la remise apparaîtra dans le journal comme
              une remise sans accord.
            </p>
          </div>
        )}

        <div>
          <label htmlFor="tiers_limits" className="block text-sm text-slate-700 mb-1">
            Une limite à ajouter au cadrage
          </label>
          <input
            id="tiers_limits"
            name="limits_note"
            defaultValue={ecrit?.limits_note ?? ""}
            aria-describedby="aide-tiers-limits"
            className={CHAMP}
          />
          <p id="aide-tiers-limits" className="text-xs text-slate-500 mt-1">
            Une mention rappelant que cet écrit n&apos;est pas une pièce
            officielle, ne comporte aucun diagnostic et ne préjuge d&apos;aucune
            décision s&apos;imprime déjà. Celle-ci s&apos;y ajoute.
          </p>
        </div>

        <div>
          <label htmlFor="tiers_note" className="block text-sm text-slate-700 mb-1">
            Mention à faire figurer
          </label>
          <input
            id="tiers_note"
            name="note"
            defaultValue={ecrit?.note ?? ""}
            className={CHAMP}
          />
        </div>

        <div>
          <label htmlFor="tiers_internal" className="block text-sm text-slate-700 mb-1">
            Note interne (jamais imprimée)
          </label>
          <input
            id="tiers_internal"
            name="internal_note"
            defaultValue={ecrit?.internal_note ?? ""}
            className={CHAMP}
          />
        </div>

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
