"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAccount } from "@/lib/auth/session";
import { fieldErrors, formFields, submittedValues, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

const refresh = () => {
  revalidatePath("/ops/emergency-contacts");
  revalidatePath("/emergency");
};

const NewContact = z.object({
  country_code: z.string().regex(/^[A-Z]{2}$/),
  label: z.string({ error: "Enter a label." }).trim().min(1, "Enter a label, e.g. Ambulance and emergency services.").max(80),
  phone_number: z.string({ error: "Enter the number." }).trim().regex(/^\+?[0-9 ]{2,20}$/, "Digits, spaces and an optional leading + only."),
  description: z.string().trim().max(280).optional(),
  source: z.string({ error: "Record where this number was verified." }).trim().min(5, "Record where this number was verified (e.g. the official government page).").max(500),
  verified: z.literal("on", { error: "Only add numbers you have verified yourself against the source." }),
});

export async function addContact(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAccount("/ops/emergency-contacts", ["admin"]);
  const names = ["country_code", "label", "phone_number", "description", "source"];
  const p = NewContact.safeParse(formFields(formData, [...names, "verified"]));
  if (!p.success) return { fieldErrors: fieldErrors(p.error), values: submittedValues(formData, names) };
  const supabase = await createClient();
  // verified_at/verified_by are stamped by the database from the acting admin; it is NOT published yet.
  const { error } = await supabase.from("emergency_contacts").insert({
    country_code: p.data.country_code,
    label: p.data.label,
    phone_number: p.data.phone_number,
    description: p.data.description ?? null,
    source: p.data.source,
    verified_at: new Date().toISOString(),
    is_active: false,
  });
  if (error) return { error: "Not saved." };
  refresh();
  return { ok: "Saved as verified but not yet published. Publish it when you're ready." };
}

const Toggle = z.object({ id: z.uuid(), op: z.enum(["publish", "unpublish", "delete"]), confirm: z.literal("yes") });

export async function changeContact(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAccount("/ops/emergency-contacts", ["admin"]);
  const p = Toggle.safeParse({ id: formData.get("id"), op: formData.get("op"), confirm: formData.get("confirm") });
  if (!p.success) return { error: "Tick the confirmation box to continue." };
  const supabase = await createClient();
  const { error } =
    p.data.op === "delete"
      ? await supabase.from("emergency_contacts").delete().eq("id", p.data.id)
      : await supabase.from("emergency_contacts").update({ is_active: p.data.op === "publish" }).eq("id", p.data.id);
  if (error) return { error: error.code === "23514" ? "Only verified numbers with a source can be published." : "Not saved." };
  refresh();
  return { ok: p.data.op === "publish" ? "Published on Emergency Help." : p.data.op === "unpublish" ? "Removed from Emergency Help." : "Deleted." };
}
