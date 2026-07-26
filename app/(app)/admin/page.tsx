import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccess } from "@/lib/data";
import type { Subscription } from "@/lib/types";
import { PageHeader, StatCard } from "@/components/ui";
import { frDate } from "@/lib/format";
import { setSubscription } from "./actions";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  trialing: "bg-amber-100 text-amber-700",
  inactive: "bg-slate-200 text-slate-600",
  canceled: "bg-rose-100 text-rose-700",
  past_due: "bg-rose-100 text-rose-700",
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
  const activeCount = clients.filter(
    (s) => s.manual_override || s.status === "active",
  ).length;
  const trialCount = clients.filter(
    (s) => s.status === "trialing" && s.trial_end && new Date(s.trial_end).getTime() > Date.now(),
  ).length;

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
                <td colSpan={4} className="text-center text-slate-400 py-10">
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
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        STATUS_STYLES[s.status] ?? "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {STATUS_LABEL[s.status] ?? s.status}
                    </span>
                    {trialInfo(s) && (
                      <span className="text-xs text-slate-400 ml-2">
                        {trialInfo(s)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {frDate(s.created_at)}
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

      <p className="text-xs text-slate-400 mt-4">
        Le paiement automatique (Stripe, 29 €/mois) sera ajouté ensuite. En
        attendant, vous activez/désactivez les comptes manuellement ici.
      </p>
    </div>
  );
}
