import "server-only";

/**
 * Outbound channels. Each is a boundary with no credentials yet:
 *   SMS: Africa's Talking  [[ENV: AFRICASTALKING_API_KEY]], [[ENV: AFRICASTALKING_USERNAME]], [[ENV: SMS_SENDER_ID]]
 *   Email: any HTTPS email API configured via [[ENV: EMAIL_API_URL]], [[ENV: EMAIL_API_KEY]], [[ENV: EMAIL_FROM]]
 * Neither has been exercised against a live account. Until configured, messages are recorded as
 * "skipped" (never as sent). Message bodies are neutral and contain no medical detail.
 */
export type SendResult = { ok: true } | { ok: false; error: string; retryable: boolean };

export function smsConfigured() {
  return Boolean(process.env.AFRICASTALKING_API_KEY && process.env.AFRICASTALKING_USERNAME);
}

export async function sendSms(to: string, body: string): Promise<SendResult> {
  if (!smsConfigured()) return { ok: false, error: "No SMS provider configured", retryable: false };
  const sandbox = process.env.AFRICASTALKING_USERNAME === "sandbox";
  const url = sandbox ? "https://api.sandbox.africastalking.com/version1/messaging" : "https://api.africastalking.com/version1/messaging";
  const params = new URLSearchParams({ username: process.env.AFRICASTALKING_USERNAME!, to, message: body });
  if (process.env.SMS_SENDER_ID) params.set("from", process.env.SMS_SENDER_ID);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { apiKey: process.env.AFRICASTALKING_API_KEY!, Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, error: `SMS provider returned ${res.status}`, retryable: res.status >= 500 };
    const json = (await res.json()) as { SMSMessageData?: { Recipients?: { status?: string }[] } };
    const status = json.SMSMessageData?.Recipients?.[0]?.status;
    return status === "Success" ? { ok: true } : { ok: false, error: `SMS not accepted: ${status ?? "unknown"}`, retryable: false };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "SMS request failed", retryable: true };
  }
}

export function emailConfigured() {
  return Boolean(process.env.EMAIL_API_URL && process.env.EMAIL_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail(to: string, subject: string, body: string): Promise<SendResult> {
  if (!emailConfigured()) return { ok: false, error: "No email provider configured", retryable: false };
  try {
    const res = await fetch(process.env.EMAIL_API_URL!, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.EMAIL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, text: `${body}\n\nSign in to MedTRANS for details.` }),
      cache: "no-store",
    });
    return res.ok ? { ok: true } : { ok: false, error: `Email provider returned ${res.status}`, retryable: res.status >= 500 };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Email request failed", retryable: true };
  }
}
