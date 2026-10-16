"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAccount } from "@/lib/auth/session";
import { handleTestWebhook, isTestGatewayEnabled, signTestPayload } from "@/lib/payments/test-gateway";
import { createClient } from "@/lib/supabase/server";

/**
 * TEST GATEWAY ONLY: plays the provider's part by sending a signed callback through the same
 * verification code a real webhook uses. Does nothing unless the test gateway is enabled.
 */
export async function simulateTestPayment(formData: FormData) {
  if (!isTestGatewayEnabled()) return;
  await requireAccount("/account");
  const paymentId = z.uuid().safeParse(formData.get("payment_id"));
  if (!paymentId.success) return;
  const supabase = await createClient();
  // RLS: only the paying patient can see this payment.
  const { data: pay } = await supabase.from("payments").select("id, order_id, booking_id, provider, provider_reference, amount_minor, status").eq("id", paymentId.data).maybeSingle();
  if (!pay || pay.provider !== "test" || pay.status !== "pending" || !pay.provider_reference) return;
  const success = formData.get("outcome") === "success";
  const body = JSON.stringify({ eventId: randomUUID(), reference: pay.provider_reference, success, amountMinor: pay.amount_minor, reason: success ? undefined : "Declined in the test gateway." });
  const ts = Math.floor(Date.now() / 1000);
  await handleTestWebhook(body, signTestPayload(body, ts), String(ts));
  revalidatePath(pay.order_id ? `/orders/${pay.order_id}` : `/bookings/${pay.booking_id}`);
}
