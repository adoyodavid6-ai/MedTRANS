"use server";

import { z } from "zod";
import { normalisePhone } from "@/lib/auth/identifier";
import { fieldErrors, formFields, submittedValues, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

const Application = z.object({
  kind: z.enum(["pharmacy", "organisation"]),
  organisation_name: z.string({ error: "Enter the organisation's name." }).trim().min(2, "Enter the organisation's name.").max(160),
  contact_name: z.string({ error: "Enter a contact name." }).trim().min(2, "Enter a contact name.").max(120),
  contact_phone: z.string().trim().max(32).optional(),
  contact_email: z.email("Enter a valid email address.").max(254).optional(),
  licence_number: z.string().trim().max(80).optional(),
  town: z.string().trim().max(120).optional(),
  organisation_type: z.string().trim().max(80).optional(),
  message: z.string().trim().max(2000).optional(),
  consent: z.literal("on", { error: "We need your agreement to store these details and contact you." }),
});

const NAMES = ["kind", "organisation_name", "contact_name", "contact_phone", "contact_email", "licence_number", "town", "organisation_type", "message", "consent"];

export async function submitApplication(_prev: FormState, formData: FormData): Promise<FormState> {
  const p = Application.safeParse(formFields(formData, NAMES));
  const values = submittedValues(formData, NAMES);
  if (!p.success) return { fieldErrors: fieldErrors(p.error), values };
  let phone: string | null = null;
  if (p.data.contact_phone) {
    phone = normalisePhone(p.data.contact_phone);
    if (!phone) return { fieldErrors: { contact_phone: "Enter a valid phone number, e.g. 0712 345 678 or +254 712 345 678." }, values };
  }
  if (!phone && !p.data.contact_email) return { fieldErrors: { contact_email: "Give us a phone number or email address." }, values };
  if (p.data.kind === "pharmacy" && !p.data.licence_number) return { fieldErrors: { licence_number: "Enter the pharmacy's Pharmacy and Poisons Board premises licence number." }, values };

  const details: Record<string, string> = {};
  for (const k of ["licence_number", "town", "organisation_type", "message"] as const) if (p.data[k]) details[k] = p.data[k]!;
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_partner_application", {
    p_kind: p.data.kind, p_organisation: p.data.organisation_name, p_contact_name: p.data.contact_name,
    p_phone: phone, p_email: p.data.contact_email ?? null, p_details: details,
  });
  if (error) return { error: error.code === "P0001" ? error.message : "We couldn't send your application. Please try again.", values };
  return { ok: "Application received. Our partnerships team reviews every application and will contact you — nothing is activated until checks are complete." };
}
