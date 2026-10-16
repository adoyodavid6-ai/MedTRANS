import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/app/orders/[id]/auto-refresh";
import { PaymentPanel } from "@/components/payments/payment-panel";
import { TestPaymentControls } from "@/components/payments/test-payment-controls";
import { ReportIncident } from "@/components/safety/report-incident";
import { Alert } from "@/components/ui/alert";
import { Badge, VerificationBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { StatusTimeline } from "@/components/ui/status-timeline";
import { requireAccount } from "@/lib/auth/session";
import { BOOKING_FLOW, BOOKING_STATUS, fmtSlot } from "@/lib/doctorcare/status";
import { formatMoney } from "@/lib/money";
import { availableGateways } from "@/lib/payments";
import { isTestGatewayEnabled } from "@/lib/payments/test-gateway";
import { createClient } from "@/lib/supabase/server";
import { startBookingPayment } from "./actions";
import { CancelBooking } from "./cancel";

export const metadata: Metadata = { title: "Your home visit", robots: { index: false, follow: false } };

type B = {
  id: string; booking_number: string; status: string; patient_id: string; patient_name: string; slot: string; provider_id: string | null;
  visit_fee_minor: number | null; booking_fee_minor: number | null; total_minor: number | null; max_visit_fee_minor: number | null; currency: string;
  address: { line1: string; area: string | null } | null; care_services: { name: string; duration_minutes: number };
  booking_events: { id: number; status: string; note: string | null; occurred_at: string }[];
  payments: { id: string; provider: string; status: string; failure_reason: string | null; provider_receipt: string | null; created_at: string }[];
  clinical_visit_records: { presenting_concern: string; observations: string | null; vitals: Record<string, unknown>; care_provided: string; advice: string | null; follow_up: string | null; referral: string | null; signed_by_name: string; signed_registration: string; signed_at: string } | null;
};

const slotStart = (range: string) => range.replace(/^[[(]"?/, "").split(",")[0].replace(/"/g, "");

export default async function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAccount(`/bookings/${id}`);
  const supabase = await createClient();
  const { data } = await supabase
    .from("care_bookings")
    .select("id, booking_number, status, patient_id, patient_name, slot, provider_id, visit_fee_minor, booking_fee_minor, total_minor, max_visit_fee_minor, currency, address, care_services(name, duration_minutes), booking_events(id, status, note, occurred_at), payments(id, provider, status, failure_reason, provider_receipt, created_at), clinical_visit_records(presenting_concern, observations, vitals, care_provided, advice, follow_up, referral, signed_by_name, signed_registration, signed_at)")
    .eq("id", id).maybeSingle();
  const b = data as unknown as B | null;
  if (!b || b.patient_id !== user.id) notFound();

  let provider: { display_name: string; regulator: string; registration_number: string; profession: string } | null = null;
  if (b.provider_id) {
    const { data: dir } = await supabase.rpc("provider_directory");
    provider = ((dir ?? []) as { provider_id: string; display_name: string; regulator: string; registration_number: string; profession: string }[]).find((p) => p.provider_id === b.provider_id) ?? null;
  }
  const s = BOOKING_STATUS[b.status];
  const events = [...b.booking_events].sort((x, y) => x.id - y.id);
  const steps = BOOKING_FLOW.map((st) => ({ key: st, label: BOOKING_STATUS[st].label, at: events.find((e) => e.status === st)?.occurred_at ?? null }));
  const payments = [...b.payments].sort((x, y) => y.created_at.localeCompare(x.created_at));
  const pendingPay = payments.find((p) => ["initiated", "pending"].includes(p.status));
  const failed = payments.find((p) => p.status === "failed");
  const paid = payments.some((p) => p.status === "succeeded");
  const methods = availableGateways().map((g) => ({ provider: g.provider, label: g.label, needsPhone: g.needsPhone }));
  const live = ["awaiting_acceptance", "awaiting_payment", "confirmed", "en_route", "arrived", "in_progress"].includes(b.status);
  const fmt = (iso: string) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Nairobi" }).format(new Date(iso));
  const r = b.clinical_visit_records;

  return (
    <div className="container-page max-w-3xl space-y-6 py-10">
      {live ? <AutoRefresh seconds={pendingPay || b.status === "awaiting_acceptance" ? 5 : 20} /> : null}
      <div>
        <p className="text-sm text-muted"><Link href="/account/bookings" className="underline">Your bookings</Link></p>
        <h1 className="mt-1 text-3xl font-bold">{b.care_services.name}</h1>
        <p className="mt-1 text-muted">Booking {b.booking_number} · for {b.patient_name}{b.status !== "escalated" ? ` · ${fmtSlot(slotStart(b.slot))}` : ""}</p>
      </div>

      <Card aria-live="polite">
        <Badge tone={s.tone}>{s.label}</Badge>
        <p className="mt-2 text-[0.95rem]">{s.explanation}</p>
        {b.status === "escalated" ? <p className="mt-2"><Link href="/emergency" className="font-semibold text-urgent underline">Open Emergency Help</Link></p> : null}
        {b.status === "no_provider_available" ? <p className="mt-2"><Link href="/doctorcare/book" className="font-semibold text-primary underline">Try another time</Link> or <Link href="/contact" className="underline">contact us</Link>.</p> : null}
      </Card>

      {provider ? (
        <Card>
          <h2 className="text-lg font-semibold">Your professional</h2>
          <p className="mt-1 flex flex-wrap items-center gap-2">{provider.display_name} <VerificationBadge status="verified" /></p>
          <p className="text-sm text-muted">{provider.profession === "doctor" ? "Doctor" : "Nurse"} · {provider.regulator} registration {provider.registration_number}</p>
        </Card>
      ) : null}

      {b.status === "awaiting_payment" && b.total_minor ? (
        <Card className="space-y-4">
          <h2 className="text-xl font-semibold">Pay {formatMoney(b.total_minor, b.currency)} to confirm</h2>
          {pendingPay ? (
            <Alert tone="info" title="Waiting for payment confirmation">
              <p>We&apos;ll update this page when the provider confirms. Don&apos;t pay twice.</p>
              {pendingPay.provider === "test" && isTestGatewayEnabled() ? <TestPaymentControls paymentId={pendingPay.id} /> : null}
            </Alert>
          ) : methods.length === 0 ? (
            <Alert tone="warning" title="Payments are not activated yet"><p>This booking can&apos;t be paid, so it will be released automatically. You have not been charged.</p></Alert>
          ) : (
            <>
              {failed ? <Alert tone="warning" title="The last payment didn't go through"><p>{failed.failure_reason ?? "Please try again."}</p></Alert> : null}
              <PaymentPanel action={startBookingPayment} hidden={{ booking_id: b.id }} idempotencyKey={randomUUID()} methods={methods} totalLabel={formatMoney(b.total_minor, b.currency)} />
            </>
          )}
        </Card>
      ) : null}

      {b.status !== "escalated" ? (
        <Card>
          <h2 className="text-xl font-semibold">Progress</h2>
          <div className="mt-4"><StatusTimeline steps={steps} /></div>
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-semibold text-primary">Full history</summary>
            <ol className="mt-2 space-y-1 text-sm">{events.map((e) => <li key={e.id}><span className="text-muted">{fmt(e.occurred_at)}</span> · {BOOKING_STATUS[e.status]?.label}{e.note ? ` — ${e.note}` : ""}</li>)}</ol>
          </details>
        </Card>
      ) : null}

      {b.visit_fee_minor !== null || b.max_visit_fee_minor !== null ? (
        <Card>
          <h2 className="text-lg font-semibold">Fees</h2>
          <dl className="mt-2 text-[0.95rem]">
            <div className="flex justify-between py-1"><dt>Visit fee</dt><dd className="tabular-nums">{formatMoney(b.visit_fee_minor ?? b.max_visit_fee_minor ?? 0, b.currency)}{b.visit_fee_minor === null ? " (maximum)" : ""}</dd></div>
            <div className="flex justify-between py-1"><dt>Booking fee</dt><dd className="tabular-nums">{formatMoney(b.booking_fee_minor ?? 0, b.currency)}</dd></div>
            {b.total_minor ? <div className="flex justify-between border-t border-line pt-2 font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatMoney(b.total_minor, b.currency)}</dd></div> : null}
          </dl>
          {payments.find((p) => p.status === "succeeded")?.provider_receipt ? <p className="mt-2 text-sm text-muted">Receipt: {payments.find((p) => p.status === "succeeded")!.provider_receipt}</p> : null}
        </Card>
      ) : null}

      {r ? (
        <Card className="space-y-2">
          <h2 className="text-xl font-semibold">Visit summary</h2>
          <p className="text-sm text-muted">Written and signed by {r.signed_by_name} ({r.signed_registration}) on {fmt(r.signed_at)}. Only you and your professional can see this.</p>
          <dl className="space-y-2 text-[0.95rem]">
            <div><dt className="font-semibold">Reason for visit</dt><dd>{r.presenting_concern}</dd></div>
            {r.observations ? <div><dt className="font-semibold">Observations</dt><dd>{r.observations}</dd></div> : null}
            {Object.keys(r.vitals ?? {}).length ? <div><dt className="font-semibold">Vital signs</dt><dd>{Object.entries(r.vitals).map(([k, v]) => `${k.replace(/_/g, " ")}: ${String(v)}`).join(" · ")}</dd></div> : null}
            <div><dt className="font-semibold">Care provided</dt><dd>{r.care_provided}</dd></div>
            {r.advice ? <div><dt className="font-semibold">Advice</dt><dd>{r.advice}</dd></div> : null}
            {r.follow_up ? <div><dt className="font-semibold">Follow-up</dt><dd>{r.follow_up}</dd></div> : null}
            {r.referral ? <div><dt className="font-semibold">Referral</dt><dd>{r.referral}</dd></div> : null}
          </dl>
        </Card>
      ) : null}

      {["awaiting_acceptance", "awaiting_payment", "confirmed"].includes(b.status) ? <CancelBooking bookingId={b.id} paid={paid} /> : null}
      {b.provider_id ? <ReportIncident bookingId={b.id} title="Report a problem with this visit" /> : null}
    </div>
  );
}
