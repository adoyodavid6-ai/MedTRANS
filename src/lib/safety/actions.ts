"use server";

import { z } from "zod";
import { requireAccount } from "@/lib/auth/session";
import type { FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

const Report = z.object({
  kind: z.enum(["dispensing_error", "adverse_reaction", "suspected_counterfeit", "expired_or_damaged", "delivery_incident", "clinical_incident", "safeguarding", "privacy", "other"], { error: "Choose what happened." }),
  description: z.string({ error: "Describe what happened." }).trim().min(10, "Describe what happened (at least a sentence).").max(4000),
  order_id: z.uuid().optional(),
  booking_id: z.uuid().optional(),
});

export async function reportIncident(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAccount("/account");
  const p = Report.safeParse({
    kind: formData.get("kind") || undefined, description: formData.get("description") || undefined,
    order_id: (formData.get("order_id") as string) || undefined, booking_id: (formData.get("booking_id") as string) || undefined,
  });
  if (!p.success) return p.error.issues[0]?.path[0] === "description" ? { fieldErrors: { description: p.error.issues[0].message } } : { error: p.error.issues[0]?.message };
  const severity = ["adverse_reaction", "dispensing_error", "suspected_counterfeit", "safeguarding"].includes(p.data.kind) ? "severe" : "moderate";
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("report_incident", {
    p_kind: p.data.kind, p_description: p.data.description, p_severity: severity, p_order: p.data.order_id ?? null, p_booking: p.data.booking_id ?? null,
  });
  if (error) return { error: error.code === "42501" ? error.message : "We couldn't send your report. Please contact support." };
  return { ok: `Report ${data as string} sent to MedTRANS safety. We'll follow up with you.` };
}
