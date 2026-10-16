"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAccount } from "@/lib/auth/session";
import type { FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

const ROLES = ["pharmacist", "pharmacy_admin"] as const;

const Review = z.object({
  prescription_id: z.uuid(),
  decision: z.enum(["approved", "clarification_needed", "rejected"]),
  note: z.string().trim().max(1000).optional(),
  valid_until: z.iso.date().optional(),
});

export async function reviewPrescription(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAccount("/portal/pharmacy/prescriptions", ROLES);
  const p = Review.safeParse({
    prescription_id: formData.get("prescription_id"), decision: formData.get("decision"),
    note: (formData.get("note") as string) || undefined, valid_until: (formData.get("valid_until") as string) || undefined,
  });
  if (!p.success) return { error: "Check the decision details." };
  const items = [...formData.entries()]
    .filter(([k]) => k.startsWith("approve:"))
    .map(([k, v]) => ({ product_id: k.slice(8), quantity_approved: Number(v) }));
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_prescription", {
    p_prescription: p.data.prescription_id, p_decision: p.data.decision, p_note: p.data.note ?? null,
    p_valid_until: p.data.valid_until ?? null, p_items: p.data.decision === "approved" ? items : null,
  });
  if (error) return { error: ["P0001", "22023", "42501"].includes(error.code ?? "") ? error.message : "The decision was not saved." };
  revalidatePath("/portal/pharmacy/prescriptions");
  return { ok: "Decision saved. The patient can see it now." };
}

const Move = z.object({ order_id: z.uuid(), to: z.enum(["confirmed", "preparing", "ready_for_dispatch", "refund_processing"]), note: z.string().trim().max(500).optional() });

export async function moveOrder(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAccount("/portal/pharmacy/orders", ROLES);
  const p = Move.safeParse({ order_id: formData.get("order_id"), to: formData.get("to"), note: (formData.get("note") as string) || undefined });
  if (!p.success) return { error: "Unknown action." };
  if (p.data.to === "refund_processing" && !p.data.note) return { error: "Give the patient a reason for declining." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("transition_order", { p_order: p.data.order_id, p_to: p.data.to, p_note: p.data.note ?? null });
  if (error) return { error: error.code === "P0001" || error.code === "42501" ? error.message : "Not saved." };
  revalidatePath("/portal/pharmacy/orders");
  return { ok: "Updated." };
}

const Stock = z.object({ id: z.uuid(), price: z.coerce.number().positive().max(1_000_000), quantity: z.coerce.number().int().min(0).max(100000), listed: z.enum(["on"]).optional() });

export async function updateStock(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAccount("/portal/pharmacy/inventory", ROLES);
  const p = Stock.safeParse({ id: formData.get("id"), price: formData.get("price"), quantity: formData.get("quantity"), listed: formData.get("listed") ?? undefined });
  if (!p.success) return { error: "Enter a price above zero and a whole-number quantity." };
  const supabase = await createClient();
  const { error } = await supabase.from("inventory_items")
    .update({ price_minor: Math.round(p.data.price * 100), quantity_available: p.data.quantity, is_listed: Boolean(p.data.listed) })
    .eq("id", p.data.id);
  if (error) return { error: "Not saved." };
  revalidatePath("/portal/pharmacy/inventory");
  return { ok: "Saved and stamped as confirmed now." };
}

const NewItem = z.object({ pharmacy_id: z.uuid(), product_id: z.uuid(), price: z.coerce.number().positive().max(1_000_000), quantity: z.coerce.number().int().min(0).max(100000) });

export async function listProduct(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAccount("/portal/pharmacy/inventory", ROLES);
  const p = NewItem.safeParse({ pharmacy_id: formData.get("pharmacy_id"), product_id: formData.get("product_id"), price: formData.get("price"), quantity: formData.get("quantity") });
  if (!p.success) return { error: "Choose a product, a price and a quantity." };
  const supabase = await createClient();
  const { error } = await supabase.from("inventory_items").insert({
    pharmacy_id: p.data.pharmacy_id, product_id: p.data.product_id, price_minor: Math.round(p.data.price * 100), quantity_available: p.data.quantity,
  });
  if (error) return { error: error.code === "23505" ? "That product is already in your inventory." : "Not saved." };
  revalidatePath("/portal/pharmacy/inventory");
  return { ok: "Product listed." };
}
