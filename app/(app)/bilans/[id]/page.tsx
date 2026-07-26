import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data";
import type { Bilan } from "@/lib/types";
import BilanEditor from "./BilanEditor";

export default async function BilanEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("bilans")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();

  const settings = await getSettings();
  const templates = settings.profile?.adaptation_templates ?? [];

  return <BilanEditor bilan={data as Bilan} templates={templates} />;
}
