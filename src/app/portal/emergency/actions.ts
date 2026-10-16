"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAccount } from "@/lib/auth/session";
import type { FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

export async function responderAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAccount("/portal/emergency", ["emergency_responder", "admin"]);
  const id = z.uuid().safeParse(formData.get("request_id"));
  if (!id.success) return { error: "Unknown request." };
  const supabase = await createClient();
  const op = formData.get("op");
  const note = (formData.get("note") as string) || null;
  let error: { code?: string; message: string } | null = null;
  if (op === "call") {
    ({ error } = await supabase.rpc("responder_log_call", { p_request: id.data, p_outcome: String(formData.get("outcome") ?? ""), p_note: note }));
  } else {
    const status = (formData.get("status") as string) || null;
    const severity = (formData.get("severity") as string) || null;
    ({ error } = await supabase.rpc("responder_update_emergency", { p_request: id.data, p_status: status, p_severity: severity, p_note: note }));
  }
  revalidatePath("/portal/emergency");
  return error ? { error: ["22023", "P0001"].includes(error.code ?? "") ? error.message : "Not saved." } : { ok: "Recorded." };
}
