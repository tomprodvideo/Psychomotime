"use client";

import { useState, useTransition } from "react";
import { KeyRound, Mail, ShieldCheck } from "lucide-react";
import { changerEmail, changerMotDePasse, type CompteState } from "./actions";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";

/**
 * Sécurité du compte : changer son mot de passe, changer son adresse.
 *
 * Cette carte est rendue À L'INTÉRIEUR du grand formulaire des paramètres. Un
 * `<form>` imbriqué serait du HTML invalide et le navigateur le déplierait au
 * mauvais endroit : on construit donc la FormData à la main et on appelle
 * l'action dans une transition, comme le fait déjà la carte de suppression.
 */
export default function CompteSecuriteCard({ email }: { email: string | null }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-6">
      <div>
        <h2 className="font-semibold text-slate-800 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-brand-600" aria-hidden="true" />
          Sécurité du compte
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Votre compte donne accès à des dossiers de santé. Son mot de passe est
          la seule chose qui les protège d&apos;un accès depuis un autre
          appareil.
        </p>
      </div>

      <BlocMotDePasse />
      <div className="border-t border-slate-100" />
      <BlocEmail email={email} />
    </div>
  );
}

/* -------------------------------------------------------------- mot de passe */

function BlocMotDePasse() {
  const [state, setState] = useState<CompteState>({});
  const [pending, start] = useTransition();
  const [actuel, setActuel] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [confirmation, setConfirmation] = useState("");

  const soumettre = () => {
    const fd = new FormData();
    fd.set("mot_de_passe_actuel", actuel);
    fd.set("nouveau_mot_de_passe", nouveau);
    fd.set("confirmation", confirmation);
    start(async () => {
      const res = await changerMotDePasse({}, fd);
      setState(res);
      if (res.message) {
        setActuel("");
        setNouveau("");
        setConfirmation("");
      }
    });
  };

  const complet = actuel && nouveau && confirmation;

  return (
    <section aria-labelledby="titre-mot-de-passe" className="space-y-3">
      <h3
        id="titre-mot-de-passe"
        className="text-sm font-medium text-slate-700 flex items-center gap-2"
      >
        <KeyRound className="h-4 w-4 text-slate-500" aria-hidden="true" />
        Changer le mot de passe
      </h3>

      <Champ
        id="mot-de-passe-actuel"
        label="Mot de passe actuel"
        value={actuel}
        onChange={setActuel}
        autoComplete="current-password"
      />
      <Champ
        id="mot-de-passe-nouveau"
        label="Nouveau mot de passe"
        value={nouveau}
        onChange={setNouveau}
        autoComplete="new-password"
        aide={`Au moins ${MIN_PASSWORD_LENGTH} caractères. Une phrase dont vous vous souvenez fait un très bon mot de passe.`}
      />
      <Champ
        id="mot-de-passe-confirmation"
        label="Confirmez le nouveau mot de passe"
        value={confirmation}
        onChange={setConfirmation}
        autoComplete="new-password"
      />

      <Retour state={state} />

      <button
        type="button"
        onClick={soumettre}
        disabled={pending || !complet}
        className="text-sm font-medium text-brand-700 hover:bg-brand-50 border border-brand-200 px-4 py-2 rounded-lg disabled:opacity-50"
      >
        {pending ? "Enregistrement…" : "Changer le mot de passe"}
      </button>
      <p className="text-xs text-slate-500">
        Les autres appareils connectés seront déconnectés.
      </p>
    </section>
  );
}

/* --------------------------------------------------------------------- email */

function BlocEmail({ email }: { email: string | null }) {
  const [state, setState] = useState<CompteState>({});
  const [pending, start] = useTransition();
  const [nouvelEmail, setNouvelEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");

  const soumettre = () => {
    const fd = new FormData();
    fd.set("nouvel_email", nouvelEmail);
    fd.set("mot_de_passe", motDePasse);
    start(async () => {
      const res = await changerEmail({}, fd);
      setState(res);
      if (res.message) {
        setNouvelEmail("");
        setMotDePasse("");
      }
    });
  };

  return (
    <section aria-labelledby="titre-email" className="space-y-3">
      <h3
        id="titre-email"
        className="text-sm font-medium text-slate-700 flex items-center gap-2"
      >
        <Mail className="h-4 w-4 text-slate-500" aria-hidden="true" />
        Changer l&apos;adresse e-mail
      </h3>
      <p className="text-sm text-slate-500">
        Adresse actuelle : <strong>{email ?? "inconnue"}</strong>
      </p>

      <Champ
        id="email-nouveau"
        label="Nouvelle adresse"
        type="email"
        value={nouvelEmail}
        onChange={setNouvelEmail}
        autoComplete="email"
        aide="Votre adresse de connexion ne changera qu'après avoir ouvert le lien de confirmation."
      />
      <Champ
        id="email-mot-de-passe"
        label="Votre mot de passe"
        value={motDePasse}
        onChange={setMotDePasse}
        autoComplete="current-password"
      />

      <Retour state={state} />

      <button
        type="button"
        onClick={soumettre}
        disabled={pending || !nouvelEmail || !motDePasse}
        className="text-sm font-medium text-brand-700 hover:bg-brand-50 border border-brand-200 px-4 py-2 rounded-lg disabled:opacity-50"
      >
        {pending ? "Envoi…" : "Demander le changement"}
      </button>
    </section>
  );
}

/* ------------------------------------------------------------------ communs */

function Champ({
  id,
  label,
  value,
  onChange,
  autoComplete,
  type = "password",
  aide,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  type?: string;
  aide?: string;
}) {
  const aideId = aide ? `${id}-aide` : undefined;
  return (
    <div>
      <label htmlFor={id} className="block text-sm text-slate-700 mb-1">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        aria-describedby={aideId}
        className="w-full max-w-sm rounded-lg border border-slate-500 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100 transition"
      />
      {aide && (
        <p id={aideId} className="text-xs text-slate-500 mt-1 max-w-sm">
          {aide}
        </p>
      )}
    </div>
  );
}

function Retour({ state }: { state: CompteState }) {
  if (state.error) {
    return (
      <p
        role="alert"
        className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2 max-w-sm"
      >
        {state.error}
      </p>
    );
  }
  if (state.message) {
    return (
      <p
        role="status"
        className="text-sm text-brand-800 bg-brand-50 rounded-lg px-3 py-2 max-w-sm"
      >
        {state.message}
      </p>
    );
  }
  return null;
}
