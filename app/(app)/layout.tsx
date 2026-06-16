import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data";
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
          <p className="text-xs text-slate-400 mt-4">
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

  const settings = await getSettings();
  const displayName =
    settings.display_name ||
    (user.user_metadata?.display_name as string) ||
    user.email ||
    "Mon compte";

  return (
    <div className="md:flex min-h-screen">
      <Sidebar displayName={displayName} signOutAction={signOut} />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
