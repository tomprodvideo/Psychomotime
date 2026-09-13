import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentPractice } from "@/lib/dossier/practice";
import { getEcritTiers } from "@/lib/tiers/queries";
import DocumentTiers from "./DocumentTiers";

/* Titre statique : un titre portant le nom du patient le ferait entrer dans
   l'historique du navigateur. */
export const metadata: Metadata = { title: "Écrit à imprimer · Psychomotime" };

export default async function TiersDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const practice = await getCurrentPractice();
  if (!practice) notFound();

  const ecrit = await getEcritTiers(practice, id);
  if (!ecrit) notFound();

  return <DocumentTiers ecrit={ecrit} />;
}
