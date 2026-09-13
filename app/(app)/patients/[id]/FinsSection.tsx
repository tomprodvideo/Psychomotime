"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Plus, Send, Printer, Ban, CornerDownLeft } from "lucide-react";
import { Dialogue } from "@/components/Dialogue";
import { CHAMP } from "@/components/Champ";
import { Avertissement, SectionDossier } from "@/components/SectionDossier";
import { frDate } from "@/lib/format";
import {
  FIN_NATURE_AIDES,
  FIN_NATURE_LABELS,
  FIN_STATUS_LABELS,
  FIN_STATUS_TONS,
  MODE_REMISE_LABELS,
  OBJECTIF_STATUS_IMPRIME,
  type FaitsEpisode,
  type FinNature,
  type ModeRemise,
} from "@/lib/fins/types";
import { messageConsentement, type EtatConsentement } from "@/lib/courriers/types";
import type { FinAvecDestinataire } from "@/lib/fins/queries";
import {
  annulerFin,
  enregistrerFin,
  releverLEpisode,
  remettreFin,
  supprimerBrouillonFin,
} from "../../fins/actions";
import type { OptionDestinataire } from "./CourriersSection";
import { Statut } from "@/components/Statut";


export interface OptionParcoursFin {
  id: string;
  libelle: string;
  clos: boolean;
}

/**
 * Les écrits de fin de prise en soin d'un dossier.
 *
 * CE QUE CET ÉCRAN DOIT FAIRE COMPRENDRE :
 *
 *  · LE PARCOURS SE CLÔT D'ABORD. Le brouillon s'écrit sur un parcours encore
 *    ouvert — on prépare l'écrit avant la dernière séance — mais la remise
 *    exige un parcours clos. L'écran le dit AVANT le refus de la base.
 *
 *  · LES QUATRE NATURES DE FIN N'ACCUSENT PERSONNE, et chacune porte son aide.
 *    « Sans nouvelle » est là pour ne PAS ranger sous « à la demande » ce que
 *    personne n'a peut-être décidé.
 *
 *  · TROIS AVERTISSEMENTS s'affichent et ne partent jamais avec le document :
 *    les séances du dossier hors parcours, les créneaux encore à venir, et les
 *    objectifs restés en cours sur un parcours qui se clôt.
 */
