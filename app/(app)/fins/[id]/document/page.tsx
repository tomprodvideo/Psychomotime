import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentPractice } from "@/lib/dossier/practice";
import { getFin } from "@/lib/fins/queries";
import DocumentFin from "./DocumentFin";

/* Titre statique : un titre portant le nom du patient le ferait entrer dans
   l'historique du navigateur, parfois synchronisé, parfois affiché devant un
   tiers. */
export const metadata: Metadata = { title: "Écrit de fin à imprimer · Psychomotime" };

export default async function FinDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const practice = await getCurrentPractice();
  if (!practice) notFound();

  const ecrit = await getFin(practice, id);
  if (!ecrit) notFound();

  return <DocumentFin ecrit={ecrit} />;
}
