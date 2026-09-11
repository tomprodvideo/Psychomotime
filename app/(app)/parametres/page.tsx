import { createClient } from "@/lib/supabase/server";
import { getSettings, getAccess } from "@/lib/data";
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
