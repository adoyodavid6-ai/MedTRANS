"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAccount } from "@/lib/auth/session";
import type { FormState } from "@/lib/forms";
import { initiateWithGateway, payerPhone } from "@/lib/payments/start";
import { createClient } from "@/lib/supabase/server";

const Start = z.object({ order_id: z.uuid(), provider: z.enum(["mpesa", "test"]), idempotency_key: z.uuid(), phone: z.string().optional() });

export async function startPayment(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAccount("/account/orders");
  const p = Start.safeParse({
    order_id: formData.get("order_id"), provider: formData.get("provider"),
    idempotency_key: formData.get("idempotency_key"), phone: (formData.get("phone") as string) || undefined,
  });
  if (!p.success) return { error: "Choose how to pay." };
  const { phone, error: phoneError } = payerPhone(p.data.provider, p.data.phone);
  if (phoneError) return phoneError;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_payment", {
    p_order: p.data.order_id, p_provider: p.data.provider, p_phone: phone, p_idempotency_key: p.data.idempotency_key,
  });
  const row = (data as { payment_id: string; amount_minor: number; currency: string; status: string }[] | null)?.[0];
  if (error || !row) return { error: error?.code === "P0001" ? error.message : "We couldn't start the payment. You have not been charged." };
  const { data: order } = await supabase.from("orders").select("order_number").eq("id", p.data.order_id).single();
  const result = await initiateWithGateway(row, p.data.provider, phone, order?.order_number ?? "");
  revalidatePath(`/orders/${p.data.order_id}`);
  return result;
}

export async function cancelOrder(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAccount("/account/orders");
  const id = z.uuid().safeParse(formData.get("order_id"));
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 300);
  if (!id.success) return { error: "Unknown order." };
  if (!reason) return { fieldErrors: { reason: "Tell us briefly why you are cancelling." } };
  const supabase = await createClient();
  const { data: o } = await supabase.from("orders").select("status").eq("id", id.data).single();
  const to = o?.status === "pending_payment" ? "cancelled" : "refund_processing";
  const { error } = await supabase.rpc("transition_order", { p_order: id.data, p_to: to, p_note: reason });
  if (error) return { error: error.code === "P0001" ? "This order can no longer be cancelled here. Contact support." : "We couldn't cancel the order." };
  revalidatePath(`/orders/${id.data}`);
  return { ok: to === "cancelled" ? "Order cancelled. You have not been charged." : "Order cancelled. Your refund is being arranged." };
}
