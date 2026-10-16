"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { normalisePhone } from "@/lib/auth/identifier";
import { requireAccount } from "@/lib/auth/session";
import { fieldErrors, formFields, submittedValues, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

const ADMIN = ["admin"] as const;
const dbError = (e: { code?: string; message: string } | null) =>
  e ? (["P0001", "22023", "23514", "23505"].includes(e.code ?? "") ? e.message : "Not saved.") : undefined;

const NewPharmacy = z.object({
  name: z.string({ error: "Enter the pharmacy name." }).trim().min(2).max(120),
  slug: z.string({ error: "Enter a web address name." }).trim().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Lowercase letters, numbers and hyphens only."),
  address_line: z.string({ error: "Enter the address." }).trim().min(3).max(200),
  lat: z.coerce.number({ error: "Enter the latitude." }).min(-90).max(90),
  lng: z.coerce.number({ error: "Enter the longitude." }).min(-180).max(180),
  phone: z.string().trim().max(20).optional(),
  area_id: z.uuid().optional(),
});

export async function createPharmacy(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAccount("/ops/pharmacies", ADMIN);
  const names = ["name", "slug", "address_line", "lat", "lng", "phone", "area_id"];
  const p = NewPharmacy.safeParse(formFields(formData, names));
  if (!p.success) return { fieldErrors: fieldErrors(p.error), values: submittedValues(formData, names) };
  const supabase = await createClient();
  const { data, error } = await supabase.from("pharmacies").insert({
    name: p.data.name, slug: p.data.slug, address_line: p.data.address_line, country_code: "KE", area_id: p.data.area_id ?? null,
    location: `SRID=4326;POINT(${p.data.lng} ${p.data.lat})`, phone: p.data.phone ?? null,
  }).select("id").single();
  if (error) return { error: error.code === "23505" ? "That web address name is taken." : "Not saved.", values: submittedValues(formData, names) };
  redirect(`/ops/pharmacies/${data.id}`);
}

const Settings = z.object({
  id: z.uuid(),
  verification_status: z.enum(["unverified", "pending", "verified", "suspended"]),
  is_listed: z.enum(["on"]).optional(),
  is_accepting_orders: z.enum(["on"]).optional(),
  delivery_radius_km: z.coerce.number().min(0.1).max(50).optional(),
  delivery_fee: z.coerce.number().min(0).max(100000).optional(),
  verified_hours: z.string().trim().max(300).optional(),
  area_id: z.uuid().optional(),
  confirm: z.literal("yes", { error: "Tick the confirmation box." }),
});

export async function updatePharmacy(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAccount("/ops/pharmacies", ADMIN);
  const p = Settings.safeParse(formFields(formData, ["id", "verification_status", "is_listed", "is_accepting_orders", "delivery_radius_km", "delivery_fee", "verified_hours", "area_id", "confirm"]));
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Check the details." };
  const supabase = await createClient();
  const { error } = await supabase.from("pharmacies").update({
    verification_status: p.data.verification_status,
    is_listed: Boolean(p.data.is_listed),
    is_accepting_orders: Boolean(p.data.is_accepting_orders),
    delivery_radius_m: p.data.delivery_radius_km ? Math.round(p.data.delivery_radius_km * 1000) : null,
    delivery_fee_minor: p.data.delivery_fee !== undefined ? Math.round(p.data.delivery_fee * 100) : null,
    verified_hours: p.data.verified_hours ?? null,
    area_id: p.data.area_id ?? null,
  }).eq("id", p.data.id);
  revalidatePath(`/ops/pharmacies/${p.data.id}`);
  return error ? { error: dbError(error) } : { ok: "Saved." };
}

const Licence = z.object({
  pharmacy_id: z.uuid(),
  licence_number: z.string({ error: "Enter the licence number." }).trim().min(2).max(60),
  valid_until: z.iso.date({ error: "Enter the expiry date." }),
  check_method: z.string({ error: "Record how you checked it." }).trim().min(5, "Record how you checked it (e.g. PPB register search, date).").max(300),
  verified: z.literal("on", { error: "Only record a licence you have checked with the regulator." }),
});

export async function addLicence(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAccount("/ops/pharmacies", ADMIN);
  const names = ["pharmacy_id", "licence_number", "valid_until", "check_method", "verified"];
  const p = Licence.safeParse(formFields(formData, names));
  if (!p.success) return { fieldErrors: fieldErrors(p.error), values: submittedValues(formData, names) };
  const supabase = await createClient();
  const { error } = await supabase.from("pharmacy_licences").insert({
    pharmacy_id: p.data.pharmacy_id, licence_number: p.data.licence_number, valid_until: p.data.valid_until, check_method: p.data.check_method, status: "verified",
  });
  revalidatePath(`/ops/pharmacies/${p.data.pharmacy_id}`);
  return error ? { error: dbError(error) } : { ok: "Licence recorded as verified by you." };
}

const Staff = z.object({
  pharmacy_id: z.uuid(),
  phone: z.string({ error: "Enter their sign-in number." }),
  staff_role: z.enum(["pharmacist", "manager", "dispatcher"]),
  registration_number: z.string().trim().max(60).optional(),
  registration_verified: z.enum(["on"]).optional(),
});

export async function addStaff(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAccount("/ops/pharmacies", ADMIN);
  const names = ["pharmacy_id", "phone", "staff_role", "registration_number", "registration_verified"];
  const p = Staff.safeParse(formFields(formData, names));
  if (!p.success) return { fieldErrors: fieldErrors(p.error), values: submittedValues(formData, names) };
  const phone = normalisePhone(p.data.phone);
  if (!phone) return { fieldErrors: { phone: "Enter a valid mobile number." }, values: submittedValues(formData, names) };
  if (p.data.staff_role === "pharmacist" && p.data.registration_verified && !p.data.registration_number) {
    return { fieldErrors: { registration_number: "Enter the registration number you checked." }, values: submittedValues(formData, names) };
  }
  const supabase = await createClient();
  const { data: users } = await supabase.rpc("admin_list_users", { search: phone.slice(1), max_rows: 2 });
  const target = ((users ?? []) as { id: string; phone: string | null }[]).find((u) => u.phone && `+${u.phone.replace(/^\+/, "")}` === phone);
  if (!target) return { fieldErrors: { phone: "No account uses that number. Ask them to sign up first." }, values: submittedValues(formData, names) };

  const { error } = await supabase.from("pharmacy_staff").insert({
    pharmacy_id: p.data.pharmacy_id, user_id: target.id, staff_role: p.data.staff_role,
    registration_number: p.data.registration_number ?? null,
    registration_status: p.data.staff_role === "pharmacist" && p.data.registration_verified ? "verified" : "unverified",
  });
  if (error) return { error: error.code === "23505" ? "They already have that role here." : "Not saved." };
  const role = p.data.staff_role === "pharmacist" ? "pharmacist" : "pharmacy_admin";
  await supabase.rpc("admin_grant_role", { target: target.id, r: role });
  revalidatePath(`/ops/pharmacies/${p.data.pharmacy_id}`);
  return { ok: "Staff member added." };
}

const Product = z.object({
  name: z.string({ error: "Enter the product name." }).trim().min(2).max(160),
  generic_name: z.string({ error: "Enter the generic name." }).trim().min(2).max(160),
  brand: z.string().trim().max(120).optional(),
  strength: z.string({ error: "Enter the strength." }).trim().min(1).max(60),
  dosage_form: z.string({ error: "Enter the dosage form." }).trim().min(2).max(60),
  pack_size: z.string({ error: "Enter the pack size." }).trim().min(1).max(60),
  manufacturer: z.string().trim().max(160).optional(),
  requires_prescription: z.enum(["yes", "no"], { error: "Say whether it needs a prescription." }),
  is_controlled: z.enum(["on"]).optional(),
  vat_rate_percent: z.coerce.number().min(0).max(100).optional(),
});

export async function createProduct(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAccount("/ops/catalogue", ADMIN);
  const names = ["name", "generic_name", "brand", "strength", "dosage_form", "pack_size", "manufacturer", "requires_prescription", "is_controlled", "vat_rate_percent"];
  const p = Product.safeParse(formFields(formData, names));
  if (!p.success) return { fieldErrors: fieldErrors(p.error), values: submittedValues(formData, names) };
  const slug = `${p.data.name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
  const supabase = await createClient();
  const { error } = await supabase.from("medicine_products").insert({
    slug, name: p.data.name, generic_name: p.data.generic_name, brand: p.data.brand ?? null, strength: p.data.strength,
    dosage_form: p.data.dosage_form, pack_size: p.data.pack_size, manufacturer: p.data.manufacturer ?? null,
    requires_prescription: p.data.requires_prescription === "yes", is_controlled: Boolean(p.data.is_controlled),
    vat_rate_bps: p.data.vat_rate_percent !== undefined ? Math.round(p.data.vat_rate_percent * 100) : null, is_active: true,
  });
  if (error) return { error: error.code === "23505" ? "A product with that name already exists." : "Not saved.", values: submittedValues(formData, names) };
  revalidatePath("/ops/catalogue");
  return { ok: "Product added to the catalogue." };
}

export async function dispatchAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAccount("/ops/orders", ADMIN);
  const id = z.uuid().safeParse(formData.get("order_id"));
  if (!id.success) return { error: "Unknown order." };
  const supabase = await createClient();
  const op = formData.get("op");
  let error: { code?: string; message: string } | null = null;
  if (op === "assign") {
    const courier = z.uuid().safeParse(formData.get("courier_id"));
    if (!courier.success) return { error: "Choose a delivery partner." };
    ({ error } = await supabase.rpc("assign_courier", { p_order: id.data, p_courier: courier.data }));
  } else if (op === "unassign" || op === "reattempt") {
    ({ error } = await supabase.rpc("transition_order", { p_order: id.data, p_to: "ready_for_dispatch", p_note: op === "reattempt" ? "Re-attempting delivery." : "Delivery partner unassigned." }));
  } else if (op === "refund_needed") {
    const note = String(formData.get("note") ?? "").trim();
    if (!note) return { error: "Give a reason." };
    ({ error } = await supabase.rpc("transition_order", { p_order: id.data, p_to: "refund_processing", p_note: note }));
  } else if (op === "refunded") {
    const ref = String(formData.get("reference") ?? "").trim();
    if (!ref) return { error: "Enter the provider's refund reference." };
    ({ error } = await supabase.rpc("record_refund", { p_order: id.data, p_reference: ref }));
  } else return { error: "Unknown action." };
  revalidatePath("/ops/orders");
  return error ? { error: dbError(error) ?? error.message } : { ok: "Done." };
}

const Courier = z.object({ user_id: z.uuid(), status: z.enum(["verified", "suspended", "unverified"]), check_method: z.string().trim().max(300).optional(), confirm: z.literal("yes") });

export async function setCourierStatus(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAccount("/ops/couriers", ADMIN);
  const p = Courier.safeParse(formFields(formData, ["user_id", "status", "check_method", "confirm"]));
  if (!p.success) return { error: "Tick the confirmation box." };
  if (p.data.status === "verified" && !p.data.check_method) return { error: "Record how you checked their identity." };
  const supabase = await createClient();
  const { error } = await supabase.from("courier_profiles").upsert({
    user_id: p.data.user_id, verification_status: p.data.status, check_method: p.data.check_method ?? null, is_available: p.data.status === "verified",
  });
  revalidatePath("/ops/couriers");
  return error ? { error: dbError(error) } : { ok: "Saved." };
}
