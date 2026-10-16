"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAccount } from "@/lib/auth/session";
import type { FormState } from "@/lib/forms";
import { initiateWithGateway, payerPhone } from "@/lib/payments/start";
import { createClient } from "@/lib/supabase/server";

const Start = z.object({ booking_id: z.uuid(), provider: z.enum(["mpesa", "test"]), idempotency_key: z.uuid(), phone: z.string().optional() });

export async function startBookingPayment(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAccount("/account/bookings");
  const p = Start.safeParse({
    booking_id: formData.get("booking_id"), provider: formData.get("provider"),
    idempotency_key: formData.get("idempotency_key"), phone: (formData.get("phone") as string) || undefined,
  });
  if (!p.success) return { error: "Choose how to pay." };
  const { phone, error: phoneError } = payerPhone(p.data.provider, p.data.phone);
  if (phoneError) return phoneError;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_booking_payment", {
    p_booking: p.data.booking_id, p_provider: p.data.provider, p_phone: phone, p_idempotency_key: p.data.idempotency_key,
  });
  const row = (data as { payment_id: string; amount_minor: number; currency: string; status: string }[] | null)?.[0];
  if (error || !row) return { error: error?.code === "P0001" ? error.message : "We couldn't start the payment. You have not been charged." };
  const { data: b } = await supabase.from("care_bookings").select("booking_number").eq("id", p.data.booking_id).single();
  const result = await initiateWithGateway(row, p.data.provider, phone, b?.booking_number ?? "");
  revalidatePath(`/bookings/${p.data.booking_id}`);
  return result;
}

export async function cancelBooking(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAccount("/account/bookings");
  const id = z.uuid().safeParse(formData.get("booking_id"));
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 300);
  if (!id.success) return { error: "Unknown booking." };
  if (!reason) return { fieldErrors: { reason: "Tell us briefly why you are cancelling." } };
  const supabase = await createClient();
  const { data: b } = await supabase.from("care_bookings").select("status").eq("id", id.data).single();
  const to = b && ["awaiting_acceptance", "awaiting_payment"].includes(b.status) ? "cancelled" : "refund_processing";
  const { error } = await supabase.rpc("transition_booking", { p_booking: id.data, p_to: to, p_note: reason });
  if (error) return { error: error.code === "P0001" ? "This booking can no longer be cancelled here. Contact support." : "We couldn't cancel the booking." };
  revalidatePath(`/bookings/${id.data}`);
  return { ok: to === "cancelled" ? "Booking cancelled. You have not been charged." : "Booking cancelled. Your refund is being arranged." };
}
