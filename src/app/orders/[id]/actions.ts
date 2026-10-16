"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { normalisePhone } from "@/lib/auth/identifier";
import { requireAccount } from "@/lib/auth/session";
import type { FormState } from "@/lib/forms";
import { gatewayFor } from "@/lib/payments";
import { handleTestWebhook, isTestGatewayEnabled, signTestPayload } from "@/lib/payments/test-gateway";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const Start = z.object({ order_id: z.uuid(), provider: z.enum(["mpesa", "test"]), idempotency_key: z.uuid(), phone: z.string().optional() });

export async function startPayment(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAccount("/account/orders");
  const p = Start.safeParse({
    order_id: formData.get("order_id"), provider: formData.get("provider"),
    idempotency_key: formData.get("idempotency_key"), phone: (formData.get("phone") as string) || undefined,
  });
  if (!p.success) return { error: "Choose how to pay." };
  const gateway = gatewayFor(p.data.provider);
  if (!gateway) return { error: "That payment method is not available." };

  let phone: string | null = null;
  if (gateway.needsPhone) {
    phone = p.data.phone ? normalisePhone(p.data.phone) : null;
    if (!phone) return { fieldErrors: { phone: "Enter the M-Pesa number to pay from, e.g. 0712 345 678." }, values: { phone: p.data.phone ?? "" } };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_payment", {
    p_order: p.data.order_id, p_provider: p.data.provider, p_phone: phone, p_idempotency_key: p.data.idempotency_key,
  });
  const row = (data as { payment_id: string; amount_minor: number; currency: string; status: string }[] | null)?.[0];
  if (error || !row) return { error: error?.code === "P0001" ? error.message : "We couldn't start the payment. You have not been charged." };
  if (row.status !== "initiated") return { ok: "Payment request already sent." };

  const { data: order } = await supabase.from("orders").select("order_number").eq("id", p.data.order_id).single();
  const result = await gateway.initiate({
    paymentId: row.payment_id, orderNumber: order?.order_number ?? "", amountMinor: row.amount_minor, currency: row.currency, payerPhone: phone,
  });
  const service = createServiceClient();
  if (!result.ok) {
    await service.rpc("fail_payment_start", { p_payment: row.payment_id, p_reason: result.reason });
    revalidatePath(`/orders/${p.data.order_id}`);
    return { error: `${result.reason} You have not been charged.` };
  }
  await service.rpc("attach_payment_reference", { p_payment: row.payment_id, p_reference: result.providerReference });
  revalidatePath(`/orders/${p.data.order_id}`);
  return { ok: result.customerMessage };
}

/**
 * TEST GATEWAY ONLY: plays the provider's part by sending a signed callback through the
 * same verification code a real webhook uses. Unavailable unless the test gateway is enabled.
 */
export async function simulateTestPayment(formData: FormData) {
  if (!isTestGatewayEnabled()) return;
  await requireAccount("/account/orders");
  const paymentId = z.uuid().safeParse(formData.get("payment_id"));
  if (!paymentId.success) return;
  const supabase = await createClient();
  // RLS: only the paying patient can see this payment.
  const { data: pay } = await supabase.from("payments").select("id, order_id, provider, provider_reference, amount_minor, status").eq("id", paymentId.data).maybeSingle();
  if (!pay || pay.provider !== "test" || pay.status !== "pending" || !pay.provider_reference) return;

  const success = formData.get("outcome") === "success";
  const body = JSON.stringify({
    eventId: randomUUID(), reference: pay.provider_reference, success, amountMinor: pay.amount_minor,
    reason: success ? undefined : "Declined in the test gateway.",
  });
  const ts = Math.floor(Date.now() / 1000);
  await handleTestWebhook(body, signTestPayload(body, ts), String(ts));
  revalidatePath(`/orders/${pay.order_id}`);
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