export default function FinsSection({
  patientId,
  patientNom,
  patientNeLe,
  ecrits,
  parcours,
  destinataires,
  consentement,
  erreur,
  canWrite,
}: {
  patientId: string;
  patientNom: string;
  patientNeLe: string | null;
  ecrits: FinAvecDestinataire[];
  parcours: OptionParcoursFin[];
  destinataires: OptionDestinataire[];
  consentement: EtatConsentement;
  erreur: string | null;
  canWrite: boolean;
}) {
  const [edite, setEdite] = useState<FinAvecDestinataire | "nouveau" | null>(null);

  return (
    <SectionDossier
      id="fins"
      titre="Fin de prise en soin"
      erreur={erreur}
      action={
        canWrite &&
        parcours.length > 0 && (
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

      <p
        className={`text-xs mt-2 rounded-lg px-3 py-2 ${
          consentement === "retire"
            ? "bg-rose-50 text-rose-800 ring-1 ring-rose-200"
            : "text-slate-500"
        }`}
      >
        {messageConsentement(consentement)}
      </p>

      {parcours.length === 0 ? (
        <p className="text-sm text-slate-500 mt-3">
          Ce dossier ne porte aucun parcours. Un écrit de fin rend compte
          d&apos;une prise en soin : il en faut une.
        </p>
      ) : ecrits.length === 0 ? (
        <p className="text-sm text-slate-500 mt-3">
          Aucun écrit de fin. Il se rédige quand un suivi s&apos;achève.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100 list-none p-0 m-0">
          {ecrits.map((f) => (
            <LigneFin
              key={f.id}
              ecrit={f}
              patientId={patientId}
              canWrite={canWrite}
              onEdit={() => setEdite(f)}
            />
          ))}
        </ul>
      )}

      {edite && (
        <DialogueFin
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

function LigneFin({
  ecrit: f,
  patientId,
  canWrite,
  onEdit,
}: {
  ecrit: FinAvecDestinataire;
  patientId: string;
  canWrite: boolean;
  onEdit: () => void;
}) {
  const [pending, start] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [annulation, setAnnulation] = useState(false);

  const nom =
    f.delivery_mode === "destinataire"
      ? f.destinataire?.organisation_name?.trim() ||
        `${f.destinataire?.first_name ?? ""} ${f.destinataire?.last_name ?? ""}`.trim() ||
        "Destinataire"
      : MODE_REMISE_LABELS[f.delivery_mode];

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
            {FIN_NATURE_LABELS[f.closure_kind]}
            <span className="text-slate-500"> — {nom}</span>
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            <Statut
              ton={FIN_STATUS_TONS[f.status]}
              libelle={FIN_STATUS_LABELS[f.status]}
            />
            {f.issued_on && ` le ${frDate(f.issued_on)}`}
            {f.cancellation_reason && ` · ${f.cancellation_reason}`}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {f.status !== "brouillon" && (
            <Link
              href={`/fins/${f.id}/document`}
              className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-brand-800"
            >
              <Printer className="h-3.5 w-3.5" aria-hidden="true" />
              Imprimer
            </Link>
          )}
          {canWrite && f.status === "brouillon" && (
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
                  fd.set("id", f.id);
                  fd.set("patient_id", patientId);
                  agir(remettreFin, fd);
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
                  fd.set("id", f.id);
                  fd.set("patient_id", patientId);
                  agir(supprimerBrouillonFin, fd);
                }}
                className="text-xs text-slate-500 hover:text-rose-700 disabled:opacity-50"
              >
                Supprimer
              </button>
            </>
          )}
          {canWrite && f.status === "emis" && (
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
            fd.set("id", f.id);
            fd.set("patient_id", patientId);
            agir(annulerFin, fd);
          }}
        >
          <div className="grow min-w-48">
            <label htmlFor={`motif-fin-${f.id}`} className="block text-xs text-slate-600 mb-1">
              Pourquoi cet écrit est-il annulé ?
            </label>
            <input id={`motif-fin-${f.id}`} name="reason" required className={CHAMP} />
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

/**
 * Une parole du dossier, proposée à la reprise — jamais recopiée d'office.
 *
 * Le motif de la demande est la parole du demandeur, parfois celle d'un tiers,
 * parfois vieille de trois ans. Le motif de fin, lui, est parfois écrit par le
 * LOGICIEL : archiver un dossier y inscrit « Dossier archivé ». Ni l'un ni
 * l'autre ne doit partir chez un tiers sans avoir été relu.
 */
function ARepriser({
  titre,
  texte,
  onReprendre,
}: {
  titre: string;
  texte: string | null;
  onReprendre: () => void;
}) {
  if (!texte) return null;
  return (
    <div className="rounded-lg bg-slate-50 ring-1 ring-slate-200 px-3 py-2">
      <p className="text-xs font-medium text-slate-700">{titre}</p>
      <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{texte}</p>
      <button
        type="button"
        onClick={onReprendre}
        className="mt-1.5 inline-flex items-center gap-1 text-xs text-brand-700 hover:text-brand-900"
      >
        <CornerDownLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Reprendre ce texte
      </button>
    </div>
  );
}

function DialogueFin({
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
  ecrit: FinAvecDestinataire | null;
  parcours: OptionParcoursFin[];
  destinataires: OptionDestinataire[];
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  const parcoursDefaut =
    ecrit?.pathway_id ??
    parcours.find((p) => p.clos)?.id ??
    parcours[0]?.id ??
    "";
  const [parcoursId, setParcoursId] = useState(parcoursDefaut);
  const [nature, setNature] = useState<FinNature>(ecrit?.closure_kind ?? "fin_convenue");
  const [mode, setMode] = useState<ModeRemise>(ecrit?.delivery_mode ?? "au_dossier");
  const [avecObjectifs, setAvecObjectifs] = useState(ecrit?.detail_objectifs ?? true);
  const [avecAbsences, setAvecAbsences] = useState(ecrit?.detail_absences ?? false);
  const [avecFinancement, setAvecFinancement] = useState(
    ecrit?.detail_financement ?? false,
  );
  const [contexte, setContexte] = useState(ecrit?.context ?? "");
  const [motifFin, setMotifFin] = useState(ecrit?.closure_reason ?? "");

  const [releve, setReleve] = useState<{
    cle: string;
    faits: FaitsEpisode | null;
    erreur: string | null;
  } | null>(null);

  useEffect(() => {
    if (!parcoursId) return;
    let annule = false;
    releverLEpisode(parcoursId).then((res) => {
      if (annule) return;
      setReleve(
        res.ok
          ? { cle: parcoursId, faits: res.value, erreur: null }
          : { cle: parcoursId, faits: null, erreur: res.error ?? "Relevé impossible." },
      );
    });
    return () => {
      annule = true;
    };
  }, [parcoursId]);

  const aJour = releve?.cle === parcoursId ? releve : null;
  const faits = aJour?.faits ?? null;
  const parcoursChoisi = parcours.find((p) => p.id === parcoursId);

  const soumettre = (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    fd.set("patient_id", patientId);
    if (ecrit) fd.set("id", ecrit.id);
    setErreur(null);
    start(async () => {
      const res = await enregistrerFin(fd);
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
      titre={ecrit ? "Modifier l'écrit de fin" : "Écrit de fin de prise en soin"}
      /* LE DOSSIER EST NOMMÉ DANS LA FENÊTRE. `showModal()` rend inerte tout ce
         qui est derrière : le nom du patient, qui est en tête de page, devient
         inatteignable — y compris pour un lecteur d'écran. Sur une fenêtre qui
         compose un document destiné à sortir, c'est le risque d'attribution au
         mauvais dossier, nommé en tête de CLINICAL_SAFETY.md. */
      description={`${patientNom}${patientNeLe ? ` · né(e) le ${frDate(patientNeLe)}` : ""}`}
    >
      <form onSubmit={soumettre} className="px-6 py-5 space-y-4">
        <div>
          <label htmlFor="fin_pathway_id" className="block text-sm text-slate-700 mb-1">
            Prise en soin concernée
          </label>
          <select
            id="fin_pathway_id"
            name="pathway_id"
            required
            value={parcoursId}
            onChange={(e) => setParcoursId(e.target.value)}
            className={CHAMP}
          >
            {parcours.map((p) => (
              <option key={p.id} value={p.id}>
                {p.libelle}
                {p.clos ? "" : " — encore ouverte"}
              </option>
            ))}
          </select>
          {parcoursChoisi && !parcoursChoisi.clos && (
            <div className="mt-1">
              <Avertissement compact>
              Cette prise en soin est encore ouverte. Le brouillon s&apos;écrit,
              mais la remise demandera qu&apos;elle soit close depuis le
              parcours — clore est une décision clinique, pas une conséquence de
              la remise d&apos;un document.
              </Avertissement>
            </div>
          )}
        </div>

        {/* ------------------------------------------------ ce qui met fin */}
        <fieldset className="border border-slate-200 rounded-lg px-4 py-3">
          <legend className="text-sm text-slate-700 px-1">
            Ce qui met fin à la prise en soin
          </legend>
          <div className="space-y-2 mt-1">
            {(Object.keys(FIN_NATURE_LABELS) as FinNature[]).map((n) => (
              <label key={n} className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="closure_kind"
                  value={n}
                  checked={nature === n}
                  onChange={() => setNature(n)}
                  className="h-4 w-4 mt-0.5"
                />
                <span>
                  {FIN_NATURE_LABELS[n]}
                  <span className="block text-xs text-slate-500">
                    {FIN_NATURE_AIDES[n]}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* ------------------------------------------------------ le relevé */}
        <div className="rounded-lg bg-slate-50 ring-1 ring-slate-200 px-4 py-3">
          <p className="text-xs font-medium text-slate-700">
            Relevé de la prise en soin — repris du dossier
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Ces éléments sont lus dans l&apos;agenda et le parcours, et figés au
            moment de la remise. Le logiciel n&apos;en tire aucune conclusion.
          </p>

          {aJour?.erreur ? (
            <p role="alert" className="text-sm text-red-700 mt-2">
              {aJour.erreur}
            </p>
          ) : !faits ? (
            <p className="text-sm text-slate-500 mt-2" aria-live="polite">
              Relevé en cours…
            </p>
          ) : (
            <div className="mt-2 space-y-1.5" aria-live="polite">
              <p className="text-sm text-slate-800">
                {faits.seances_honorees} séance
                {faits.seances_honorees > 1 ? "s" : ""} honorée
                {faits.seances_honorees > 1 ? "s" : ""}
                {faits.derniere_seance_le && (
                  <span className="text-slate-600">
                    {" · dernière le "}
                    {frDate(faits.derniere_seance_le)}
                  </span>
                )}
                {avecAbsences && (
                  <span className="text-slate-600">
                    {" · "}
                    {faits.absences} non honoré{faits.absences > 1 ? "s" : ""}
                    {" · "}
                    {faits.annulees_par_le_cabinet} annulée
                    {faits.annulees_par_le_cabinet > 1 ? "s" : ""} par le cabinet
                  </span>
                )}
              </p>

              {/* TROIS AVERTISSEMENTS, qui ne partent pas avec le document. */}
              {faits.honorees_sans_parcours > 0 && (
                <Avertissement compact>
                  Le dossier porte {faits.honorees_sans_parcours} séance
                  {faits.honorees_sans_parcours > 1 ? "s" : ""} honorée
                  {faits.honorees_sans_parcours > 1 ? "s" : ""} rattachée
                  {faits.honorees_sans_parcours > 1 ? "s" : ""} à aucun parcours.
                  Elle{faits.honorees_sans_parcours > 1 ? "s" : ""} ne
                  {faits.honorees_sans_parcours > 1 ? " sont" : " sera"} pas
                  compté{faits.honorees_sans_parcours > 1 ? "es" : "e"} ci-dessus.
                </Avertissement>
              )}
              {faits.rendez_vous_a_venir > 0 && (
                <Avertissement compact>
                  {faits.rendez_vous_a_venir} rendez-vous de cette prise en soin
                  {faits.rendez_vous_a_venir > 1 ? " restent" : " reste"} à venir
                  à l&apos;agenda : le créneau est toujours bloqué.
                </Avertissement>
              )}
              {avecObjectifs && faits.objectifs_en_cours > 0 && (
                <Avertissement compact>
                  {faits.objectifs_en_cours} objectif
                  {faits.objectifs_en_cours > 1 ? "s restent" : " reste"} « en
                  cours » et s&apos;imprimera{faits.objectifs_en_cours > 1 ? "ont" : ""}{" "}
                  ainsi sur un écrit qui annonce la fin. Statuez-les depuis le
                  parcours, un par un — le logiciel ne les requalifie pas.
                </Avertissement>
              )}

              {avecObjectifs && faits.objectifs.length > 0 && (
                <ul className="text-sm text-slate-700 mt-1 space-y-0.5 list-none p-0">
                  {faits.objectifs.map((o, i) => (
                    <li key={i}>
                      {o.intitule}
                      <span className="text-slate-500">
                        {" — "}
                        {OBJECTIF_STATUS_IMPRIME[o.statut ?? ""] ?? o.statut}
                      </span>
                      {o.note_de_reevaluation && (
                        <span className="block text-slate-600 pl-4">
                          {o.note_de_reevaluation}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* -------------------------------------------- ce qu'elle écrit */}
        <div className="space-y-2">
          <label htmlFor="fin_context" className="block text-sm text-slate-700">
            Contexte de la demande
          </label>
          <ARepriser
            titre="Motif noté à l'ouverture du parcours"
            texte={faits?.motif_demande_a_reprendre ?? null}
            onReprendre={() => setContexte(faits?.motif_demande_a_reprendre ?? "")}
          />
          <textarea
            id="fin_context"
            name="context"
            rows={3}
            value={contexte}
            onChange={(e) => setContexte(e.target.value)}
            className={CHAMP}
          />
        </div>

        <div>
          <label htmlFor="fin_means" className="block text-sm text-slate-700 mb-1">
            Cadre et moyens mis en œuvre
          </label>
          <textarea
            id="fin_means"
            name="means"
            rows={4}
            defaultValue={ecrit?.means ?? ""}
            aria-describedby="aide-fin-means"
            className={CHAMP}
          />
          <p id="aide-fin-means" className="text-xs text-slate-500 mt-1">
            Rythme, durée, modalité, ce qui a été travaillé. Rien n&apos;est
            déduit des dates.
          </p>
        </div>

        <div>
          <label htmlFor="fin_observed" className="block text-sm text-slate-700 mb-1">
            Ce que vous observez au terme de la prise en soin
          </label>
          <textarea
            id="fin_observed"
            name="observed"
            rows={7}
            defaultValue={ecrit?.observed ?? ""}
            aria-describedby="aide-fin-observed"
            className={CHAMP}
          />
          <p id="aide-fin-observed" className="text-xs text-slate-500 mt-1">
            Sans ce texte, l&apos;écrit ne peut pas être remis.
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="fin_closure_reason" className="block text-sm text-slate-700">
            Ce qui met fin, dans vos termes
          </label>
          <ARepriser
            titre="Motif de fin noté au parcours"
            texte={faits?.fin_du_parcours_a_reprendre ?? null}
            onReprendre={() => setMotifFin(faits?.fin_du_parcours_a_reprendre ?? "")}
          />
          <textarea
            id="fin_closure_reason"
            name="closure_reason"
            rows={3}
            value={motifFin}
            onChange={(e) => setMotifFin(e.target.value)}
            className={CHAMP}
          />
        </div>

        <div>
          <label htmlFor="fin_remains_open" className="block text-sm text-slate-700 mb-1">
            Ce qui reste ouvert
          </label>
          <textarea
            id="fin_remains_open"
            name="remains_open"
            rows={3}
            defaultValue={ecrit?.remains_open ?? ""}
            className={CHAMP}
          />
        </div>

        <div>
          <label htmlFor="fin_handover" className="block text-sm text-slate-700 mb-1">
            Relais et suite
          </label>
          <textarea
            id="fin_handover"
            name="handover"
            rows={3}
            defaultValue={ecrit?.handover ?? ""}
            className={CHAMP}
          />
        </div>

        <div>
          <label htmlFor="fin_resumption" className="block text-sm text-slate-700 mb-1">
            Si la prise en soin devait reprendre
          </label>
          <textarea
            id="fin_resumption"
            name="resumption"
            rows={3}
            defaultValue={ecrit?.resumption ?? ""}
            aria-describedby="aide-fin-resumption"
            className={CHAMP}
          />
          <p id="aide-fin-resumption" className="text-xs text-slate-500 mt-1">
            La rubrique qui compte le plus quand la prise en soin s&apos;est
            interrompue sans nouvelle.
          </p>
        </div>

        {/* ----------------------------------------------------- la remise */}
        <fieldset className="border border-slate-200 rounded-lg px-4 py-3">
          <legend className="text-sm text-slate-700 px-1">
            À qui cet écrit est-il remis ?
          </legend>
          <div className="space-y-1.5 mt-1">
            {(Object.keys(MODE_REMISE_LABELS) as ModeRemise[]).map((m) => (
              <label key={m} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="delivery_mode"
                  value={m}
                  checked={mode === m}
                  onChange={() => setMode(m)}
                  className="h-4 w-4"
                />
                {MODE_REMISE_LABELS[m]}
              </label>
            ))}
          </div>

          {mode === "destinataire" && (
            <div className="mt-3">
              <label
                htmlFor="fin_recipient"
                className="block text-sm text-slate-700 mb-1"
              >
                Destinataire
              </label>
              <select
                id="fin_recipient"
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

        {/* ------------------------------------------- ce qui s'imprime ou non */}
        <div className="space-y-2">
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="detail_objectifs"
              checked={avecObjectifs}
              onChange={(e) => setAvecObjectifs(e.target.checked)}
              className="h-4 w-4 mt-0.5"
            />
            <span>
              Faire figurer les objectifs et leur état
              <span className="block text-xs text-slate-500">
                Ce que cet écrit dit de plus intime. Ce qui n&apos;est pas dit
                n&apos;est pas conservé.
              </span>
            </span>
          </label>
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
                Les séances annulées par le cabinet figureront aussi : un chiffre
                à sens unique ne dit pas la même chose.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="detail_financement"
              checked={avecFinancement}
              onChange={(e) => setAvecFinancement(e.target.checked)}
              className="h-4 w-4 mt-0.5"
            />
            <span>
              Faire figurer le cadre de financement
              <span className="block text-xs text-slate-500">
                Utile à une structure qui suit un parcours contractualisé.
              </span>
            </span>
          </label>
        </div>

        <div>
          <label htmlFor="fin_note" className="block text-sm text-slate-700 mb-1">
            Mention à faire figurer sur le document
          </label>
          <input id="fin_note" name="note" defaultValue={ecrit?.note ?? ""} className={CHAMP} />
        </div>

        <div>
          <label htmlFor="fin_internal" className="block text-sm text-slate-700 mb-1">
            Note interne (jamais imprimée)
          </label>
          <input
            id="fin_internal"
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
