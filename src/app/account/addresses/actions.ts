"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAccount } from "@/lib/auth/session";
import { fieldErrors, formFields, submittedValues, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

const Coord = (min: number, max: number) => z.coerce.number().finite().min(min).max(max);

const Schema = z
  .object({
    label: z.string({ error: "Give this address a name, like Home or Work." }).trim().min(1, "Give this address a name, like Home or Work.").max(40),
    line1: z.string({ error: "Enter the street or estate." }).trim().min(3, "Enter the street or estate.").max(200),
    area: z.string().trim().max(120).optional(),
    building_details: z.string().trim().max(200).optional(),
    landmark: z.string().trim().max(200).optional(),
    lat: Coord(-90, 90).optional(),
    lng: Coord(-180, 180).optional(),
    is_default: z.literal("on").optional(),
  })
  .refine((v) => (v.lat === undefined) === (v.lng === undefined), { message: "Location is incomplete.", path: ["lat"] });

export async function addAddress(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireAccount("/account/addresses");
  const names = ["label", "line1", "area", "building_details", "landmark", "lat", "lng", "is_default"];
  const parsed = Schema.safeParse(formFields(formData, names));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values: submittedValues(formData, names) };
  const v = parsed.data;

  const supabase = await createClient();
  if (v.is_default) {
    await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id).eq("is_default", true);
  }
  const { error } = await supabase.from("addresses").insert({
    user_id: user.id,
    label: v.label,
    line1: v.line1,
    area: v.area ?? null,
    building_details: v.building_details ?? null,
    landmark: v.landmark ?? null,
    location: v.lat !== undefined && v.lng !== undefined ? `SRID=4326;POINT(${v.lng} ${v.lat})` : null,
    is_default: Boolean(v.is_default),
  });
  if (error) return { error: "We couldn't save this address. Please try again.", values: submittedValues(formData, names) };
  revalidatePath("/account", "layout");
  return { ok: "Address saved." };
}

const Id = z.uuid();

export async function deleteAddress(formData: FormData) {
  await requireAccount("/account/addresses");
  const id = Id.safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.from("addresses").delete().eq("id", id.data); // RLS limits this to the owner's rows
  revalidatePath("/account", "layout");
}

export async function makeDefaultAddress(formData: FormData) {
  const user = await requireAccount("/account/addresses");
  const id = Id.safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id).eq("is_default", true);
  await supabase.from("addresses").update({ is_default: true }).eq("id", id.data);
  revalidatePath("/account", "layout");
}
