"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/forms";
import { requireAccount } from "@/lib/auth/session";
import { isConsentPurpose, CONSENT_PURPOSES } from "@/lib/consent/purposes";
import { currentPolicyVersion } from "@/lib/consent/server";
import { createClient } from "@/lib/supabase/server";

/** Records a new consent decision. The ledger is append-only, so history is preserved. */
export async function setOptionalConsent(formData: FormData) {
  const user = await requireAccount("/account/privacy");
  const purpose = formData.get("purpose");
  const granted = formData.get("granted") === "true";
  if (!isConsentPurpose(purpose) || CONSENT_PURPOSES[purpose].required) return;

  const supabase = await createClient();
  await supabase.from("consent_records").insert({
    user_id: user.id,
    purpose,
    granted,
    policy_version: await currentPolicyVersion(),
  });
  revalidatePath("/account/privacy");
}

export async function requestErasure(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAccount("/account/privacy");
  if (formData.get("confirm") !== "on") return { fieldErrors: { confirm: "Tick the box to confirm you understand what happens." } };
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 1000) || null;
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_erasure", { p_reason: reason });
  revalidatePath("/account/privacy");
  return error ? { error: error.code === "P0001" ? error.message : "Your request wasn't sent. Please try again." } : { ok: "Request received." };
}

export async function cancelErasure() {
  await requireAccount("/account/privacy");
  const supabase = await createClient();
  await supabase.rpc("cancel_erasure_request");
  revalidatePath("/account/privacy");
}
