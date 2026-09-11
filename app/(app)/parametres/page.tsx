import { createClient } from "@/lib/supabase/server";
import { getSettings, getAccess } from "@/lib/data";
import Link from "next/link";
import { FlaskConical } from "lucide-react";
import { PageHeader } from "@/components/ui";
import ParametresForm from "./ParametresForm";
import SubscriptionCard from "./SubscriptionCard";
import DeleteAccountCard from "./DeleteAccountCard";
import CompteSecuriteCard from "./CompteSecuriteCard";

export default async function ParametresPage() {
  const settings = await getSettings();
  const access = await getAccess();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
      <PageHeader
        title="Paramètres"
        subtitle="Profil, apparence des bilans, modèles et comptabilité"
      />
      <Link
        href="/parametres/instruments"
        className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6 hover:border-brand-200 hover:shadow transition"
      >
        <div className="h-10 w-10 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
          <FlaskConical className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <p className="font-medium text-slate-800">Instruments</p>
          <p className="text-sm text-slate-500">
            Les outils que vous employez, vos échelles, vos découpages et les
            mots qui les nomment.
          </p>
        </div>
      </Link>

      <ParametresForm
        settings={settings}
        accountSlot={
          <>
            <SubscriptionCard
              status={access.status}
              trialDaysLeft={access.trialDaysLeft}
              isAdmin={access.isAdmin}
            />
            <CompteSecuriteCard email={user?.email ?? null} />
            <DeleteAccountCard />
          </>
        }
      />
    </div>
  );
}
