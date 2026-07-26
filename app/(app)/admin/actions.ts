"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function isAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("subscriptions")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  return !!data?.is_admin;
}

export async function setSubscription(formData: FormData) {
  const supabase = await createClient();
  if (!(await isAdmin(supabase))) return;

  const userId = String(formData.get("user_id"));
  const action = String(formData.get("action"));
  if (!userId) return;

  let patch: Record<string, unknown> = {};
  if (action === "activate") {
    patch = { manual_override: true, status: "active" };
  } else if (action === "deactivate") {
    patch = { manual_override: false, status: "inactive" };
  } else if (action === "extend") {
    patch = {
      status: "trialing",
      trial_end: new Date(Date.now() + 7 * 86400000).toISOString(),
    };
  } else {
    return;
  }

  await supabase
    .from("subscriptions")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("user_id", userId);

  revalidatePath("/admin");
}
