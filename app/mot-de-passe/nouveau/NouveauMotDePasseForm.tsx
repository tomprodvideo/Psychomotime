"use client";

import { useActionState } from "react";
import { Lock } from "lucide-react";
import { definirMotDePasse, type MotDePasseState } from "../actions";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { Bouton } from "@/components/Bouton";

const initial: MotDePasseState = {};

export default function NouveauMotDePasseForm() {
  const [state, formAction, pending] = useActionState(
    definirMotDePasse,
    initial,
  );

  return (
    <form action={formAction} className="space-y-4">
      <Champ
        id="password"
        label="Nouveau mot de passe"
        autoComplete="new-password"
      />
      <Champ
        id="password_confirmation"
        label="Confirmez le mot de passe"
        autoComplete="new-password"
      />

      <p id="aide-mot-de-passe" className="text-xs text-slate-500">
        Au moins {MIN_PASSWORD_LENGTH} caractères. Une phrase dont vous vous
        souvenez — quelques mots qui n&apos;ont de sens que pour vous — vaut
        mieux qu&apos;un mot court avec des symboles.
      </p>

      {state.error && (
        <p
          role="alert"
          className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2"
        >
          {state.error}
        </p>
      )}

      <Bouton variante="libre"
        type="submit"
        pending={pending}
        className="w-full bg-brand-600 hover:bg-brand-700 text-white font-medium py-2.5 rounded-lg transition shadow-sm"
              pendingLabel="Enregistrement…"
            >
        Enregistrer le mot de passe
      </Bouton>
    </form>
  );
}

function Champ({
  id,
  label,
  autoComplete,
}: {
  id: string;
  label: string;
  autoComplete: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm text-slate-700 mb-1">
        {label}
      </label>
      <div className="relative">
        <span
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
          aria-hidden="true"
        >
          <Lock className="h-4 w-4" />
        </span>
        <input
          id={id}
          name={id}
          type="password"
          required
          autoComplete={autoComplete}
          aria-describedby="aide-mot-de-passe"
          className="w-full rounded-lg border border-slate-500 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100 transition"
        />
      </div>
    </div>
  );
}
