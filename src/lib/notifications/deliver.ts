import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { sendEmail, sendSms } from "./channels";

type Row = { id: number; channel: string; to_address: string; body: string; attempts: number; notifications: { title: string } | null };

const MAX_ATTEMPTS = 5;

/** Delivers pending outbox messages once. Unconfigured channels are recorded as skipped, never as sent. */
export async function deliverPending(limit = 50) {
  const db = createServiceClient();
  const { data } = await db.from("notification_outbox").select("id, channel, to_address, body, attempts, notifications(title)")
    .eq("status", "pending").order("created_at").limit(limit);
  const summary = { sent: 0, failed: 0, skipped: 0 };
  for (const r of (data ?? []) as unknown as Row[]) {
    const result = r.channel === "sms" ? await sendSms(r.to_address, r.body)
      : r.channel === "email" ? await sendEmail(r.to_address, r.notifications?.title ?? "MedTRANS update", r.body)
      : { ok: false as const, error: "Channel not supported", retryable: false };
    if (result.ok) {
      await db.from("notification_outbox").update({ status: "sent", sent_at: new Date().toISOString(), attempts: r.attempts + 1, last_error: null }).eq("id", r.id);
      summary.sent++;
    } else if (!result.retryable && /not configured|not supported/.test(result.error)) {
      await db.from("notification_outbox").update({ status: "skipped", attempts: r.attempts + 1, last_error: result.error }).eq("id", r.id);
      summary.skipped++;
    } else {
      const giveUp = !result.retryable || r.attempts + 1 >= MAX_ATTEMPTS;
      await db.from("notification_outbox").update({ status: giveUp ? "failed" : "pending", attempts: r.attempts + 1, last_error: result.error }).eq("id", r.id);
      summary.failed++;
    }
  }
  return summary;
}
