"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAccount } from "@/lib/auth/session";
import type { FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

export async function courierAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAccount("/portal/courier", ["courier"]);
  const id = z.uuid().safeParse(formData.get("order_id"));
  const op = formData.get("op");
  if (!id.success) return { error: "Unknown order." };
  const supabase = await createClient();

  if (op === "pickup") {
    const { error } = await supabase.rpc("transition_order", { p_order: id.data, p_to: "out_for_delivery", p_note: "Collected from the pharmacy." });
    if (error) return { error: error.message };
  } else if (op === "deliver") {
    const code = String(formData.get("code") ?? "").replace(/\D/g, "");
    if (code.length !== 4) return { fieldErrors: { code: "Enter the 4-digit code the recipient gives you." } };
    const { data, error } = await supabase.rpc("confirm_delivery", { p_order: id.data, p_code: code });
    if (error) return { error: error.message };
    if (data === "wrong_code") return { fieldErrors: { code: "That code doesn't match. Ask the recipient to check their order page." } };
    if (data === "locked") return { error: "Too many wrong codes. Contact MedTRANS operations before handing over." };
  } else if (op === "fail") {
    const reason = String(formData.get("reason") ?? "").trim().slice(0, 300);
    if (!reason) return { fieldErrors: { reason: "Say what happened." } };
    const { error } = await supabase.rpc("transition_order", { p_order: id.data, p_to: "failed_delivery", p_note: reason });
    if (error) return { error: error.message };
  } else return { error: "Unknown action." };

  revalidatePath("/portal/courier");
  return { ok: "Updated." };
}
