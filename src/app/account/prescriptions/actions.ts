"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAccount } from "@/lib/auth/session";
import { currentPolicyVersion } from "@/lib/consent/server";
import { EXT, MAX_UPLOAD_BYTES, sniffMime } from "@/lib/files/sniff";
import type { FormState } from "@/lib/forms";
import { track } from "@/lib/analytics/track";
import { createClient } from "@/lib/supabase/server";

const Input = z.object({
  pharmacy_id: z.uuid(),
  items: z.array(z.object({ product_id: z.uuid(), quantity: z.number().int().min(1).max(20) })).min(1).max(20),
  note: z.string().trim().max(500).optional(),
  household_member_id: z.uuid().optional(),
});

/** Uploads a prescription to private storage and submits it to the pharmacy for review. */
export async function submitPrescription(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireAccount("/cart");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { fieldErrors: { file: "Choose a photo or PDF of your prescription." } };
  if (file.size > MAX_UPLOAD_BYTES) return { fieldErrors: { file: "The file is larger than 10 MB. Try a smaller photo." } };
  if (formData.get("consent") !== "on") {
    return { fieldErrors: { consent: "We need your consent to share this prescription with the pharmacist." } };
  }

  let items: unknown;
  try {
    items = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    return { error: "Something went wrong. Please refresh and try again." };
  }
  const parsed = Input.safeParse({
    pharmacy_id: formData.get("pharmacy_id"),
    items,
    note: (formData.get("note") as string) || undefined,
    household_member_id: (formData.get("household_member_id") as string) || undefined,
  });
  if (!parsed.success) return { error: "Something went wrong. Please refresh and try again." };

  await track("prescription_upload_started", "/cart");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniffMime(bytes);
  if (!mime) return { fieldErrors: { file: "Upload a JPG, PNG or WebP photo, or a PDF." } };

  const supabase = await createClient();
  // Consent is recorded first, in the append-only ledger, for this specific purpose.
  const { error: consentError } = await supabase.from("consent_records").insert({
    user_id: user.id, purpose: "health_data_processing", granted: true, policy_version: await currentPolicyVersion(),
  });
  if (consentError) return { error: "We couldn't record your consent. Please try again." };

  const path = `${user.id}/${randomUUID()}/prescription.${EXT[mime]}`;
  const { error: uploadError } = await supabase.storage.from("prescriptions").upload(path, bytes, { contentType: mime, upsert: false });
  if (uploadError) return { error: "The upload failed. Please check your connection and try again." };

  const { error } = await supabase.rpc("submit_prescription", {
    p_pharmacy: parsed.data.pharmacy_id,
    p_storage_path: path,
    p_file_name: file.name.slice(0, 200) || `prescription.${EXT[mime]}`,
    p_items: parsed.data.items,
    p_note: parsed.data.note ?? null,
    p_household_member: parsed.data.household_member_id ?? null,
  });
  if (error) {
    await supabase.storage.from("prescriptions").remove([path]);
    return { error: error.code === "P0001" || error.code === "22023" ? error.message : "We couldn't submit your prescription. Please try again." };
  }
  revalidatePath("/cart");
  revalidatePath("/account/prescriptions");
  return { ok: "Prescription sent. A pharmacist will review it; you'll see the decision here and in your account." };
}

export async function withdrawPrescription(formData: FormData) {
  await requireAccount("/account/prescriptions");
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.rpc("withdraw_prescription", { p_prescription: id.data });
  revalidatePath("/account/prescriptions");
  revalidatePath("/cart");
}
