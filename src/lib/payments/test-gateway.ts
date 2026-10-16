import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { recordOutcome, sha256 } from "./record";
import type { PaymentGateway } from "./types";

/**
 * TEST payment gateway for local development and automated tests. No money moves.
 * It is only available when PAYMENTS_TEST_MODE=enabled, the site runs on localhost, and the host
 * is not a Vercel production deployment (see isTestGatewayEnabled). Its callbacks are HMAC-signed and go through the same
 * replay protection and amount checks as a real provider.
 */
function siteIsLocal() {
  try {
    return ["localhost", "127.0.0.1"].includes(new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost").hostname);
  } catch {
    return false;
  }
}

export function isTestGatewayEnabled() {
  return process.env.PAYMENTS_TEST_MODE === "enabled" && Boolean(process.env.PAYMENTS_TEST_WEBHOOK_SECRET) &&
    process.env.VERCEL_ENV !== "production" && siteIsLocal();
}

export const testGateway: PaymentGateway = {
  provider: "test",
  label: "Test payment (no money moves)",
  needsPhone: false,
  async initiate() {
    return { ok: true, providerReference: `TEST-${randomUUID()}`, customerMessage: "Test payment created. Choose an outcome below." };
  },
};

function secret() {
  const s = process.env.PAYMENTS_TEST_WEBHOOK_SECRET;
  if (!s) throw new Error("PAYMENTS_TEST_WEBHOOK_SECRET is not set");
  return s;
}

export function signTestPayload(body: string, timestamp: number) {
  return createHmac("sha256", secret()).update(`${timestamp}.${body}`).digest("hex");
}

export type TestWebhookBody = { eventId: string; reference: string; success: boolean; amountMinor: number; reason?: string };

/** Verifies and records a signed test callback. Rejects bad signatures and stale timestamps (replay window 5 min). */
export async function handleTestWebhook(rawBody: string, signature: string | null, timestampHeader: string | null) {
  if (!isTestGatewayEnabled()) return { status: 404, outcome: "disabled" };
  const ts = Number(timestampHeader);
  if (!signature || !Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return { status: 401, outcome: "stale_or_unsigned" };
  const expected = Buffer.from(signTestPayload(rawBody, ts), "hex");
  const given = Buffer.from(signature, "hex");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { status: 401, outcome: "bad_signature" };

  let body: TestWebhookBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return { status: 400, outcome: "bad_json" };
  }
  const outcome = await recordOutcome({
    provider: "test",
    eventKey: body.eventId,
    payloadSha256: sha256(rawBody),
    providerReference: body.reference,
    success: body.success,
    amountMinor: body.amountMinor,
    receipt: body.success ? `TESTRCPT-${body.eventId.slice(0, 8)}` : null,
    reason: body.reason ?? null,
  });
  return { status: 200, outcome };
}
