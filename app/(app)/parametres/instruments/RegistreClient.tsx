"use client";

import { useState, useTransition } from "react";
import { Check, ChevronDown, Plus, Ruler, Trash2, X } from "lucide-react";
import { frDate } from "@/lib/format";
import {
  activateBandSet,
  deleteInstrument,
  saveInstrument,
  saveScale,
  saveVocabulary,
} from "./actions";
import {
  LICENCE_EXPLICATIONS,
  LICENCE_LABELS,
  type BandSetRow,
  type Instrument,
  type InstrumentScale,
  type LicenceStatus,
  type Vocabulary,
} from "@/lib/dossier/types";

const CHAMP =
  "w-full rounded-lg border border-slate-500 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100 transition";

const STATUTS: LicenceStatus[] = [
  "reference_seule",
  "scores_saisis_par_le_praticien",
  "integration_editeur_autorisee",
  "outil_libre_valide",
];

const TEINTE_STATUT: Record<LicenceStatus, string> = {
  reference_seule: "bg-slate-100 text-slate-600",
  scores_saisis_par_le_praticien: "bg-brand-50 text-brand-700",
  integration_editeur_autorisee: "bg-sky-50 text-sky-700",
  outil_libre_valide: "bg-emerald-50 text-emerald-700",
};

const TYPE_RESULTAT: Record<string, string> = {
  brut: "Score brut",
  note_standard: "Note standard",
  note_t: "Note T",
  percentile: "Percentile",
  ecart_type: "Écart-type (DS, z)",
  age_developpement: "Âge de développement",
  categorie: "Catégorie",
  autre: "Autre",
};

const DIRECTION: Record<string, string> = {
  croissant_favorable: "Plus la valeur est haute, mieux c'est",
  decroissant_favorable: "Plus la valeur est basse, mieux c'est",
  non_oriente: "Pas de direction — aucune couleur ne sera appliquée",
};

