import Link from "next/link";
import { Activity } from "lucide-react";

/**
 * Enveloppe visuelle commune aux écrans d'authentification hors connexion.
 * Reprend la présentation de `/login` pour que l'utilisateur reste sur un
 * terrain reconnaissable pendant une opération sensible.
 */
export default function AuthShell({
  titre,
  sousTitre,
  children,
  retour = true,
}: {
  titre: string;
  sousTitre?: string;
  children: React.ReactNode;
  retour?: boolean;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-brand-50 via-background to-brand-100">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-brand-600 text-white flex items-center justify-center shadow-lg shadow-brand-600/30">
            <Activity className="h-7 w-7" aria-hidden="true" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-brand-900">{titre}</h1>
          {sousTitre && (
            <p className="text-sm text-slate-500 mt-1 text-center text-balance">
              {sousTitre}
            </p>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 p-8">
          {children}
        </div>

        {retour && (
          <p className="text-center text-sm text-slate-500 mt-6">
            <Link href="/login" className="underline hover:text-brand-700">
              Revenir à la connexion
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
