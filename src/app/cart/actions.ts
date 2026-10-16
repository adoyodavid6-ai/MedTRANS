"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSessionUser, requireAccount } from "@/lib/auth/session";
import type { FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

const Add = z.object({ inventory_id: z.uuid(), quantity: z.coerce.number().int().min(1).max(20) });

export async function addToCart(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getSessionUser();
  const slug = String(formData.get("return_to") ?? "/pharmacy/medicines");
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(slug.startsWith("/") ? slug : "/pharmacy")}`);

  const p = Add.safeParse({ inventory_id: formData.get("inventory_id"), quantity: formData.get("quantity") ?? 1 });
  if (!p.success) return { error: "Choose a quantity between 1 and 20." };
  const supabase = await createClient();

  // One pharmacy per cart: the order, prescription review and delivery all belong to one pharmacy.
  const { data: target } = await supabase.from("inventory_items").select("pharmacy_id").eq("id", p.data.inventory_id).maybeSingle();
  if (!target) return { error: "That item is no longer available." };
  const { data: current } = await supabase.from("cart_items").select("inventory_items(pharmacy_id, pharmacies(name))").limit(1);
  const existing = (current?.[0] as { inventory_items?: { pharmacy_id: string; pharmacies?: { name: string } } } | undefined)?.inventory_items;
  if (existing && existing.pharmacy_id !== target.pharmacy_id) {
    return { error: `Your cart already has items from ${existing.pharmacies?.name ?? "another pharmacy"}. Check out or empty your cart first.` };
  }

  const { data: row } = await supabase.from("cart_items").select("quantity").eq("inventory_item_id", p.data.inventory_id).maybeSingle();
  const quantity = Math.min(20, (row?.quantity ?? 0) + p.data.quantity);
  const { error } = await supabase.from("cart_items").upsert({ user_id: user.id, inventory_item_id: p.data.inventory_id, quantity });
  if (error) return { error: "We couldn't add that to your cart. Please try again." };
  revalidatePath("/cart");
  return { ok: "Added to your cart." };
}

export async function setCartQuantity(formData: FormData) {
  const user = await requireAccount("/cart");
  const p = z.object({ inventory_id: z.uuid(), quantity: z.coerce.number().int().min(0).max(20) }).safeParse({
    inventory_id: formData.get("inventory_id"), quantity: formData.get("quantity"),
  });
  if (!p.success) return;
  const supabase = await createClient();
  if (p.data.quantity === 0) await supabase.from("cart_items").delete().eq("inventory_item_id", p.data.inventory_id);
  else await supabase.from("cart_items").update({ quantity: p.data.quantity }).eq("inventory_item_id", p.data.inventory_id).eq("user_id", user.id);
  revalidatePath("/cart");
}

export async function emptyCart() {
  const user = await requireAccount("/cart");
  const supabase = await createClient();
  await supabase.from("cart_items").delete().eq("user_id", user.id);
  revalidatePath("/cart");
}
