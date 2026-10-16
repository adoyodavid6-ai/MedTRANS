"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAccount } from "@/lib/auth/session";
import type { FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

const STAFF = ["admin", "support"] as const;

export async function staffReply(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAccount("/ops/support", STAFF);
  const p = z.object({
    ticket_id: z.uuid(), body: z.string().trim().min(1, "Write a message.").max(4000), internal: z.enum(["on"]).optional(),
    status: z.enum(["open", "waiting_on_customer", "resolved", "closed"]).optional(),
  }).safeParse({ ticket_id: formData.get("ticket_id"), body: formData.get("body"), internal: formData.get("internal") ?? undefined, status: (formData.get("status") as string) || undefined });
  if (!p.success) return { fieldErrors: { body: p.error.issues[0]?.message ?? "Write a message." } };
  const supabase = await createClient();
  const { error } = await supabase.rpc("staff_reply", { p_ticket: p.data.ticket_id, p_body: p.data.body, p_internal: Boolean(p.data.internal), p_status: p.data.status ?? null });
  revalidatePath(`/ops/support/${p.data.ticket_id}`);
  return error ? { error: "Not sent." } : { ok: p.data.internal ? "Internal note added." : "Reply sent." };
}

export async function updateTicket(formData: FormData) {
  await requireAccount("/ops/support", STAFF);
  const p = z.object({ ticket_id: z.uuid(), priority: z.enum(["low", "normal", "high", "urgent"]), assign: z.enum(["me", "keep"]) }).safeParse({
    ticket_id: formData.get("ticket_id"), priority: formData.get("priority"), assign: formData.get("assign") ?? "keep",
  });
  if (!p.success) return;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  await supabase.from("support_tickets").update({ priority: p.data.priority, ...(p.data.assign === "me" ? { assigned_to: auth.user!.id } : {}) }).eq("id", p.data.ticket_id);
  revalidatePath(`/ops/support/${p.data.ticket_id}`);
}

export async function updateIncident(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireAccount("/ops/incidents", ["admin"]);
  const p = z.object({ id: z.uuid(), status: z.enum(["reported", "investigating", "resolved"]), severity: z.enum(["low", "moderate", "severe", "critical"]), resolution_note: z.string().trim().max(4000).optional() })
    .safeParse({ id: formData.get("id"), status: formData.get("status"), severity: formData.get("severity"), resolution_note: (formData.get("resolution_note") as string) || undefined });
  if (!p.success) return { error: "Check the details." };
  if (p.data.status === "resolved" && !p.data.resolution_note) return { error: "Record how the incident was resolved." };
  const supabase = await createClient();
  const { error } = await supabase.from("safety_incidents").update({
    status: p.data.status, severity: p.data.severity, resolution_note: p.data.resolution_note ?? null, handled_by: user.id,
    resolved_at: p.data.status === "resolved" ? new Date().toISOString() : null,
  }).eq("id", p.data.id);
  revalidatePath("/ops/incidents");
  return error ? { error: "Not saved." } : { ok: "Saved." };
}

export async function recallProduct(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAccount("/ops/catalogue", ["admin"]);
  const p = z.object({ id: z.uuid(), note: z.string().trim().min(5, "Describe the recall (batch, reason, source).").max(1000), confirm: z.literal("yes", { error: "Tick the confirmation box." }) })
    .safeParse({ id: formData.get("id"), note: formData.get("note"), confirm: formData.get("confirm") });
  if (!p.success) return { error: p.error.issues[0]?.message };
  const supabase = await createClient();
  const { error } = await supabase.from("medicine_products").update({ recalled_at: new Date().toISOString(), recall_note: p.data.note }).eq("id", p.data.id);
  revalidatePath("/ops/catalogue");
  return error ? { error: "Not saved." } : { ok: "Recalled: removed from sale everywhere." };
}
