import "server-only";
import { timingSafeEqual } from "node:crypto";
import { recordOutcome, sha256 } from "./record";
import type { PaymentGateway } from "./types";

/**
 * M-Pesa Daraja (STK Push / Lipa na M-Pesa Online) adapter.
 *
 * STATUS: written against the Daraja API, NOT yet exercised against the Safaricom sandbox
 * (no credentials in this environment). Do not treat as production-ready until it has
 * passed a sandbox run. Required: [[ENV: MPESA_*]] in docs/SETUP-CHECKLIST.md.
 *
 * Security model: Daraja callbacks are not signed. We therefore
 *   1. accept callbacks only on a secret, unguessable path token (MPESA_CALLBACK_TOKEN), and
 *   2. never trust the callback alone: we re-query the transaction status from Daraja
 *      (STK Push Query) and only record success if Daraja confirms it.
 * Amount matching and replay protection then happen in record_payment_result().
 */

type MpesaConfig = {
  baseUrl: string;
  consumerKey: string;
  consumerSecret: string;
  shortcode: string;
  passkey: string;
  callbackUrl: string;
  callbackToken: string;
};

export function mpesaConfig(): MpesaConfig | null {
  const e = process.env;
  if (!e.MPESA_CONSUMER_KEY || !e.MPESA_CONSUMER_SECRET || !e.MPESA_SHORTCODE || !e.MPESA_PASSKEY || !e.MPESA_CALLBACK_BASE_URL || !e.MPESA_CALLBACK_TOKEN) {
    return null;
  }
  return {
    baseUrl: e.MPESA_ENV === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke",
    consumerKey: e.MPESA_CONSUMER_KEY,
    consumerSecret: e.MPESA_CONSUMER_SECRET,
    shortcode: e.MPESA_SHORTCODE,
    passkey: e.MPESA_PASSKEY,
    callbackToken: e.MPESA_CALLBACK_TOKEN,
    callbackUrl: `${e.MPESA_CALLBACK_BASE_URL.replace(/\/$/, "")}/api/payments/mpesa/callback/${e.MPESA_CALLBACK_TOKEN}`,
  };
}

/** Daraja timestamp, yyyyMMddHHmmss in East Africa Time. */
export function darajaTimestamp(d = new Date()) {
  const eat = new Date(d.getTime() + 3 * 3600 * 1000);
  return eat.toISOString().replace(/[-:T]/g, "").slice(0, 14);
}

export function stkPassword(shortcode: string, passkey: string, timestamp: string) {
  return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");
}

/** Daraja expects whole shillings and the payer as 2547XXXXXXXX. */
export function toDarajaAmount(minor: number) {
  if (minor % 100 !== 0) throw new Error("M-Pesa only accepts whole shillings");
  return minor / 100;
}
export function toDarajaPhone(e164: string) {
  const d = e164.replace(/\D/g, "");
  if (!/^254[17]\d{8}$/.test(d)) throw new Error("M-Pesa needs a Kenyan mobile number");
  return d;
}

export function buildStkPushBody(c: MpesaConfig, input: { amountMinor: number; phone: string; orderNumber: string }, timestamp = darajaTimestamp()) {
  return {
    BusinessShortCode: c.shortcode,
    Password: stkPassword(c.shortcode, c.passkey, timestamp),
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: toDarajaAmount(input.amountMinor),
    PartyA: toDarajaPhone(input.phone),
    PartyB: c.shortcode,
    PhoneNumber: toDarajaPhone(input.phone),
    CallBackURL: c.callbackUrl,
    AccountReference: input.orderNumber.slice(0, 12),
    TransactionDesc: "MedTRANS order",
  };
}

async function accessToken(c: MpesaConfig) {
  const res = await fetch(`${c.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${Buffer.from(`${c.consumerKey}:${c.consumerSecret}`).toString("base64")}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Daraja auth failed (${res.status})`);
  return ((await res.json()) as { access_token: string }).access_token;
}

