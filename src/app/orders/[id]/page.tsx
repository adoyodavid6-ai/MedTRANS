import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { KeyRound } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { StatusTimeline } from "@/components/ui/status-timeline";
import { requireAccount } from "@/lib/auth/session";
import { formatMoney } from "@/lib/money";
import { availableGateways } from "@/lib/payments";
import { isTestGatewayEnabled } from "@/lib/payments/test-gateway";
import { ORDER_FLOW, ORDER_STATUS } from "@/lib/pharmacy/status";
import { createClient } from "@/lib/supabase/server";
import { simulateTestPayment } from "./actions";
import { AutoRefresh } from "./auto-refresh";
import { CancelForm } from "./cancel-form";
import { PaymentPanel } from "./payment-panel";

export const metadata: Metadata = { title: "Your order", robots: { index: false, follow: false } };

type Order = {
  id: string; order_number: string; status: string; currency: string; patient_id: string; created_at: string;
  subtotal_minor: number; delivery_fee_minor: number; service_fee_minor: number; tax_minor: number; total_minor: number;
  delivery_address: { label: string; line1: string; area: string | null; building_details: string | null; landmark: string | null };
  recipient_name: string; handover_code: string; pharmacies: { name: string; slug: string };
  order_items: { id: string; product_name: string; strength: string; pack_size: string; quantity: number; line_total_minor: number; requires_prescription: boolean }[];
  order_events: { id: number; status: string; note: string | null; occurred_at: string; actor_kind: string }[];
  payments: { id: string; provider: string; status: string; failure_reason: string | null; provider_receipt: string | null; created_at: string }[];
};

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAccount(`/orders/${id}`);
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("id, order_number, status, currency, patient_id, created_at, subtotal_minor, delivery_fee_minor, service_fee_minor, tax_minor, total_minor, delivery_address, recipient_name, handover_code, pharmacies(name, slug), order_items(id, product_name, strength, pack_size, quantity, line_total_minor, requires_prescription), order_events(id, status, note, occurred_at, actor_kind), payments(id, provider, status, failure_reason, provider_receipt, created_at)")
    .eq("id", id)
    .maybeSingle();
  const o = data as unknown as Order | null;
  if (!o || o.patient_id !== user.id) notFound();

  const s = ORDER_STATUS[o.status];
  const events = [...o.order_events].sort((a, b) => a.id - b.id);
  const reachedAt = (st: string) => events.find((e) => e.status === st)?.occurred_at ?? null;
  const offFlow = !ORDER_FLOW.includes(o.status as (typeof ORDER_FLOW)[number]);
  const steps = ORDER_FLOW.map((st) => ({ key: st, label: ORDER_STATUS[st].label, at: reachedAt(st) }));
  const payments = [...o.payments].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const pendingPayment = payments.find((p) => p.status === "pending" || p.status === "initiated");
  const lastFailed = payments.find((p) => p.status === "failed");
  const paid = payments.some((p) => p.status === "succeeded");
  const methods = availableGateways().map((g) => ({ provider: g.provider, label: g.label, needsPhone: g.needsPhone }));
  const live = ["pending_payment", "awaiting_pharmacy_acceptance", "confirmed", "preparing", "ready_for_dispatch", "assigned_to_courier", "out_for_delivery"].includes(o.status);
  const fmt = (iso: string) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Nairobi" }).format(new Date(iso));
  const cur = o.currency;

  return (
    <div className="container-page max-w-3xl space-y-6 py-10">
      {live ? <AutoRefresh seconds={pendingPayment ? 4 : 15} /> : null}
      <div>
        <p className="text-sm text-muted"><Link href="/account/orders" className="underline">Your orders</Link></p>
        <h1 className="mt-1 text-3xl font-bold">Order {o.order_number}</h1>
        <p className="mt-1 text-muted">From {o.pharmacies.name} · placed {fmt(o.created_at)}</p>
      </div>

      <Card aria-live="polite">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={s.tone}>{s.label}</Badge>
        </div>
        <p className="mt-2 text-[0.95rem]">{s.explanation}</p>
      </Card>

      {o.status === "pending_payment" ? (
        <Card className="space-y-4">
          <h2 className="text-xl font-semibold">Pay {formatMoney(o.total_minor, cur)}</h2>
          {pendingPayment ? (
            <Alert tone="info" title="Waiting for payment confirmation">
              <p>We&apos;ll update this page as soon as the payment provider confirms. Don&apos;t pay twice.</p>
              {pendingPayment.provider === "test" && isTestGatewayEnabled() ? (
                <div className="mt-3 space-y-2 rounded-lg border border-dashed border-warning-ink/40 bg-warning-soft p-3">
                  <p className="text-sm font-semibold text-warning-ink">Test gateway: no money moves. Choose what the provider reports.</p>
                  <div className="flex flex-wrap gap-2">
                    <form action={simulateTestPayment}><input type="hidden" name="payment_id" value={pendingPayment.id} /><input type="hidden" name="outcome" value="success" /><button className="min-h-11 rounded-xl bg-navy px-4 font-semibold text-white">Simulate successful payment</button></form>
                    <form action={simulateTestPayment}><input type="hidden" name="payment_id" value={pendingPayment.id} /><input type="hidden" name="outcome" value="failure" /><button className="min-h-11 rounded-xl border border-line px-4 font-semibold">Simulate declined payment</button></form>
                  </div>
                </div>
              ) : null}
            </Alert>
          ) : methods.length === 0 ? (
            <Alert tone="warning" title="Payments are not activated yet">
              <p>No payment provider is connected, so this order can&apos;t be paid. You have not been charged, and it will be cancelled automatically.</p>
            </Alert>
          ) : (
            <>
              {lastFailed ? <Alert tone="warning" title="The last payment didn't go through"><p>{lastFailed.failure_reason ?? "Please try again."} You have not been charged.</p></Alert> : null}
              <PaymentPanel orderId={o.id} idempotencyKey={randomUUID()} methods={methods} totalLabel={formatMoney(o.total_minor, cur)} />
            </>
          )}
        </Card>
      ) : null}

      {["assigned_to_courier", "out_for_delivery", "awaiting_pharmacy_acceptance", "confirmed", "preparing", "ready_for_dispatch"].includes(o.status) ? (
        <Card className="flex items-start gap-4">
          <KeyRound aria-hidden className="mt-1 size-6 shrink-0 text-primary" />
          <div>
            <h2 className="text-lg font-semibold">Your handover code</h2>
            <p className="mt-1 font-mono text-3xl font-bold tracking-[0.3em] text-navy">{o.handover_code}</p>
            <p className="mt-1 text-sm text-muted">Give this code to the delivery partner only once you have your order in hand. It confirms the delivery.</p>
          </div>
        </Card>
      ) : null}

      <Card>
        <h2 className="text-xl font-semibold">Progress</h2>
        {offFlow ? <p className="mt-2 text-[0.95rem]"><Badge tone={s.tone}>{s.label}</Badge></p> : null}
        <div className="mt-4"><StatusTimeline steps={steps} /></div>
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-semibold text-primary">Full history</summary>
          <ol className="mt-2 space-y-1 text-sm">
            {events.map((e) => (
              <li key={e.id}><span className="text-muted">{fmt(e.occurred_at)}</span> · {ORDER_STATUS[e.status]?.label ?? e.status}{e.note ? ` — ${e.note}` : ""}</li>
            ))}
          </ol>
        </details>
      </Card>

      <Card>
        <h2 className="text-xl font-semibold">Details</h2>
        <ul className="mt-3 space-y-1 text-[0.95rem]">
          {o.order_items.map((i) => (
            <li key={i.id} className="flex justify-between gap-3"><span>{i.quantity} × {i.product_name} {i.strength}</span><span className="tabular-nums">{formatMoney(i.line_total_minor, cur)}</span></li>
          ))}
        </ul>
        <dl className="mt-3 border-t border-line pt-3 text-[0.95rem]">
          {[["Items", o.subtotal_minor], ["Delivery", o.delivery_fee_minor], ["Service fee", o.service_fee_minor], ["VAT", o.tax_minor]].map(([l, v]) => (
            <div key={l as string} className="flex justify-between py-1"><dt>{l}</dt><dd className="tabular-nums">{formatMoney(v as number, cur)}</dd></div>
          ))}
          <div className="flex justify-between border-t border-line pt-2 font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatMoney(o.total_minor, cur)}</dd></div>
        </dl>
        {payments.find((p) => p.status === "succeeded")?.provider_receipt ? (
          <p className="mt-2 text-sm text-muted">Payment receipt: {payments.find((p) => p.status === "succeeded")!.provider_receipt}</p>
        ) : null}
        <p className="mt-3 text-sm"><strong>Delivering to {o.recipient_name}:</strong> {[o.delivery_address.line1, o.delivery_address.area, o.delivery_address.building_details, o.delivery_address.landmark && `near ${o.delivery_address.landmark}`].filter(Boolean).join(", ")}</p>
      </Card>

      {["pending_payment", "awaiting_pharmacy_acceptance"].includes(o.status) ? <CancelForm orderId={o.id} paid={paid} /> : null}
    </div>
  );
}
