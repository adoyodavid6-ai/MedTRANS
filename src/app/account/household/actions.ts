"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAccount } from "@/lib/auth/session";
import { fieldErrors, formFields, submittedValues, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import { RELATIONSHIPS } from "./relationships";

const Schema = z.object({
  full_name: z.string({ error: "Enter their name." }).trim().min(1, "Enter their name.").max(120),
  relationship: z.enum(Object.keys(RELATIONSHIPS) as [keyof typeof RELATIONSHIPS, ...(keyof typeof RELATIONSHIPS)[]], {
    error: "Choose how they're related to you.",
  }),
  date_of_birth: z.iso
    .date({ error: "Enter a valid date." })
    .refine((d) => new Date(d) <= new Date(), "Date of birth can't be in the future.")
    .optional(),
  authority: z.literal("on", { error: "Please confirm you're authorised to arrange care for this person." }),
});

export async function addHouseholdMember(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireAccount("/account/household");
  const names = ["full_name", "relationship", "date_of_birth", "authority"];
  const parsed = Schema.safeParse(formFields(formData, names));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values: submittedValues(formData, names) };

  const supabase = await createClient();
  const { error } = await supabase.from("household_members").insert({
    owner_id: user.id,
    full_name: parsed.data.full_name,
    relationship: parsed.data.relationship,
    date_of_birth: parsed.data.date_of_birth ?? null,
    authority_confirmed_at: new Date().toISOString(),
  });
  if (error) return { error: "We couldn't add this person. Please try again.", values: submittedValues(formData, names) };
  revalidatePath("/account", "layout");
  return { ok: "Household member added." };
}

export async function removeHouseholdMember(formData: FormData) {
  await requireAccount("/account/household");
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.from("household_members").delete().eq("id", id.data);
  revalidatePath("/account", "layout");
}
