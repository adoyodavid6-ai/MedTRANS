"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAccount } from "@/lib/auth/session";
import { fieldErrors, formFields, submittedValues, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

const Apply = z.object({
  full_name: z.string({ error: "Enter your full name as on your ID." }).trim().min(2, "Enter your full name as on your ID.").max(120),
  vehicle_type: z.enum(["on_foot", "bicycle", "motorbike", "car"], { error: "Choose how you will deliver." }),
  driving_licence_number: z.string().trim().min(4, "Enter your driving licence number.").max(40).optional(),
  operating_area: z.string({ error: "Tell us the area you can cover." }).trim().min(2, "Tell us the area you can cover.").max(120),
  accuracy: z.literal("on", { error: "Please confirm these details are accurate." }),
});
const NAMES = ["full_name", "vehicle_type", "driving_licence_number", "operating_area", "accuracy"];

export async function applyAsCourier(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAccount("/join/courier");
  const values = submittedValues(formData, NAMES);
  const p = Apply.safeParse(formFields(formData, NAMES));
  if (!p.success) return { fieldErrors: fieldErrors(p.error), values };
  if (["motorbike", "car"].includes(p.data.vehicle_type) && !p.data.driving_licence_number) {
    return { fieldErrors: { driving_licence_number: "A driving licence number is needed for motorbike or car deliveries." }, values };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("apply_as_courier", {
    p_full_name: p.data.full_name, p_vehicle: p.data.vehicle_type,
    p_licence: ["motorbike", "car"].includes(p.data.vehicle_type) ? p.data.driving_licence_number! : null, p_area: p.data.operating_area,
  });
  if (error) return { error: ["P0001", "22023"].includes(error.code ?? "") ? error.message : "We couldn't save your application. Please try again.", values };
  revalidatePath("/join/courier");
  return { ok: "Application received." };
}
