import Link from "next/link";
import { Card } from "@/components/ui/card";
import { requireAccount } from "@/lib/auth/session";
import { formatMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { WeeklyOrdersChart } from "./weekly-chart";

type A = Record<string, unknown> & { events: Record<string, number>; weekly_orders: { week: string; orders: number }[] };

const compact = (n: number) => new Intl.NumberFormat("en-GB", { notation: n >= 10000 ? "compact" : "standard" }).format(n);

function Tile({ label, value, def }: { label: string; value: string; def: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold text-navy tabular-nums">{value}</dd>
      <dd className="mt-1 text-xs text-muted">{def}</dd>
    </div>
  );
}

export default async function Analytics({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  await requireAccount("/ops/analytics", ["admin"]);
  const days = [7, 30, 90].includes(Number((await searchParams).days)) ? Number((await searchParams).days) : 30;
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_analytics", { p_days: days });
  const a = (data ?? { events: {}, weekly_orders: [] }) as A;
  const n = (k: string) => Number(a[k] ?? 0);
  const pct = (k: string) => (a[k] === null || a[k] === undefined ? "—" : `${a[k]}%`);
  const ev = (k: string) => compact(a.events?.[k] ?? 0);
  const rate = (num: number, den: number) => (den ? `${((100 * num) / den).toFixed(1)}%` : "—");

  return (
    <>
      <Card className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">Analytics</h2>
          <nav aria-label="Period" className="flex gap-1 text-sm">
            {[7, 30, 90].map((d) => <Link key={d} href={`/ops/analytics?days=${d}`} aria-current={d === days ? "page" : undefined} className={d === days ? "rounded-lg bg-primary-soft px-3 py-2 font-semibold" : "rounded-lg px-3 py-2"}>Last {d} days</Link>)}
          </nav>
        </div>
        <p className="text-sm text-muted">Transaction metrics come from real records. Page events are anonymous daily counts with no identifiers, so funnel ratios between them are approximate. No health information is used.</p>
      </Card>

      <section aria-labelledby="ph-h" className="space-y-2">
        <h2 id="ph-h" className="text-lg font-semibold">Pharmacy</h2>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Tile label="Searches" value={ev("pharmacy_search")} def="Medicine searches with a query." />
          <Tile label="Product views" value={ev("product_view")} def="Medicine page views." />
          <Tile label="Added to cart" value={ev("add_to_cart")} def="Add-to-cart actions." />
          <Tile label="Checkout started" value={ev("checkout_started")} def="Checkout page views." />
          <Tile label="Orders placed" value={compact(n("orders_placed"))} def="Orders created in the period." />
          <Tile label="Orders paid" value={compact(n("orders_paid"))} def="Orders with a confirmed payment." />
          <Tile label="Orders delivered" value={compact(n("orders_delivered"))} def="Confirmed with the handover code." />
          <Tile label="Cancellation rate" value={rate(n("orders_cancelled"), n("orders_placed"))} def="Cancelled or refunded ÷ placed." />
          <Tile label="Pharmacy acceptance" value={pct("pharmacy_acceptance_rate")} def="Paid orders accepted by the pharmacy." />
          <Tile label="Prescription review (median)" value={a.rx_review_median_minutes == null ? "—" : `${a.rx_review_median_minutes} min`} def="Upload to pharmacist decision." />
          <Tile label="Checkout → paid" value={rate(n("orders_paid"), a.events?.checkout_started ?? 0)} def="Approximate: anonymous counts." />
          <Tile label="Pharmacy sales (gross)" value={formatMoney(n("gross_pharmacy_minor"))} def="Item value of delivered orders." />
        </dl>
      </section>

      <section aria-labelledby="dc-h" className="space-y-2">
        <h2 id="dc-h" className="text-lg font-semibold">DoctorCare</h2>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Tile label="Booking wizard opened" value={ev("booking_started")} def="Visits to the booking page." />
          <Tile label="Visits requested" value={compact(n("bookings_requested"))} def="Requests sent to a professional." />
          <Tile label="Screening escalations" value={compact(n("bookings_escalated"))} def="Stopped and sent to emergency guidance." />
          <Tile label="No professional available" value={compact(n("bookings_no_provider"))} def="Requests nobody suitable could take." />
          <Tile label="Offer acceptance" value={pct("offer_acceptance_rate")} def="Offers accepted ÷ answered or expired." />
          <Tile label="Time to visit (median)" value={a.median_hours_to_visit == null ? "—" : `${a.median_hours_to_visit} h`} def="Request to scheduled start." />
          <Tile label="Visits completed" value={compact(n("bookings_completed"))} def="Signed visit records." />
          <Tile label="Visit fees (gross)" value={formatMoney(n("gross_doctorcare_minor"))} def="Fees of completed visits." />
        </dl>
      </section>

      <section aria-labelledby="pl-h" className="space-y-2">
        <h2 id="pl-h" className="text-lg font-semibold">Platform</h2>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Tile label="Registrations" value={compact(n("registrations"))} def="New accounts." />
          <Tile label="Platform fees" value={formatMoney(n("platform_fees_minor"))} def="Delivery, service and booking fees on completed work (before commissions)." />
          <Tile label="Open support tickets" value={compact(n("tickets_open"))} def="Now, not just this period." />
          <Tile label="Support satisfaction" value={a.support_satisfaction == null ? "—" : `${a.support_satisfaction} / 5`} def="Average rating on resolved tickets." />
          <Tile label="Open safety incidents" value={compact(n("incidents_open"))} def="Now, not yet resolved." />
          <Tile label="Emergency page views" value={ev("emergency_view")} def="Anonymous count." />
        </dl>
      </section>

      <Card><WeeklyOrdersChart data={a.weekly_orders ?? []} /></Card>
    </>
  );
}
