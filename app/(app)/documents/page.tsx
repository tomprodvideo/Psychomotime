import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import type { DocFolder, DocumentFile } from "@/lib/types";
import DocumentsClient from "./DocumentsClient";

import type { Metadata } from "next";
/* LE TITRE EST STATIQUE, ET C'EST DÉLIBÉRÉ. Un titre qui porterait le nom du
   patient le ferait entrer dans l'historique du navigateur, parfois synchronisé
   entre appareils, parfois affiché devant quelqu'un d'autre. C'est le même
   raisonnement que celui de la page de consultation publique, et il vaut
   autant ici. Distinguer les pages entre elles suffit. */
export const metadata: Metadata = { title: "Documents · Psychomotime" };


export default async function DocumentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: foldersRaw }, { data: docsRaw }] = await Promise.all([
    supabase.from("doc_folders").select("*").order("name"),
    supabase
      .from("documents")
      .select("*")
      .order("created_at", { ascending: false }),
  ]);

  const folders = (foldersRaw ?? []) as DocFolder[];
  const documents = (docsRaw ?? []) as DocumentFile[];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <PageHeader
        title="Documents"
        subtitle="Rangez vos fichiers (PDF, Word…) dans des dossiers"
      />
      <DocumentsClient
        userId={user?.id ?? ""}
        folders={folders}
        documents={documents}
      />
    </div>
  );
}
