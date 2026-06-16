import { getSettings } from "@/lib/data";
import { PageHeader } from "@/components/ui";
import ParametresForm from "./ParametresForm";

export default async function ParametresPage() {
  const settings = await getSettings();

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
      <PageHeader
        title="Paramètres"
        subtitle="Personnalisez les calculs de votre comptabilité"
      />
      <ParametresForm settings={settings} />
    </div>
  );
}
