"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Copy, Link2, ShieldAlert, X } from "lucide-react";
import { frDate } from "@/lib/format";
import {
  ETAT_LIEN_LABELS,
  etatLien,
  type LienPartage,
  type SujetPartage,
} from "@/lib/transmissions/types";
import { EXPIRATIONS_PROPOSEES } from "@/lib/transmissions/jeton";
import { creerLien, revoquerLien } from "./actions";

interface OptionContact {
  id: string;
  nom: string;
  role?: string;
}

/**
 * Partager un document par lien.
 *
 * CE QUE CET ÉCRAN DOIT FAIRE COMPRENDRE, et qui n'est pas évident : un lien
 * est un secret. Qui l'a peut ouvrir le document, sans compte et sans mot de
 * passe. Il se transmet donc comme on transmet un secret, et il se révoque.
 *
 * LE JETON N'EST AFFICHÉ QU'UNE FOIS. La base n'en garde que l'empreinte : ni
 * cet écran, ni aucun autre, ni un export ne pourra le redonner. C'est ce qui
 * rend impossible le défaut de la version précédente, où tous les jetons du
 * cabinet partaient au navigateur à chaque affichage de la comptabilité.
 */
export default function PanneauPartage({
  sujetType,
  sujetId,
  liens,
  contacts,
  modifiable,
}: {
  sujetType: SujetPartage;
  sujetId: string;
  liens: LienPartage[];
  contacts: OptionContact[];
  modifiable: boolean;
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState(false);
  const [lienEnClair, setLienEnClair] = useState<string | null>(null);
  const [expireLe, setExpireLe] = useState<string | null>(null);
  const [copie, setCopie] = useState(false);
  const [compteRendu, setCompteRendu] = useState<string | null>(null);

  // Champs contrôlés : la confirmation doit pouvoir NOMMER ce qui va partir.
  const [contact, setContact] = useState("");
  const [libelle, setLibelle] = useState("");
  const [jours, setJours] = useState(30);
  const [adresse, setAdresse] = useState("");
  const [aConfirmer, setAConfirmer] = useState(false);

  const maintenant = new Date();

  const nomDuContact = contacts.find((c) => c.id === contact)?.nom ?? null;

  function creer() {
    setErreur(null);
    const fd = new FormData();
    fd.set("subject_type", sujetType);
    fd.set("subject_id", sujetId);
    if (contact) fd.set("recipient_contact_id", contact);
    if (libelle) fd.set("recipient_label", libelle);
    fd.set("jours", String(jours));
    if (adresse) fd.set("envoyer_a", adresse);

    demarrer(async () => {
      const r = await creerLien(fd);
      if (!r.ok || !r.lien) {
        setErreur(r.error ?? "La création du lien a échoué.");
        return;
      }
      setLienEnClair(`${window.location.origin}${r.lien}`);
      setExpireLe(r.expire_le ?? null);
      setCompteRendu(r.message ?? null);
      setOuvert(false);
      setAConfirmer(false);
      setCopie(false);
      setAdresse("");
      router.refresh();
    });
  }

  function revoquer(lienId: string) {
    setErreur(null);
    demarrer(async () => {
      const fd = new FormData();
      fd.set("link_id", lienId);
      const r = await revoquerLien(fd);
      if (!r.ok) setErreur(r.error ?? "La révocation a échoué.");
      else router.refresh();
    });
  }

  return (
    <section
      aria-labelledby="titre-partage"
      className="bg-white rounded-xl border border-slate-100 shadow-sm"
    >
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 id="titre-partage" className="font-semibold text-slate-800">
          Transmettre par lien
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Un lien ouvre le document sans compte ni mot de passe.{" "}
          <strong className="font-medium">Qui l&apos;a peut le lire</strong> :
          transmettez-le comme un secret, et révoquez-le dès qu&apos;il n&apos;a
          plus lieu d&apos;être.
        </p>
      </div>

      {/* LE JETON, UNE SEULE FOIS. */}
      {lienEnClair && (
        <div className="mx-5 mt-4 rounded-xl border-2 border-brand-300 bg-brand-50 p-4">
          <p className="text-sm font-medium text-brand-900 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" aria-hidden="true" />
            Copiez ce lien maintenant — il ne sera plus jamais affiché
          </p>
          <p className="text-xs text-brand-800 mt-1">
            Il n&apos;est pas conservé : seule son empreinte l&apos;est. Personne,
            pas même ce logiciel, ne pourra vous le redonner.
            {expireLe && ` Il expire le ${frDate(expireLe)}.`}
          </p>
          {compteRendu && (
            <p role="status" className="text-xs text-brand-900 mt-2 font-medium">
              {compteRendu}
            </p>
          )}
          <div className="flex items-center gap-2 mt-3">
            <code className="flex-1 min-w-0 truncate rounded-lg bg-white border border-brand-200 px-3 py-2 text-xs text-slate-700">
              {lienEnClair}
            </code>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(lienEnClair);
                setCopie(true);
              }}
              className="inline-flex items-center gap-1.5 shrink-0 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-3 py-2 rounded-lg"
            >
              {copie ? (
                <Check className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Copy className="h-4 w-4" aria-hidden="true" />
              )}
              {copie ? "Copié" : "Copier"}
            </button>
            <button
              type="button"
              onClick={() => setLienEnClair(null)}
              aria-label="Masquer le lien"
              className="shrink-0 p-2 text-brand-700 hover:text-brand-900"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {liens.length === 0 ? (
        <p className="px-5 py-4 text-sm text-slate-500">
          Aucun lien pour ce document.
        </p>
      ) : (
        <ul className="list-none p-0 m-0 divide-y divide-slate-50">
          {liens.map((l) => {
            const etat = etatLien(l, maintenant);
            return (
              <li key={l.id} className="flex items-start justify-between gap-3 px-5 py-3">
                <div className="min-w-0 text-sm">
                  <p className="text-slate-700">
                    <Link2
                      className="inline h-3.5 w-3.5 text-slate-400 mr-1.5"
                      aria-hidden="true"
                    />
                    {l.recipient_label ?? "Destinataire non nommé"}
                    <span className="text-slate-400">
                      {" "}
                      · lien …{l.token_hint}
                    </span>
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    <span
                      className={
                        etat === "actif"
                          ? "text-emerald-700"
                          : etat === "revoque"
                            ? "text-rose-600"
                            : "text-slate-500"
                      }
                    >
                      {ETAT_LIEN_LABELS[etat]}
                    </span>
                    {etat === "actif" && ` jusqu'au ${frDate(l.expires_at.slice(0, 10))}`}
                    {" · "}
                    {l.access_count === 0
                      ? "jamais consulté"
                      : `${l.access_count} consultation${l.access_count > 1 ? "s" : ""}`}
                    {l.last_accessed_at &&
                      `, la dernière le ${frDate(l.last_accessed_at.slice(0, 10))}`}
                  </p>
                </div>
                {modifiable && etat === "actif" && (
                  <button
                    type="button"
                    onClick={() => revoquer(l.id)}
                    disabled={enCours}
                    className="shrink-0 text-xs text-slate-500 hover:text-rose-700 border border-slate-200 px-2.5 py-1.5 rounded-lg disabled:opacity-50"
                  >
                    Révoquer
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {modifiable && (
        <div className="px-5 py-4 border-t border-slate-100">
          {ouvert ? (
            <div className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="recipient_contact_id"
                    className="block text-xs font-medium text-slate-500 mb-1"
                  >
                    Destinataire
                  </label>
                  <select
                    id="recipient_contact_id"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    className={styleChamp}
                  >
                    <option value="">Choisir un contact…</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nom}
                        {c.role ? ` — ${c.role}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="recipient_label"
                    className="block text-xs font-medium text-slate-500 mb-1"
                  >
                    …ou à qui, en clair
                  </label>
                  <input
                    id="recipient_label"
                    value={libelle}
                    onChange={(e) => setLibelle(e.target.value)}
                    className={styleChamp}
                    placeholder="Mutuelle, employeur…"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="jours"
                    className="block text-xs font-medium text-slate-500 mb-1"
                  >
                    Valable
                  </label>
                  <select
                    id="jours"
                    value={jours}
                    onChange={(e) => setJours(Number(e.target.value))}
                    className={styleChamp}
                  >
                    {EXPIRATIONS_PROPOSEES.map((j) => (
                      <option key={j} value={j}>
                        {j} jours
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-400 mt-1">
                    Passé ce délai, le lien cesse de fonctionner de lui-même.
                  </p>
                </div>
                <div>
                  <label
                    htmlFor="envoyer_a"
                    className="block text-xs font-medium text-slate-500 mb-1"
                  >
                    Envoyer par courriel à (facultatif)
                  </label>
                  <input
                    id="envoyer_a"
                    type="email"
                    value={adresse}
                    onChange={(e) => setAdresse(e.target.value)}
                    className={styleChamp}
                    placeholder="adresse@exemple.fr"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    Le message ne portera ni pièce jointe, ni montant, ni nom :
                    seulement le lien.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={enCours}
                  onClick={() => {
                    setErreur(null);
                    // A-18 : on ne part pas sans avoir NOMMÉ le destinataire.
                    if (adresse.trim()) setAConfirmer(true);
                    else creer();
                  }}
                  className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50"
                >
                  <Link2 className="h-4 w-4" aria-hidden="true" />
                  {enCours
                    ? "Création…"
                    : adresse.trim()
                      ? "Créer et envoyer…"
                      : "Créer le lien"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOuvert(false);
                    setAConfirmer(false);
                  }}
                  className="text-sm text-slate-500"
                >
                  Annuler
                </button>
              </div>

              {/* LA CONFIRMATION NOMME L'ADRESSE EXACTE. La version précédente
                  envoyait sans jamais la montrer : une faute de frappe dans une
                  adresse envoie un document de santé à un inconnu. */}
              {aConfirmer && (
                <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
                  <p className="text-sm font-medium text-amber-900">
                    Envoyer ce lien à cette adresse ?
                  </p>
                  <p className="mt-2 text-sm text-amber-900">
                    <code className="bg-white border border-amber-200 rounded px-2 py-0.5">
                      {adresse}
                    </code>
                    {nomDuContact && (
                      <span className="block text-xs mt-1">
                        Destinataire enregistré : {nomDuContact}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-amber-800 mt-2">
                    Le message dira qu&apos;un document attend, où le prendre et
                    jusqu&apos;à quand. Il ne portera ni pièce jointe, ni montant,
                    ni nature d&apos;acte, ni nom de patient. Le document, lui,
                    reste derrière le lien — que vous pourrez révoquer.
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      type="button"
                      disabled={enCours}
                      onClick={creer}
                      className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50"
                    >
                      {enCours ? "Envoi…" : "Confirmer l'envoi"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAConfirmer(false)}
                      className="text-sm text-amber-800 px-3 py-2"
                    >
                      Revenir
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setOuvert(true)}
              className="inline-flex items-center gap-2 text-sm font-medium text-brand-700 hover:text-brand-800"
            >
              <Link2 className="h-4 w-4" aria-hidden="true" />
              Créer un lien de consultation
            </button>
          )}
        </div>
      )}

      {erreur && (
        <p role="alert" className="px-5 pb-4 text-sm text-rose-700">
          {erreur}
        </p>
      )}
    </section>
  );
}

const styleChamp =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-200";
