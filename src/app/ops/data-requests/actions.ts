"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAccount } from "@/lib/auth/session";
import type { FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const Input = z.object({ id: z.uuid(), note: z.string().trim().min(5, "Record what was removed and what was kept.").max(2000) });

export async function completeErasure(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAccount("/ops/data-requests", ["admin"]);
  const p = Input.safeParse({ id: formData.get("id"), note: formData.get("note") });
  if (!p.success) return { fieldErrors: { note: p.error.issues[0].message } };
  const supabase = await createClient();
  const { data: uid, error } = await supabase.rpc("admin_complete_erasure", { p_request: p.data.id, p_note: p.data.note });
  revalidatePath("/ops/data-requests");
  if (error) return { error: ["P0001", "22023"].includes(error.code ?? "") ? error.message : "Not completed." };
  // Close the sign-in: ban the auth account (its retained records reference the id, so it is not deleted).
  try {
    const { error: banError } = await createServiceClient().auth.admin.updateUserById(uid as string, { ban_duration: "876000h" });
    if (banError) throw banError;
  } catch {
    return { error: "Personal data was removed, but sign-in could NOT be disabled (service key missing or Auth error). Disable the account in the Supabase dashboard now." };
  }
  return { ok: "Completed: data removed and sign-in disabled. Tell the person what was retained." };
}

export async function declineErasure(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAccount("/ops/data-requests", ["admin"]);
  const p = Input.safeParse({ id: formData.get("id"), note: formData.get("note") });
  if (!p.success) return { fieldErrors: { note: "Explain why, so the person can be told." } };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_decline_erasure", { p_request: p.data.id, p_note: p.data.note });
  revalidatePath("/ops/data-requests");
  return error ? { error: ["P0001", "22023"].includes(error.code ?? "") ? error.message : "Not saved." } : { ok: "Declined; the reason is shown to the person." };
}
