"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { homeFor, safeNextPath } from "@/lib/auth/roles";
import { requireUser } from "@/lib/auth/session";
import { currentPolicyVersion } from "@/lib/consent/server";
import { createClient } from "@/lib/supabase/server";
import { submittedValues } from "@/lib/forms";

export type WelcomeState = { error?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> };

const Schema = z.object({
  full_name: z.string().trim().max(120).optional(),
  preferred_language: z.enum(["en", "sw", "so"]),
  accept_terms: z.literal("on", { error: "You need to accept the terms of service to continue." }),
  accept_privacy: z.literal("on", { error: "You need to accept the privacy notice to continue." }),
});

export async function completeWelcome(_prev: WelcomeState, formData: FormData): Promise<WelcomeState> {
  const user = await requireUser("/welcome");
  const parsed = Schema.safeParse({
    full_name: formData.get("full_name") ?? undefined,
    preferred_language: formData.get("preferred_language"),
    accept_terms: formData.get("accept_terms") ?? undefined,
    accept_privacy: formData.get("accept_privacy") ?? undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { fieldErrors, values: submittedValues(formData, ["full_name", "preferred_language", "accept_terms", "accept_privacy"]) };
  }

  const supabase = await createClient();
  const version = await currentPolicyVersion();
  const { error: consentError } = await supabase.from("consent_records").insert([
    { user_id: user.id, purpose: "terms_of_service", granted: true, policy_version: version },
    { user_id: user.id, purpose: "privacy_notice", granted: true, policy_version: version },
  ]);
  if (consentError) return { error: "We couldn't save your choices. Please try again." };

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.full_name || null, preferred_language: parsed.data.preferred_language })
    .eq("id", user.id);
  if (profileError) return { error: "Your consent was saved, but we couldn't save your profile. You can update it later." };

  redirect(safeNextPath(formData.get("next")) ?? homeFor(user.roles));
}
