import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentPractice } from "@/lib/dossier/practice";
import { getSynthese } from "@/lib/syntheses/queries";
import DocumentSynthese from "./DocumentSynthese";

/* LE TITRE EST STATIQUE, ET C'EST DÉLIBÉRÉ. Un titre portant le nom du patient
   le ferait entrer dans l'historique du navigateur, parfois synchronisé,
   parfois affiché devant un tiers. */
export const metadata: Metadata = { title: "Synthèse à imprimer · Psychomotime" };

export default async function SyntheseDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const practice = await getCurrentPractice();
  if (!practice) notFound();

  const syn = await getSynthese(practice, id);
  if (!syn) notFound();

  return <DocumentSynthese synthese={syn} />;
}
