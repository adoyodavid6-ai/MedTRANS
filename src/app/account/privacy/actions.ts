"use server";

import { revalidatePath } from "next/cache";
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
