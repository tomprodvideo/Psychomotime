import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { getCurrentPractice } from "@/lib/dossier/practice";
import { listCatalog } from "@/lib/compta/queries";
import CatalogueClient from "./CatalogueClient";

import type { Metadata } from "next";
/* LE TITRE EST STATIQUE, ET C'EST DÉLIBÉRÉ. Un titre qui porterait le nom du
   patient le ferait entrer dans l'historique du navigateur, parfois synchronisé
   entre appareils, parfois affiché devant quelqu'un d'autre. C'est le même
   raisonnement que celui de la page de consultation publique, et il vaut
   autant ici. Distinguer les pages entre elles suffit. */
export const metadata: Metadata = { title: "Catalogue des prestations · Psychomotime" };


export default async function CataloguePage() {
  const practice = await getCurrentPractice();
  if (!practice) notFound();

  const items = await listCatalog(practice, { inactifs: true });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
      <Link
        href="/comptabilite"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Comptabilité
      </Link>

      <PageHeader
        title="Catalogue de prestations"
        subtitle="Les libellés et tarifs proposés à la saisie d'une facture"
      />

      <Card className="p-5 mb-5">
        <p className="text-sm text-slate-600">
          Une ligne de facture <strong>recopie</strong> le libellé et le tarif au
          moment où elle est créée, puis ne les relit plus jamais. Modifier une
          prestation ici ne change donc <strong>aucune pièce déjà établie</strong> —
          et c&apos;est ce qui garantit qu&apos;une facture de l&apos;an dernier
          se réimprime à l&apos;identique.
        </p>
      </Card>

      <CatalogueClient items={items} modifiable={practice.canWrite} />
    </div>
  );
}
