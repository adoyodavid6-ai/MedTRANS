"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAccount } from "@/lib/auth/session";
import { fieldErrors, formFields, submittedValues, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

const Schema = z.object({
  full_name: z.string().trim().max(120, "Use 120 characters or fewer.").optional(),
  preferred_language: z.enum(["en", "sw", "so"]),
});

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireAccount("/account/profile");
  const names = ["full_name", "preferred_language"];
  const parsed = Schema.safeParse(formFields(formData, names));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values: submittedValues(formData, names) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.full_name ?? null, preferred_language: parsed.data.preferred_language })
    .eq("id", user.id);
  if (error) return { error: "We couldn't save your profile. Please try again.", values: submittedValues(formData, names) };
  revalidatePath("/account", "layout");
  return { ok: "Profile saved.", values: submittedValues(formData, names) };
}
