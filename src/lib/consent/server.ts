import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ConsentPurpose } from "./purposes";

export type CurrentConsent = { purpose: ConsentPurpose; granted: boolean; policy_version: string; recorded_at: string };

export async function getMyConsents(): Promise<Map<ConsentPurpose, CurrentConsent>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("my_current_consents").select("purpose, granted, policy_version, recorded_at");
  if (error) throw new Error("Could not load consent settings.");
  return new Map(((data ?? []) as CurrentConsent[]).map((c) => [c.purpose, c]));
}

export async function hasAcceptedRequiredPolicies(): Promise<boolean> {
  const consents = await getMyConsents();
  return Boolean(consents.get("terms_of_service")?.granted && consents.get("privacy_notice")?.granted);
}

/** Current policy version label (admin-managed). */
export async function currentPolicyVersion(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.from("platform_settings").select("value").eq("key", "policy.version").maybeSingle();
  return typeof data?.value === "string" ? data.value : "unversioned";
}
