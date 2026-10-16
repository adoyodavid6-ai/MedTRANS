"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAccount } from "@/lib/auth/session";
import { fieldErrors, formFields, submittedValues, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

const ADMIN = ["admin"] as const;
const msg = (e: { code?: string; message: string } | null) => (e ? (["P0001", "22023", "42501"].includes(e.code ?? "") ? e.message : "Not saved.") : undefined);

const ProviderStatus = z.object({
  provider_id: z.uuid(), status: z.enum(["pending", "verified", "suspended", "unverified"]),
  check_method: z.string().trim().max(300).optional(), confirm: z.literal("yes", { error: "Tick the confirmation box." }),
});

export async function setProviderStatus(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAccount("/ops/providers", ADMIN);
  const p = ProviderStatus.safeParse(formFields(formData, ["provider_id", "status", "check_method", "confirm"]));
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Check the details." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_provider_status", { p_provider: p.data.provider_id, p_status: p.data.status, p_check_method: p.data.check_method ?? null });
  revalidatePath("/ops/providers");
  return error ? { error: msg(error) } : { ok: "Saved." };
}

export async function bookingOpsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAccount("/ops/bookings", ADMIN);
  const id = z.uuid().safeParse(formData.get("booking_id"));
  if (!id.success) return { error: "Unknown booking." };
  const supabase = await createClient();
  const op = formData.get("op");
  let error: { code?: string; message: string } | null = null;
  if (op === "refunded") {
    ({ error } = await supabase.rpc("record_booking_refund", { p_booking: id.data, p_reference: String(formData.get("reference") ?? "") }));
  } else if (op === "failed" || op === "refund_processing" || op === "cancelled") {
    ({ error } = await supabase.rpc("transition_booking", { p_booking: id.data, p_to: op, p_note: String(formData.get("note") ?? "") }));
  } else return { error: "Unknown action." };
  revalidatePath("/ops/bookings");
  return error ? { error: msg(error) } : { ok: "Done." };
}

const Service = z.object({
  name: z.string({ error: "Enter a name." }).trim().min(2).max(120),
  summary: z.string({ error: "Enter a one-line summary." }).trim().min(10).max(300),
  description: z.string().trim().max(4000).optional(),
  required_profession: z.enum(["doctor", "nurse"], { error: "Choose who provides it." }),
  duration_minutes: z.coerce.number({ error: "Enter a duration." }).int().min(15).max(480),
  eligibility_notes: z.string().trim().max(2000).optional(),
  escalation_notes: z.string().trim().max(2000).optional(),
});

export async function createService(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAccount("/ops/care-services", ADMIN);
  const names = ["name", "summary", "description", "required_profession", "duration_minutes", "eligibility_notes", "escalation_notes"];
  const p = Service.safeParse(formFields(formData, names));
  if (!p.success) return { fieldErrors: fieldErrors(p.error), values: submittedValues(formData, names) };
  const slug = p.data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
  const supabase = await createClient();
  const { error } = await supabase.from("care_services").insert({ ...p.data, slug, description: p.data.description ?? null, eligibility_notes: p.data.eligibility_notes ?? null, escalation_notes: p.data.escalation_notes ?? null });
  revalidatePath("/ops/care-services");
  return error ? { error: error.code === "23505" ? "A service with that name exists." : "Not saved.", values: submittedValues(formData, names) } : { ok: "Service added (inactive)." };
}

export async function toggleService(formData: FormData) {
  await requireAccount("/ops/care-services", ADMIN);
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.from("care_services").update({ is_active: formData.get("active") === "true" }).eq("id", id.data);
  revalidatePath("/ops/care-services");
}

export async function reviewScreening(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAccount("/ops/care-services", ADMIN);
  const reviewer = String(formData.get("reviewer") ?? "").trim();
  if (reviewer.length < 5 || formData.get("confirm") !== "yes") {
    return { error: "Name the clinician or clinical governance body who reviewed the questions, and tick the confirmation." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("care_screening_questions").update({ clinically_reviewed_by: reviewer.slice(0, 200), clinically_reviewed_at: new Date().toISOString() }).eq("is_active", true);
  revalidatePath("/ops/care-services");
  return error ? { error: "Not saved." } : { ok: "Screening questions recorded as clinically reviewed." };
}
