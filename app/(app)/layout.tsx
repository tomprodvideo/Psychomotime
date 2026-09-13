import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSettings, getAccess } from "@/lib/data";
import { signOut } from "@/app/login/actions";
import Sidebar from "@/components/Sidebar";

function isConfigured() {
  return (
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isConfigured()) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-brand-50">
        <div className="max-w-lg bg-white rounded-2xl shadow-xl border border-slate-100 p-8 text-center">
          <h1 className="text-xl font-semibold text-slate-800">
            Configuration requise
          </h1>
          <p className="text-sm text-slate-600 mt-3 leading-relaxed">
            Pour activer Psychomotime, ajoutez votre clé Supabase dans le
            fichier <code className="bg-slate-100 px-1.5 py-0.5 rounded">.env.local</code> :
          </p>
          <pre className="text-left text-xs bg-slate-900 text-slate-100 rounded-lg p-4 mt-4 overflow-x-auto">
{`NEXT_PUBLIC_SUPABASE_URL=…
NEXT_PUBLIC_SUPABASE_ANON_KEY=…`}
          </pre>
          <p className="text-xs text-slate-500 mt-4">
            Clé disponible dans : Supabase → Project Settings → API Keys → clé{" "}
            <strong>anon / publishable</strong>. Puis redémarrez le serveur.
          </p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const access = await getAccess();

  // Accès bloqué (essai terminé, pas d'abonnement, pas activé par l'admin)
  if (!access.active) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-brand-50">
        <div className="max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 p-8 text-center">
          <h1 className="text-xl font-semibold text-slate-800">
            Abonnement requis
          </h1>
          <p className="text-sm text-slate-600 mt-3 leading-relaxed">
            Votre période d&apos;essai est terminée. Pour continuer à utiliser
            Psychomotime, un abonnement de <strong>29 €/mois</strong> est
            nécessaire.
          </p>
          <p className="text-sm text-slate-500 mt-3">
            Le paiement en ligne sera bientôt disponible. En attendant,
            contactez l&apos;administrateur pour activer votre compte.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <a
              href="mailto:tom.marcon@live.fr?subject=Activation%20abonnement%20Psychomotime"
              className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg"
            >
              Contacter l&apos;administrateur
            </a>
            <form action={signOut}>
              <button
                type="submit"
                className="w-full text-sm text-slate-500 hover:text-slate-700 py-2"
              >
                Se déconnecter
              </button>
            </form>
          </div>
          <p className="text-xs text-slate-500 mt-4">{user.email}</p>
        </div>
      </div>
    );
  }

  const settings = await getSettings();
  const displayName =
    settings.display_name ||
    (user.user_metadata?.display_name as string) ||
    user.email ||
    "Mon compte";

  const planLabel = access.isAdmin
    ? "Administrateur"
    : access.status === "active"
      ? "Formule Pro · Active"
      : access.status === "trialing"
        ? "Essai"
        : null;
  const planActive = access.isAdmin || access.status === "active";

  return (
    <div className="md:flex min-h-screen">
      {/* LE LIEN D'ÉVITEMENT, PREMIER ARRÊT DU CLAVIER.
          Sans lui, chaque page fait traverser les huit ou neuf liens de la
          barre latérale avant d'atteindre le contenu — à chaque navigation
          entre deux dossiers, plusieurs fois par jour. `sr-only` le garde
          invisible tant qu'il n'a pas le focus ; `focus:not-sr-only` le montre
          alors franchement, parce qu'un lien d'évitement qu'on ne voit pas
          quand on l'atteint ne sert à personne. */}
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-brand-800 focus:shadow-lg"
      >
        Aller au contenu
      </a>
      <Sidebar
        displayName={displayName}
        signOutAction={signOut}
        isAdmin={access.isAdmin}
        planLabel={planLabel}
        planActive={planActive}
      />
      <main id="contenu" tabIndex={-1} className="flex-1 min-w-0">
        {access.trialDaysLeft !== null && (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-sm px-4 py-2 text-center no-print">
            Période d&apos;essai — il vous reste{" "}
            <strong>
              {access.trialDaysLeft} jour{access.trialDaysLeft > 1 ? "s" : ""}
            </strong>
            .
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
