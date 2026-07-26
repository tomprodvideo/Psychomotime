import { getSettings, getAccess } from "@/lib/data";
import { PageHeader } from "@/components/ui";
import ParametresForm from "./ParametresForm";
import SubscriptionCard from "./SubscriptionCard";

export default async function ParametresPage() {
  const settings = await getSettings();
  const access = await getAccess();

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
      <PageHeader
        title="Paramètres"
        subtitle="Personnalisez les calculs de votre comptabilité"
      />
      <div className="mb-6">
        <SubscriptionCard
          status={access.status}
          trialDaysLeft={access.trialDaysLeft}
          isAdmin={access.isAdmin}
        />
      </div>
      <ParametresForm settings={settings} />
    </div>
  );
}