export default function RegistreClient({
  instruments,
  echelles,
  decoupages,
  vocabulaires,
  canWrite,
  seulementBoutonAjout = false,
}: {
  instruments: Instrument[];
  echelles: Record<string, InstrumentScale[]>;
  decoupages: Record<string, BandSetRow[]>;
  vocabulaires: Vocabulary[];
  canWrite: boolean;
  seulementBoutonAjout?: boolean;
}) {
  const [edite, setEdite] = useState<Instrument | "nouveau" | null>(null);
  const [echelleEditee, setEchelleEditee] = useState<{
    instrumentId: string;
    scale: InstrumentScale | null;
  } | null>(null);
  const [vocabEdite, setVocabEdite] = useState<Vocabulary | "nouveau" | null>(null);
  const [deplie, setDeplie] = useState<string | null>(instruments[0]?.id ?? null);

  const boutonAjout = canWrite ? (
    <button
      type="button"
      onClick={() => setEdite("nouveau")}
      className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition shadow-sm"
    >
      <Plus className="h-4 w-4" aria-hidden="true" />
      Ajouter un instrument
    </button>
  ) : null;

  if (seulementBoutonAjout) {
    return (
      <>
        {boutonAjout}
        {edite && (
          <DialogueInstrument
            instrument={edite === "nouveau" ? null : edite}
            onClose={() => setEdite(null)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className="flex justify-end mb-4">{boutonAjout}</div>

      <ul className="space-y-3 list-none p-0 m-0">
        {instruments.map((i) => {
          const ouvert = deplie === i.id;
          const mesEchelles = echelles[i.id] ?? [];
          const expire =
            i.licence_expires_on && new Date(i.licence_expires_on) < new Date();

          return (
            <li
              key={i.id}
              className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden"
            >
              <div className="flex items-start justify-between gap-3 p-4">
                <button
                  type="button"
                  onClick={() => setDeplie(ouvert ? null : i.id)}
                  aria-expanded={ouvert}
                  className="flex items-start gap-3 min-w-0 text-left flex-1"
                >
                  <ChevronDown
                    aria-hidden="true"
                    className={`h-5 w-5 shrink-0 text-slate-300 mt-0.5 transition ${ouvert ? "rotate-180" : ""}`}
                  />
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800">{i.name}</p>
                    <p className="text-xs text-slate-500">
                      {[i.publisher, i.edition, i.form].filter(Boolean).join(" · ") ||
                        "Aucune précision d'édition"}
                    </p>
                  </div>
                </button>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-xs font-medium rounded-full px-2 py-0.5 ${TEINTE_STATUT[i.licence_status]}`}
                  >
                    {LICENCE_LABELS[i.licence_status]}
                  </span>
                  {canWrite && (
                    <button
                      type="button"
                      onClick={() => setEdite(i)}
                      className="text-xs font-medium text-brand-700 hover:underline"
                    >
                      Modifier
                    </button>
                  )}
                </div>
              </div>

              {expire && (
                <p
                  role="status"
                  className="mx-4 mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200"
                >
                  L&apos;autorisation éditeur a expiré le{" "}
                  {frDate(i.licence_expires_on!)}. L&apos;instrument reste utilisable
                  comme cahier de scores : c&apos;est le repli automatique, et il ne
                  se relève pas tout seul.
                </p>
              )}

              {ouvert && (
                <div className="border-t border-slate-100 px-4 py-4 space-y-4 bg-slate-50/50">
                  <Explication statut={i.licence_status} />

                  <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                    <Ligne
                      terme="Plage d'âge annoncée"
                      valeur={plageAge(i.age_min_months, i.age_max_months)}
                    />
                    <Ligne terme="Population de référence" valeur={i.normative_population} />
                    <Ligne terme="Domaines" valeur={i.domains.join(", ") || null} />
                    <Ligne
                      terme="Licence vérifiée"
                      valeur={
                        i.licence_checked_on
                          ? `${frDate(i.licence_checked_on)}${i.licence_checked_by ? ` par ${i.licence_checked_by}` : ""}`
                          : null
                      }
                    />
                  </dl>

                  {i.validity_warnings && (
                    <p className="rounded-lg bg-white px-3 py-2 text-sm text-slate-600 ring-1 ring-slate-200">
                      <span className="font-medium text-slate-700">
                        Limites de validité :{" "}
                      </span>
                      {i.validity_warnings}
                    </p>
                  )}

                  {/* ------------------------------------------- échelles */}
                  {i.licence_status === "reference_seule" ? (
                    <p className="text-sm text-slate-500">
                      En « référence seule », cet instrument n&apos;a pas
                      d&apos;échelle : vous écrivez vos résultats en texte libre, et
                      le logiciel ne les interprète pas.
                    </p>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <h3 className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                          <Ruler className="h-4 w-4 text-slate-500" aria-hidden="true" />
                          Échelles
                        </h3>
                        {canWrite && (
                          <button
                            type="button"
                            onClick={() =>
                              setEchelleEditee({ instrumentId: i.id, scale: null })
                            }
                            className="text-xs font-medium text-brand-700 hover:underline"
                          >
                            Ajouter une échelle
                          </button>
                        )}
                      </div>

                      {mesEchelles.length === 0 ? (
                        <p className="text-sm text-slate-500">
                          Aucune échelle. Une échelle décrit ce qu&apos;une valeur
                          signifie — son type, ses bornes, sa direction — sans jamais
                          dire comment on l&apos;obtient.
                        </p>
                      ) : (
                        <ul className="space-y-3 list-none p-0 m-0">
                          {mesEchelles.map((e) => (
                            <EchelleCarte
                              key={e.id}
                              echelle={e}
                              decoupages={decoupages[e.id] ?? []}
                              vocabulaires={vocabulaires}
                              canWrite={canWrite}
                              onEdit={() =>
                                setEchelleEditee({ instrumentId: i.id, scale: e })
                              }
                            />
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {canWrite && (
                    <SupprimerInstrument id={i.id} nom={i.name} />
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* ----------------------------------------------------- vocabulaires */}
      <section
        aria-labelledby="titre-vocabulaires"
        className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 mt-6"
      >
        <div className="flex items-center justify-between gap-2 mb-1">
          <h2 id="titre-vocabulaires" className="font-semibold text-slate-800">
            Vocabulaires
          </h2>
          {canWrite && (
            <button
              type="button"
              onClick={() => setVocabEdite("nouveau")}
              className="text-sm font-medium text-brand-700 hover:underline"
            >
              Ajouter
            </button>
          )}
        </div>
        <p className="text-sm text-slate-500 mb-3">
          Les mots qui nomment vos bandes. Ceux que vous employez en interne ne
          sont pas forcément ceux que vous acceptez d&apos;imprimer sur un
          document remis à une famille — d&apos;où deux usages distincts. Un
          vocabulaire non validé ne sort pas du cabinet.
        </p>

        {vocabulaires.length === 0 ? (
          <p className="text-sm text-slate-500">
            Aucun vocabulaire. Sans lui, un découpage n&apos;a pas de mots.
          </p>
        ) : (
          <ul className="space-y-2 list-none p-0 m-0">
            {vocabulaires.map((v) => (
              <li
                key={v.id}
                className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2"
              >
                <div className="min-w-0 text-sm">
                  <p className="font-medium text-slate-800">
                    {v.name}
                    <span className="ml-2 text-xs font-normal text-slate-500">
                      {v.usage === "document_remis"
                        ? "document remis"
                        : "usage interne"}
                    </span>
                  </p>
                  <p className="text-xs text-slate-600">
                    {v.labels.map((l) => l.text).join(" · ")}
                  </p>
                  {v.usage === "document_remis" && (
                    <p className="text-xs text-slate-500">
                      {v.validated_by
                        ? `Assumé par ${v.validated_by}${v.validated_on ? ` le ${frDate(v.validated_on)}` : ""}`
                        : "Non validé : ces mots ne seront pas imprimés."}
                    </p>
                  )}
                </div>
                {canWrite && (
                  <button
                    type="button"
                    onClick={() => setVocabEdite(v)}
                    className="text-xs font-medium text-brand-700 hover:underline shrink-0"
                  >
                    Modifier
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {edite && (
        <DialogueInstrument
          instrument={edite === "nouveau" ? null : edite}
          onClose={() => setEdite(null)}
        />
      )}
      {echelleEditee && (
        <DialogueEchelle
          instrumentId={echelleEditee.instrumentId}
          echelle={echelleEditee.scale}
          onClose={() => setEchelleEditee(null)}
        />
      )}
      {vocabEdite && (
        <DialogueVocabulaire
          vocabulaire={vocabEdite === "nouveau" ? null : vocabEdite}
          onClose={() => setVocabEdite(null)}
        />
      )}
    </>
  );
}

/* ==========================================================================
 *  Éléments d'affichage
 * ========================================================================== */

function plageAge(min: number | null, max: number | null): string | null {
  if (min === null && max === null) return null;
  const ans = (m: number) => {
    const a = Math.floor(m / 12);
    const r = m % 12;
    return r === 0 ? `${a} ans` : `${a} ans ${r} mois`;
  };
  if (min !== null && max !== null) return `de ${ans(min)} à ${ans(max)}`;
  if (min !== null) return `à partir de ${ans(min)}`;
  return `jusqu'à ${ans(max!)}`;
}

function Ligne({ terme, valeur }: { terme: string; valeur: string | null }) {
  if (!valeur) return null;
  return (
    <div>
      <dt className="text-xs text-slate-500">{terme}</dt>
      <dd className="text-slate-700">{valeur}</dd>
    </div>
  );
}

function Explication({ statut }: { statut: LicenceStatus }) {
  const e = LICENCE_EXPLICATIONS[statut];
  return (
    <div className="grid sm:grid-cols-2 gap-3 text-xs">
      <div className="rounded-lg bg-white ring-1 ring-slate-200 px-3 py-2">
        <p className="font-medium text-slate-700 mb-0.5">Ce qui est possible</p>
        <p className="text-slate-600">{e.autorise}</p>
      </div>
      <div className="rounded-lg bg-white ring-1 ring-slate-200 px-3 py-2">
        <p className="font-medium text-slate-700 mb-0.5">Ce qui ne l&apos;est pas</p>
        <p className="text-slate-600">{e.interdit}</p>
      </div>
    </div>
  );
}

function EchelleCarte({
  echelle,
  decoupages,
  vocabulaires,
  canWrite,
  onEdit,
}: {
  echelle: InstrumentScale;
  decoupages: BandSetRow[];
  vocabulaires: Vocabulary[];
  canWrite: boolean;
  onEdit: () => void;
}) {
  const actif = decoupages.find((d) => d.active);
  const vocabDe = (id: string) => vocabulaires.find((v) => v.id === id);

  return (
    <li className="rounded-lg bg-white ring-1 ring-slate-200 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800">{echelle.name}</p>
          <p className="text-xs text-slate-500">
            {TYPE_RESULTAT[echelle.result_type] ?? echelle.result_type}
            {echelle.mean !== null && ` · moyenne ${echelle.mean}`}
            {echelle.sd !== null && `, écart-type ${echelle.sd}`}
            {echelle.min_value !== null &&
              echelle.max_value !== null &&
              ` · de ${echelle.min_value} à ${echelle.max_value}`}
          </p>
          <p className="text-xs text-slate-500">{DIRECTION[echelle.direction]}</p>
        </div>
        {canWrite && (
          <button
            type="button"
            onClick={onEdit}
            className="text-xs font-medium text-brand-700 hover:underline shrink-0"
          >
            Modifier
          </button>
        )}
      </div>

      {echelle.direction === "non_oriente" && (
        <p className="mt-2 text-xs text-slate-500">
          Sans direction déclarée, aucune valeur de cette échelle ne sera colorée :
          rien ne dit de quel côté se trouve « mieux ». Le chiffre s&apos;affichera nu.
        </p>
      )}

      {/* --------------------------------------------------- découpages */}
      <div className="mt-3 pt-3 border-t border-slate-100">
        {decoupages.length === 0 ? (
          <p className="text-xs text-slate-500">
            Aucun découpage. Sans lui, les valeurs s&apos;affichent sans couleur ni
            libellé — ce qui vaut mieux qu&apos;un découpage inventé.
          </p>
        ) : (
          <ul className="space-y-2 list-none p-0 m-0">
            {decoupages.map((d) => (
              <DecoupageLigne
                key={d.id}
                decoupage={d}
                vocabulaire={vocabDe(d.vocabulary_id)}
                estActif={d.id === actif?.id}
                canWrite={canWrite}
              />
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

function DecoupageLigne({
  decoupage,
  vocabulaire,
  estActif,
  canWrite,
}: {
  decoupage: BandSetRow;
  vocabulaire: Vocabulary | undefined;
  estActif: boolean;
  canWrite: boolean;
}) {
  const [pending, start] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  const mot = (key: string) =>
    vocabulaire?.labels.find((l) => l.key === key)?.text ?? key;

  const activer = () => {
    const fd = new FormData();
    fd.set("id", decoupage.id);
    setErreur(null);
    start(async () => {
      const res = await activateBandSet(fd);
      if (!res.ok) setErreur(res.error);
    });
  };

  return (
    <li
      className={`rounded-lg px-2.5 py-2 text-xs ${estActif ? "bg-brand-50 ring-1 ring-brand-200" : "bg-slate-50"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-slate-800">
            {decoupage.version}
            {estActif && (
              <span className="ml-2 inline-flex items-center gap-1 text-brand-700">
                <Check className="h-3 w-3" aria-hidden="true" />
                appliqué
              </span>
            )}
          </p>
          <p className="text-slate-500">{decoupage.source}</p>
        </div>
        {canWrite && !estActif && (
          <button
            type="button"
            onClick={activer}
            disabled={pending}
            className="text-xs font-medium text-brand-700 hover:underline shrink-0 disabled:opacity-50"
          >
            {pending ? "…" : "Appliquer"}
          </button>
        )}
      </div>

      <ul className="flex flex-wrap gap-1.5 mt-1.5 list-none p-0 m-0">
        {decoupage.bands.map((b) => (
          <li
            key={b.id}
            className="inline-flex items-center gap-1 rounded-full bg-white ring-1 ring-slate-200 px-2 py-0.5"
          >
            {b.colour && (
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: b.colour }}
              />
            )}
            <span className="text-slate-700">{mot(b.label_key)}</span>
            <span className="text-slate-500">
              {b.lower_bound ?? "−∞"} {b.lower_inclusive ? "≤" : "<"} v{" "}
              {b.upper_inclusive ? "≤" : "<"} {b.upper_bound ?? "+∞"}
            </span>
          </li>
        ))}
      </ul>

      {erreur && (
        <p
          role="alert"
          className="mt-2 whitespace-pre-wrap rounded-lg bg-red-50 px-2 py-1.5 text-red-700 ring-1 ring-red-200"
        >
          {erreur}
        </p>
      )}
    </li>
  );
}

function SupprimerInstrument({ id, nom }: { id: string; nom: string }) {
  const [pending, start] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          if (
            !confirm(
              `Retirer « ${nom} » du registre ?\n\n` +
                "Ses échelles et ses découpages sont supprimés avec lui. Les bilans " +
                "déjà rédigés conservent ce qui y a été écrit.",
            )
          )
            return;
          const fd = new FormData();
          fd.set("id", id);
          setErreur(null);
          start(async () => {
            const res = await deleteInstrument(fd);
            if (!res.ok) setErreur(res.error);
          });
        }}
        disabled={pending}
        className="inline-flex items-center gap-1.5 text-xs text-rose-600 hover:bg-rose-50 px-2 py-1 rounded-lg disabled:opacity-50"
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        Retirer du registre
      </button>
      {erreur && (
        <p role="alert" className="text-xs text-red-700 mt-1">
          {erreur}
        </p>
      )}
    </div>
  );
}

/* ==========================================================================
 *  Dialogues
 * ========================================================================== */

function Dialogue({
  titre,
  onClose,
  children,
}: {
  titre: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titre}
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-slate-900/40 p-4 overflow-y-auto"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">{titre}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="text-slate-500 hover:text-slate-600 rounded p-1"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function DialogueInstrument({
  instrument,
  onClose,
}: {
  instrument: Instrument | null;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [statut, setStatut] = useState<LicenceStatus>(
    instrument?.licence_status ?? "reference_seule",
  );

  const soumettre = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setErreur(null);
    start(async () => {
      const res = await saveInstrument(fd);
      if (!res.ok) {
        setErreur(res.error);
        return;
      }
      onClose();
    });
  };

  return (
    <Dialogue
      titre={instrument ? "Modifier l'instrument" : "Nouvel instrument"}
      onClose={onClose}
    >
      <form onSubmit={soumettre} className="px-6 py-5 space-y-4">
        {instrument && <input type="hidden" name="id" value={instrument.id} />}

        <Champ name="name" label="Nom" defaultValue={instrument?.name} required />
        <div className="grid sm:grid-cols-3 gap-3">
          <Champ name="publisher" label="Éditeur" defaultValue={instrument?.publisher ?? ""} />
          <Champ name="edition" label="Édition" defaultValue={instrument?.edition ?? ""} />
          <Champ name="form" label="Formulaire" defaultValue={instrument?.form ?? ""} />
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <Champ
            name="age_min_months"
            label="Âge minimal annoncé (mois)"
            type="number"
            defaultValue={instrument?.age_min_months?.toString() ?? ""}
            aide="Sert à vous avertir si l'âge à la passation en sort. Jamais à bloquer."
          />
          <Champ
            name="age_max_months"
            label="Âge maximal annoncé (mois)"
            type="number"
            defaultValue={instrument?.age_max_months?.toString() ?? ""}
          />
        </div>

        <Champ
          name="normative_population"
          label="Population de référence"
          defaultValue={instrument?.normative_population ?? ""}
          aide="« Enfants français, 2015 », « normes nord-américaines »… C'est une limite de validité : elle doit pouvoir se dire."
        />
        <Champ
          name="domains"
          label="Domaines explorés"
          defaultValue={instrument?.domains.join(", ") ?? ""}
          aide="Séparés par des virgules."
        />

        <div>
          <label htmlFor="licence_status" className="block text-sm text-slate-700 mb-1">
            Statut de licence
          </label>
          <select
            id="licence_status"
            name="licence_status"
            value={statut}
            onChange={(e) => setStatut(e.target.value as LicenceStatus)}
            className={CHAMP}
          >
            {STATUTS.map((s) => (
              <option key={s} value={s}>
                {LICENCE_LABELS[s]}
              </option>
            ))}
          </select>
          <div className="mt-2">
            <Explication statut={statut} />
          </div>
        </div>

        {statut === "integration_editeur_autorisee" && (
          <fieldset className="space-y-3 rounded-lg bg-slate-50 p-3">
            <legend className="text-sm font-medium text-slate-700 px-1">
              Preuves de l&apos;accord
            </legend>
            <p className="text-xs text-slate-500">
              Sans référence, date et nom de vérificateur, le statut retombe
              automatiquement à « scores saisis par vous ». Le repli est
              descendant : il ne se relève jamais tout seul.
            </p>
            <Champ
              name="licence_reference"
              label="Référence de l'accord"
              defaultValue={instrument?.licence_reference ?? ""}
            />
            <Champ
              name="licence_scope"
              label="Périmètre, recopié de l'accord"
              defaultValue={instrument?.licence_scope ?? ""}
            />
            <div className="grid grid-cols-2 gap-2">
              <Champ
                name="licence_checked_on"
                label="Vérifié le"
                type="date"
                defaultValue={instrument?.licence_checked_on ?? ""}
              />
              <Champ
                name="licence_expires_on"
                label="Expire le"
                type="date"
                defaultValue={instrument?.licence_expires_on ?? ""}
              />
            </div>
            <Champ
              name="licence_checked_by"
              label="Vérifié par"
              defaultValue={instrument?.licence_checked_by ?? ""}
            />
          </fieldset>
        )}

        {statut === "outil_libre_valide" && (
          <fieldset className="space-y-3 rounded-lg bg-slate-50 p-3">
            <legend className="text-sm font-medium text-slate-700 px-1">
              Preuve du caractère libre
            </legend>
            <p className="text-xs text-slate-500">
              « Librement accessible » n&apos;est pas « libre de droits ». Une
              épreuve reproduite dans un mémoire ou sur un site associatif reste
              protégée. La charge de la preuve incombe à celui qui l&apos;affirme.
            </p>
            <Champ
              name="licence_url"
              label="Adresse de la licence"
              type="url"
              defaultValue={instrument?.licence_url ?? ""}
            />
            <Champ
              name="licence_checked_on"
              label="Lue le"
              type="date"
              defaultValue={instrument?.licence_checked_on ?? ""}
            />
          </fieldset>
        )}

        <div>
          <label htmlFor="validity_warnings" className="block text-sm text-slate-700 mb-1">
            Limites de validité
          </label>
          <textarea
            id="validity_warnings"
            name="validity_warnings"
            rows={2}
            defaultValue={instrument?.validity_warnings ?? ""}
            placeholder="Étalonnage de 2003, normes non françaises, passation adaptée…"
            className={CHAMP}
          />
        </div>

        <Erreur message={erreur} />
        <Actions pending={pending} onClose={onClose} />
      </form>
    </Dialogue>
  );
}

function DialogueEchelle({
  instrumentId,
  echelle,
  onClose,
}: {
  instrumentId: string;
  echelle: InstrumentScale | null;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  const soumettre = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setErreur(null);
    start(async () => {
      const res = await saveScale(fd);
      if (!res.ok) {
        setErreur(res.error);
        return;
      }
      onClose();
    });
  };

  return (
    <Dialogue titre={echelle ? "Modifier l'échelle" : "Nouvelle échelle"} onClose={onClose}>
      <form onSubmit={soumettre} className="px-6 py-5 space-y-4">
        <input type="hidden" name="instrument_id" value={instrumentId} />
        {echelle && <input type="hidden" name="id" value={echelle.id} />}

        <Champ name="name" label="Nom de l'échelle" defaultValue={echelle?.name} required />

        <div>
          <label htmlFor="result_type" className="block text-sm text-slate-700 mb-1">
            Type de résultat
          </label>
          <select
            id="result_type"
            name="result_type"
            defaultValue={echelle?.result_type ?? "brut"}
            className={CHAMP}
          >
            {Object.entries(TYPE_RESULTAT).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500 mt-1">
            Le logiciel ne convertit jamais une échelle en une autre : une
            conversion est propre à une version d&apos;instrument et suppose une
            autorisation de son éditeur.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Champ name="mean" label="Moyenne" defaultValue={echelle?.mean?.toString() ?? ""} />
          <Champ name="sd" label="Écart-type" defaultValue={echelle?.sd?.toString() ?? ""} />
          <Champ
            name="min_value"
            label="Minimum"
            defaultValue={echelle?.min_value?.toString() ?? ""}
          />
          <Champ
            name="max_value"
            label="Maximum"
            defaultValue={echelle?.max_value?.toString() ?? ""}
          />
        </div>

        <div>
          <label htmlFor="direction" className="block text-sm text-slate-700 mb-1">
            Direction
          </label>
          <select
            id="direction"
            name="direction"
            defaultValue={echelle?.direction ?? "non_oriente"}
            className={CHAMP}
          >
            {Object.entries(DIRECTION).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500 mt-1">
            Sans direction, aucune couleur ne peut être appliquée : rien ne dit de
            quel côté se trouve « mieux ». C&apos;est le défaut, et il est prudent.
          </p>
        </div>

        <Erreur message={erreur} />
        <Actions pending={pending} onClose={onClose} />
      </form>
    </Dialogue>
  );
}

function DialogueVocabulaire({
  vocabulaire,
  onClose,
}: {
  vocabulaire: Vocabulary | null;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [usage, setUsage] = useState(vocabulaire?.usage ?? "interne");

  const soumettre = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setErreur(null);
    start(async () => {
      const res = await saveVocabulary(fd);
      if (!res.ok) {
        setErreur(res.error);
        return;
      }
      onClose();
    });
  };

  return (
    <Dialogue
      titre={vocabulaire ? "Modifier le vocabulaire" : "Nouveau vocabulaire"}
      onClose={onClose}
    >
      <form onSubmit={soumettre} className="px-6 py-5 space-y-4">
        {vocabulaire && <input type="hidden" name="id" value={vocabulaire.id} />}

        <Champ name="name" label="Nom" defaultValue={vocabulaire?.name} required />

        <div>
          <label htmlFor="usage" className="block text-sm text-slate-700 mb-1">
            Usage
          </label>
          <select
            id="usage"
            name="usage"
            value={usage}
            onChange={(e) => setUsage(e.target.value as "interne" | "document_remis")}
            className={CHAMP}
          >
            <option value="interne">Usage interne</option>
            <option value="document_remis">Document remis</option>
          </select>
          <p className="text-xs text-slate-500 mt-1">
            Les mots employés en interne ne sont pas forcément ceux que vous
            acceptez d&apos;imprimer sur un document lu par une famille.
          </p>
        </div>

        {usage === "document_remis" && (
          <Champ
            name="validated_by"
            label="Assumé par"
            defaultValue={vocabulaire?.validated_by ?? ""}
            required
            aide="Tant que ce champ est vide, ces mots ne sortiront pas du cabinet : ils s'afficheront dans l'outil de travail, jamais sur un document."
          />
        )}

        <div>
          <label htmlFor="labels" className="block text-sm text-slate-700 mb-1">
            Les mots, un par ligne, du plus bas au plus haut
          </label>
          <textarea
            id="labels"
            name="labels"
            rows={5}
            required
            defaultValue={vocabulaire?.labels.map((l) => l.text).join("\n") ?? ""}
            placeholder={"Très en deçà\nEn deçà\nDans la moyenne\nAu-dessus"}
            className={CHAMP}
          />
          <p className="text-xs text-slate-500 mt-1">
            Un mot par bande, et deux bandes ne peuvent pas porter le même : ce
            serait illisible sur un document et indécidable sur un graphique.
          </p>
        </div>

        <Erreur message={erreur} />
        <Actions pending={pending} onClose={onClose} />
      </form>
    </Dialogue>
  );
}

/* ==========================================================================
 *  Petits éléments de formulaire
 * ========================================================================== */

function Champ({
  name,
  label,
  type = "text",
  defaultValue,
  aide,
  required,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string;
  aide?: string;
  required?: boolean;
}) {
  const aideId = aide ? `${name}-aide` : undefined;
  return (
    <div>
      <label htmlFor={name} className="block text-sm text-slate-700 mb-1">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        aria-describedby={aideId}
        className={CHAMP}
      />
      {aide && (
        <p id={aideId} className="text-xs text-slate-500 mt-1">
          {aide}
        </p>
      )}
    </div>
  );
}

function Erreur({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="whitespace-pre-wrap rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200"
    >
      {message}
    </p>
  );
}

function Actions({ pending, onClose }: { pending: boolean; onClose: () => void }) {
  return (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        onClick={onClose}
        className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
      >
        Annuler
      </button>
      <button
        type="submit"
        disabled={pending}
        className="px-5 py-2 text-sm text-white bg-brand-600 hover:bg-brand-700 rounded-lg disabled:opacity-60"
      >
        {pending ? "Enregistrement…" : "Enregistrer"}
      </button>
    </div>
  );
}
