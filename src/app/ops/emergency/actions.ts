"use server";

import { revalidatePath } from "next/cache";
import { requireAccount } from "@/lib/auth/session";
import type { FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

export async function setOperation(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAccount("/ops/emergency", ["admin"]);
  if (formData.get("confirm") !== "yes") return { error: "Tick the confirmation box." };
  const staffed = formData.get("staffed") === "on";
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_emergency_operation", {
    p_staffed: staffed, p_hours: String(formData.get("hours") ?? ""), p_supervisor: String(formData.get("supervisor") ?? ""),
  });
  revalidatePath("/ops/emergency");
  revalidatePath("/emergency");
  return error ? { error: ["22023", "P0001"].includes(error.code ?? "") ? error.message : "Not saved." } : { ok: staffed ? "Operation switched on. The callback form now appears on Emergency Help." : "Operation switched off." };
}
