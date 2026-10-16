import "server-only";
import { normalisePhone } from "@/lib/auth/identifier";
import type { FormState } from "@/lib/forms";
import { gatewayFor } from "@/lib/payments";
import type { PaymentProvider } from "@/lib/payments/types";
import { createServiceClient } from "@/lib/supabase/service";

/** Shared second half of starting a payment: call the gateway, then record the reference (or the failure). */
export async function initiateWithGateway(
  row: { payment_id: string; amount_minor: number; currency: string; status: string },
  provider: PaymentProvider, phone: string | null, reference: string,
): Promise<FormState> {
  if (row.status !== "initiated") return { ok: "Payment request already sent." };
  const gateway = gatewayFor(provider)!;
  const result = await gateway.initiate({ paymentId: row.payment_id, orderNumber: reference, amountMinor: row.amount_minor, currency: row.currency, payerPhone: phone });
  const service = createServiceClient();
  if (!result.ok) {
    await service.rpc("fail_payment_start", { p_payment: row.payment_id, p_reason: result.reason });
    return { error: `${result.reason} You have not been charged.` };
  }
  await service.rpc("attach_payment_reference", { p_payment: row.payment_id, p_reference: result.providerReference });
  return { ok: result.customerMessage };
}

export function payerPhone(provider: PaymentProvider, raw: string | undefined): { phone: string | null; error?: FormState } {
  const gateway = gatewayFor(provider);
  if (!gateway) return { phone: null, error: { error: "That payment method is not available." } };
  if (!gateway.needsPhone) return { phone: null };
  const phone = raw ? normalisePhone(raw) : null;
  if (!phone) return { phone: null, error: { fieldErrors: { phone: "Enter the M-Pesa number to pay from, e.g. 0712 345 678." }, values: { phone: raw ?? "" } } };
  return { phone };
}
