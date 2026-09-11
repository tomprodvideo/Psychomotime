"use client";

import { useActionState } from "react";
import { Mail } from "lucide-react";
import AuthShell from "../AuthShell";
import { demanderReinitialisation, type MotDePasseState } from "../actions";

const initial: MotDePasseState = {};

export default function MotDePasseOubliePage() {
  const [state, formAction, pending] = useActionState(
    demanderReinitialisation,
    initial,
  );

  return (
    <AuthShell
      titre="Mot de passe oublié"
      sousTitre="Indiquez l'adresse de votre compte : vous recevrez un lien pour en choisir un nouveau."
    >
      <form action={formAction} className="space-y-4">
        <div className="relative">
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          >
            <Mail className="h-4 w-4" />
          </span>
          <label htmlFor="email" className="sr-only">
            Adresse e-mail du compte
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="Adresse e-mail"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100 transition"
          />
        </div>

        {state.error && (
          <p
            role="alert"
            className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2"
          >
            {state.error}
          </p>
        )}
        {state.message && (
          <p
            role="status"
            className="text-sm text-brand-800 bg-brand-50 rounded-lg px-3 py-2"
          >
            {state.message}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg transition shadow-sm"
        >
          {pending ? "Envoi en cours…" : "Recevoir le lien"}
        </button>
      </form>
    </AuthShell>
  );
}
