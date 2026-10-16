import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/payments/record", () => ({
  sha256: (s: string) => `sha(${s.length})`,
  recordOutcome: vi.fn(async () => "succeeded"),
}));

import { recordOutcome } from "@/lib/payments/record";
import { buildStkPushBody, darajaTimestamp, handleMpesaCallback, parseStkCallback, stkPassword, toDarajaAmount, toDarajaPhone } from "@/lib/payments/mpesa";
import { handleTestWebhook, signTestPayload } from "@/lib/payments/test-gateway";

describe("M-Pesa Daraja helpers", () => {
  it("formats the timestamp in East Africa Time", () => {
    expect(darajaTimestamp(new Date("2026-10-17T21:30:05Z"))).toBe("20261018003005");
  });
  it("builds the STK password as base64(shortcode + passkey + timestamp)", () => {
    expect(stkPassword("174379", "key", "20261017120000")).toBe(Buffer.from("174379key20261017120000").toString("base64"));
  });
  it("only charges whole shillings", () => {
    expect(toDarajaAmount(77000)).toBe(770);
    expect(() => toDarajaAmount(77050)).toThrow();
  });
  it("only accepts Kenyan mobile numbers", () => {
    expect(toDarajaPhone("+254712345678")).toBe("254712345678");
    expect(() => toDarajaPhone("+252612345678")).toThrow();
  });
  it("builds an STK push body", () => {
    const body = buildStkPushBody(
      { baseUrl: "", consumerKey: "", consumerSecret: "", shortcode: "174379", passkey: "pk", callbackUrl: "https://x/cb/t", callbackToken: "t" },
      { amountMinor: 77000, phone: "+254712345678", orderNumber: "MT-100001" },
      "20261017120000",
    );
    expect(body).toMatchObject({ BusinessShortCode: "174379", Amount: 770, PartyA: "254712345678", PhoneNumber: "254712345678", AccountReference: "MT-100001", TransactionType: "CustomerPayBillOnline" });
  });
  it("parses a successful STK callback", () => {
    const raw = JSON.stringify({ Body: { stkCallback: { MerchantRequestID: "m", CheckoutRequestID: "ws_CO_1", ResultCode: 0, ResultDesc: "ok",
      CallbackMetadata: { Item: [{ Name: "Amount", Value: 770 }, { Name: "MpesaReceiptNumber", Value: "QK12ABC" }, { Name: "PhoneNumber", Value: 254712345678 }] } } } });
    expect(parseStkCallback(raw)).toEqual({ checkoutRequestId: "ws_CO_1", resultCode: 0, resultDesc: "ok", amountMinor: 77000, receipt: "QK12ABC" });
  });
  it("rejects payloads that are not STK callbacks", () => {
    expect(() => parseStkCallback("{}")).toThrow();
  });
});

describe("M-Pesa callback endpoint", () => {
  beforeEach(() => {
    Object.assign(process.env, { MPESA_CONSUMER_KEY: "k", MPESA_CONSUMER_SECRET: "s", MPESA_SHORTCODE: "174379", MPESA_PASSKEY: "p", MPESA_CALLBACK_BASE_URL: "https://x", MPESA_CALLBACK_TOKEN: "secret-token-123" });
  });
  afterEach(() => {
    for (const k of ["MPESA_CONSUMER_KEY", "MPESA_CONSUMER_SECRET", "MPESA_SHORTCODE", "MPESA_PASSKEY", "MPESA_CALLBACK_BASE_URL", "MPESA_CALLBACK_TOKEN"]) delete process.env[k];
    vi.unstubAllGlobals();
    vi.mocked(recordOutcome).mockClear();
  });
  it("ignores callbacks on the wrong secret path", async () => {
    expect((await handleMpesaCallback("guess", "{}")).status).toBe(404);
    expect(recordOutcome).not.toHaveBeenCalled();
  });
  it("never records success unless Daraja confirms it on re-query", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) =>
      new Response(JSON.stringify(url.includes("oauth") ? { access_token: "t" } : { ResultCode: "1032" }), { status: 200 })));
    const raw = JSON.stringify({ Body: { stkCallback: { CheckoutRequestID: "ws_CO_2", ResultCode: 0, CallbackMetadata: { Item: [{ Name: "Amount", Value: 770 }] } } } });
    await handleMpesaCallback("secret-token-123", raw);
    expect(vi.mocked(recordOutcome).mock.calls[0][0]).toMatchObject({ providerReference: "ws_CO_2", success: false });
  });
  it("records success when Daraja confirms", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) =>
      new Response(JSON.stringify(url.includes("oauth") ? { access_token: "t" } : { ResultCode: "0" }), { status: 200 })));
    const raw = JSON.stringify({ Body: { stkCallback: { CheckoutRequestID: "ws_CO_3", ResultCode: 0, CallbackMetadata: { Item: [{ Name: "Amount", Value: 770 }, { Name: "MpesaReceiptNumber", Value: "R" }] } } } });
    await handleMpesaCallback("secret-token-123", raw);
    expect(vi.mocked(recordOutcome).mock.calls[0][0]).toMatchObject({ providerReference: "ws_CO_3", success: true, amountMinor: 77000, eventKey: "ws_CO_3:0" });
  });
});

describe("test gateway webhook", () => {
  beforeEach(() => {
    process.env.PAYMENTS_TEST_MODE = "enabled";
    process.env.PAYMENTS_TEST_WEBHOOK_SECRET = "s3cret";
  });
  afterEach(() => {
    delete process.env.PAYMENTS_TEST_MODE;
    delete process.env.PAYMENTS_TEST_WEBHOOK_SECRET;
    vi.mocked(recordOutcome).mockClear();
  });
  const body = JSON.stringify({ eventId: "e1", reference: "TEST-1", success: true, amountMinor: 100 });
  const now = () => Math.floor(Date.now() / 1000);

  it("accepts a correctly signed, fresh callback", async () => {
    const ts = now();
    expect(await handleTestWebhook(body, signTestPayload(body, ts), String(ts))).toEqual({ status: 200, outcome: "succeeded" });
  });
  it("rejects a bad signature", async () => {
    const ts = now();
    expect((await handleTestWebhook(body, "00".repeat(32), String(ts))).status).toBe(401);
    expect(recordOutcome).not.toHaveBeenCalled();
  });
  it("rejects a tampered body", async () => {
    const ts = now();
    const sig = signTestPayload(body, ts);
    expect((await handleTestWebhook(body.replace("100", "1"), sig, String(ts))).status).toBe(401);
  });
  it("rejects a stale (replayed) callback", async () => {
    const ts = now() - 600;
    expect((await handleTestWebhook(body, signTestPayload(body, ts), String(ts))).status).toBe(401);
  });
  it("is unavailable when test mode is off", async () => {
    delete process.env.PAYMENTS_TEST_MODE;
    expect((await handleTestWebhook(body, "x", "1")).status).toBe(404);
  });
});
