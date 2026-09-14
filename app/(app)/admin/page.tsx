import { FUSEAU_PAR_DEFAUT } from "@/lib/dateCivile";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccess } from "@/lib/data";
import type { Subscription } from "@/lib/types";
import { isTrialRunning } from "@/lib/subscription";
import { PageHeader, StatCard } from "@/components/ui";
import { frJourDe } from "@/lib/format";
import { setSubscription } from "./actions";

import type { Metadata } from "next";
import { Statut, type Ton } from "@/components/Statut";
/* LE TITRE EST STATIQUE, ET C'EST DÉLIBÉRÉ. Un titre qui porterait le nom du
   patient le ferait entrer dans l'historique du navigateur, parfois synchronisé
   entre appareils, parfois affiché devant quelqu'un d'autre. C'est le même
   raisonnement que celui de la page de consultation publique, et il vaut
   autant ici. Distinguer les pages entre elles suffit. */
export const metadata: Metadata = { title: "Administration · Psychomotime" };


const STATUS_TONS: Record<string, Ton> = {
  active: "normal",
  trialing: "avis",
  inactive: "inerte",
  canceled: "arret",
  past_due: "arret",
};

const STATUS_LABEL: Record<string, string> = {
  active: "Actif",
  trialing: "Essai",
  inactive: "Inactif",
  canceled: "Annulé",
  past_due: "Impayé",
};

function trialInfo(s: Subscription): string {
  if (s.status !== "trialing" || !s.trial_end) return "";
  const left = Math.ceil(
    (new Date(s.trial_end).getTime() - Date.now()) / 86400000,
  );
  return left > 0 ? `${left} j restant` : "expiré";
}

export default async function AdminPage() {
  const access = await getAccess();
  if (!access.isAdmin) redirect("/");

  const supabase = await createClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("*")
    .order("created_at", { ascending: false });

  const subs = (data ?? []) as Subscription[];
  const clients = subs.filter((s) => !s.is_admin);
  // La règle d'accès vit dans `lib/subscription.ts`, en un seul exemplaire.
  const activeCount = clients.filter(
    (s) => s.manual_override || s.status === "active",
  ).length;
  const trialCount = clients.filter((s) => isTrialRunning(s)).length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <PageHeader
        title="Administration"
        subtitle="Gestion des comptes et des abonnements"
      />

      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard label="Comptes clients" value={String(clients.length)} accent="slate" />
        <StatCard label="Abonnements actifs" value={String(activeCount)} accent="emerald" />
        <StatCard label="En essai" value={String(trialCount)} accent="amber" />
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="bg-brand-600 text-white text-left">
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Statut</th>
              <th className="px-4 py-3 font-semibold">Inscription</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-slate-500 py-10">
                  Aucun compte client pour le moment.
                </td>
              </tr>
            )}
            {clients.map((s) => {
              const isActive = s.manual_override || s.status === "active";
              return (
                <tr key={s.user_id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-700">
                    {s.email ?? "—"}
                    {s.manual_override && (
                      <span className="ml-2 text-xs text-brand-600">
                        (activé manuellement)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Statut
                      ton={STATUS_TONS[s.status] ?? "inerte"}
                      libelle={STATUS_LABEL[s.status] ?? s.status}
                    />
                    {trialInfo(s) && (
                      <span className="text-xs text-slate-500 ml-2">
                        {trialInfo(s)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {/* Un abonnement n'appartient à aucun cabinet dont on lirait le
                        fuseau : le jour s'y lit dans le fuseau par défaut de la
                        base (`practices.timezone`), et c'est un choix d'affichage. */}
                    {frJourDe(s.created_at, FUSEAU_PAR_DEFAUT)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {!isActive && (
                        <form action={setSubscription}>
                          <input type="hidden" name="user_id" value={s.user_id} />
                          <input type="hidden" name="action" value="activate" />
                          <button className="text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-lg">
                            Activer
                          </button>
                        </form>
                      )}
                      {isActive && (
                        <form action={setSubscription}>
                          <input type="hidden" name="user_id" value={s.user_id} />
                          <input type="hidden" name="action" value="deactivate" />
                          <button className="text-xs font-medium text-rose-600 hover:bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg">
                            Désactiver
                          </button>
                        </form>
                      )}
                      <form action={setSubscription}>
                        <input type="hidden" name="user_id" value={s.user_id} />
                        <input type="hidden" name="action" value="extend" />
                        <button className="text-xs font-medium text-slate-600 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg">
                          +7 j d&apos;essai
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500 mt-4">
        Le paiement automatique (Stripe, 29 €/mois) sera ajouté ensuite. En
        attendant, vous activez/désactivez les comptes manuellement ici.
      </p>
    </div>
  );
}
