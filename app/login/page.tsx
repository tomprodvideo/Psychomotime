"use client";

import { useActionState, useState } from "react";
import { signIn, signUp, type AuthState } from "./actions";
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
                name="display_name"
                type="text"
                placeholder="Votre nom (ex. Manon D.)"
                autoComplete="name"
              />
            )}
            <Field
              icon={<Mail className="h-4 w-4" />}
              name="email"
              type="email"
              placeholder="Adresse email"
              autoComplete="email"
              required
            />
            <Field
              icon={<Lock className="h-4 w-4" />}
              name="password"
              type="password"
              placeholder="Mot de passe"
              autoComplete={
                mode === "signin" ? "current-password" : "new-password"
              }
              required
            />

            {state.error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                {state.error}
              </p>
            )}
            {state.message && (
              <p className="text-sm text-brand-700 bg-brand-50 rounded-lg px-3 py-2">
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
        </div>
        <p className="text-center text-xs text-slate-400 mt-6">
          Vos données sont privées et sécurisées.
        </p>
      </div>
    </div>
  );
}

function Field({
  icon,
  ...props
}: { icon: React.ReactNode } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
        {icon}
      </span>
      <input
        {...props}
        className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100 transition"
      />
    </div>
  );
}
