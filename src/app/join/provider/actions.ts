"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAccount } from "@/lib/auth/session";
import { fieldErrors, formFields, submittedValues, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

const Apply = z.object({
  profession: z.enum(["doctor", "nurse"], { error: "Choose your profession." }),
  display_name: z.string({ error: "Enter your name as patients should see it." }).trim().min(2).max(120),
  regulator: z.string({ error: "Name your regulator." }).trim().min(2).max(120),
  registration_number: z.string({ error: "Enter your registration number." }).trim().min(2).max(60),
  years_experience: z.coerce.number().int().min(0).max(60).optional(),
  accuracy: z.literal("on", { error: "Please confirm these details are accurate." }),
});

export async function applyAsProvider(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireAccount("/join/provider");
  const names = ["profession", "display_name", "regulator", "registration_number", "years_experience", "accuracy"];
  const p = Apply.safeParse(formFields(formData, names));
  if (!p.success) return { fieldErrors: fieldErrors(p.error), values: submittedValues(formData, names) };
  const languages = formData.getAll("languages").map(String).filter((l) => ["en", "sw", "so", "fr", "ar"].includes(l));
  const supabase = await createClient();
  const { error } = await supabase.from("provider_profiles").insert({
    user_id: user.id, profession: p.data.profession, display_name: p.data.display_name, regulator: p.data.regulator,
    registration_number: p.data.registration_number, years_experience: p.data.years_experience ?? null,
    languages: languages.length ? languages : ["en"], verification_status: "pending",
  });
  if (error) return { error: error.code === "23505" ? "You have already applied." : "We couldn't save your application.", values: submittedValues(formData, names) };
  revalidatePath("/join/provider");
  return { ok: "Application received." };
}
