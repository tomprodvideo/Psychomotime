"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { signIn, signUp, type AuthState } from "./actions";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { Activity, Lock, Mail, User } from "lucide-react";


const initial: AuthState = {};

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const action = mode === "signin" ? signIn : signUp;
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-brand-50 via-background to-brand-100">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-brand-600 text-white flex items-center justify-center shadow-lg shadow-brand-600/30">
            <Activity className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-brand-900">
            Psychomotime
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Comptabilité &amp; bilans psychomoteurs
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 p-8">
          <div className="flex gap-1 p-1 bg-slate-100 rounded-lg mb-6">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`flex-1 text-sm font-medium py-2 rounded-md transition ${
                mode === "signin"
                  ? "bg-white shadow-sm text-brand-700"
                  : "text-slate-500"
              }`}
            >
              Connexion
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 text-sm font-medium py-2 rounded-md transition ${
                mode === "signup"
                  ? "bg-white shadow-sm text-brand-700"
                  : "text-slate-500"
              }`}
            >
              Créer un compte
            </button>
          </div>

          <form action={formAction} className="space-y-4">
            {mode === "signup" && (
              <Field
                icon={<User className="h-4 w-4" />}
                id="champ-nom"
                label="Votre nom"
                name="display_name"
                type="text"
                placeholder="Votre nom (ex. Manon D.)"
                autoComplete="name"
              />
            )}
            <Field
              icon={<Mail className="h-4 w-4" />}
              id="champ-email"
              label="Adresse électronique"
              name="email"
              type="email"
              placeholder="Adresse email"
              autoComplete="email"
              required
            />
            <Field
              icon={<Lock className="h-4 w-4" />}
              id="champ-mot-de-passe"
              label="Mot de passe"
              aria-describedby={mode === "signup" ? "aide-mot-de-passe" : undefined}
              name="password"
              type="password"
              placeholder="Mot de passe"
              autoComplete={
                mode === "signin" ? "current-password" : "new-password"
              }
              required
            />

            {mode === "signup" && (
              <p id="aide-mot-de-passe" className="text-xs text-slate-500">
                Mot de passe : au moins {MIN_PASSWORD_LENGTH} caractères. Une
                phrase dont vous vous souvenez fait un très bon mot de passe.
              </p>
            )}

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
                className="text-sm text-brand-700 bg-brand-50 rounded-lg px-3 py-2"
              >
                {state.message}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg transition shadow-sm"
            >
              {pending
                ? "Veuillez patienter…"
                : mode === "signin"
                  ? "Se connecter"
                  : "Créer mon compte"}
            </button>
          </form>

          {mode === "signin" && (
            <p className="text-center text-sm text-slate-500 mt-5">
              <Link
                href="/mot-de-passe/oublie"
                className="underline hover:text-brand-700"
              >
                Mot de passe oublié ?
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Un champ de la page de connexion.
 *
 * IL N'AVAIT PAS D'ÉTIQUETTE. Rien qu'un texte d'invite, qui n'en est pas une :
 * il disparaît à la première frappe, et aucune technologie d'assistance ne le
 * rattache au champ. C'était le cas des trois champs de la porte d'entrée du
 * produit — celui qui ne voit pas l'écran ne savait pas ce qu'on lui demandait.
 *
 * L'étiquette est visuellement masquée, pas absente : la mise en page tient à
 * un texte d'invite et à une icône, et la changer était une autre décision que
 * celle-ci. `aria-describedby` relie en outre l'aide au champ qu'elle décrit,
 * plutôt que de la laisser flotter à côté.
 */
function Field({
  icon,
  label,
  id,
  ...props
}: {
  icon: React.ReactNode;
  label: string;
  id: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <span
        aria-hidden="true"
        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
      >
        {icon}
      </span>
      <input
        {...props}
        id={id}
        className="w-full rounded-lg border border-slate-500 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100 transition"
      />
    </div>
  );
}