export const mpesaGateway: PaymentGateway = {
  provider: "mpesa",
  label: "M-Pesa",
  needsPhone: true,
  async initiate(input) {
    const c = mpesaConfig();
    if (!c) return { ok: false, reason: "M-Pesa is not configured." };
    if (!input.payerPhone) return { ok: false, reason: "Enter the M-Pesa number to pay from." };
    try {
      const token = await accessToken(c);
      const res = await fetch(`${c.baseUrl}/mpesa/stkpush/v1/processrequest`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(buildStkPushBody(c, { amountMinor: input.amountMinor, phone: input.payerPhone, orderNumber: input.orderNumber })),
        cache: "no-store",
      });
      const json = (await res.json()) as { ResponseCode?: string; CheckoutRequestID?: string; CustomerMessage?: string; errorMessage?: string };
      if (!res.ok || json.ResponseCode !== "0" || !json.CheckoutRequestID) {
        return { ok: false, reason: json.errorMessage ?? "M-Pesa did not accept the request." };
      }
      return { ok: true, providerReference: json.CheckoutRequestID, customerMessage: "Check your phone and enter your M-Pesa PIN to approve." };
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : "M-Pesa request failed." };
    }
  },
};

type StkCallback = {
  Body?: {
    stkCallback?: {
      CheckoutRequestID?: string;
      ResultCode?: number;
      ResultDesc?: string;
      CallbackMetadata?: { Item?: { Name: string; Value?: string | number }[] };
    };
  };
};

export function parseStkCallback(raw: string) {
  const json = JSON.parse(raw) as StkCallback;
  const cb = json.Body?.stkCallback;
  if (!cb?.CheckoutRequestID || typeof cb.ResultCode !== "number") throw new Error("Not an STK callback");
  const items = Object.fromEntries((cb.CallbackMetadata?.Item ?? []).map((i) => [i.Name, i.Value]));
  return {
    checkoutRequestId: cb.CheckoutRequestID,
    resultCode: cb.ResultCode,
    resultDesc: cb.ResultDesc ?? null,
    amountMinor: typeof items.Amount === "number" ? Math.round(items.Amount * 100) : null,
    receipt: typeof items.MpesaReceiptNumber === "string" ? items.MpesaReceiptNumber : null,
  };
}

async function queryStk(c: MpesaConfig, checkoutRequestId: string) {
  const token = await accessToken(c);
  const timestamp = darajaTimestamp();
  const res = await fetch(`${c.baseUrl}/mpesa/stkpushquery/v1/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ BusinessShortCode: c.shortcode, Password: stkPassword(c.shortcode, c.passkey, timestamp), Timestamp: timestamp, CheckoutRequestID: checkoutRequestId }),
    cache: "no-store",
  });
  const json = (await res.json()) as { ResultCode?: string | number };
  return String(json.ResultCode ?? "");
}

export async function handleMpesaCallback(pathToken: string, rawBody: string) {
  const c = mpesaConfig();
  if (!c) return { status: 404, outcome: "disabled" };
  const a = Buffer.from(pathToken);
  const b = Buffer.from(c.callbackToken);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { status: 404, outcome: "bad_token" };

  let cb: ReturnType<typeof parseStkCallback>;
  try {
    cb = parseStkCallback(rawBody);
  } catch {
    return { status: 400, outcome: "bad_payload" };
  }

  // Never trust the callback alone: confirm with Daraja before recording success.
  let success = false;
  if (cb.resultCode === 0) {
    try {
      success = (await queryStk(c, cb.checkoutRequestId)) === "0";
    } catch {
      return { status: 503, outcome: "confirm_failed_retry" }; // Daraja retries; nothing recorded yet
    }
  }
  const outcome = await recordOutcome({
    provider: "mpesa",
    eventKey: `${cb.checkoutRequestId}:${cb.resultCode}`,
    payloadSha256: sha256(rawBody),
    providerReference: cb.checkoutRequestId,
    success,
    amountMinor: cb.amountMinor,
    receipt: cb.receipt,
    reason: success ? null : cb.resultDesc ?? "Payment was not completed.",
  });
  return { status: 200, outcome };
}
