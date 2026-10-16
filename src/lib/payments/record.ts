import "server-only";
import { createHash } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";
import type { VerifiedOutcome } from "./types";

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Records an authenticated provider outcome. Idempotent: replays return "duplicate". */
export async function recordOutcome(o: VerifiedOutcome): Promise<string> {
  const { data, error } = await createServiceClient().rpc("record_payment_result", {
    p_provider: o.provider,
    p_event_key: o.eventKey,
    p_payload_sha256: o.payloadSha256,
    p_reference: o.providerReference,
    p_success: o.success,
    p_amount_minor: o.amountMinor,
    p_receipt: o.receipt,
    p_reason: o.reason,
  });
  if (error) throw new Error(`record_payment_result failed: ${error.message}`);
  return data as string;
}
