import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

  return <BilanEditor bilan={data as Bilan} />;
}
