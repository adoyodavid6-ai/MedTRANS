import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireAccount } from "@/lib/auth/session";
import { BOOKING_STATUS, fmtSlot } from "@/lib/doctorcare/status";
import { formatMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { BookingOpsForm } from "../care-forms";

type R = { booking_id: string; booking_number: string; status: string; service_name: string; slot_start: string; provider_name: string | null; area: string | null; total_minor: number | null; currency: string; offers: number };

export default async function OpsBookings({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAccount("/ops/bookings", ["admin"]);
  const status = (await searchParams).status;
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_bookings", { p_status: status && status in BOOKING_STATUS ? status : null });
  const rows = (data ?? []) as R[];
  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">Home-visit bookings</h2>
        <form className="flex items-center gap-2 text-sm">
          <label htmlFor="bstatus">Status</label>
          <select id="bstatus" name="status" defaultValue={status ?? ""} className="min-h-11 rounded-xl border border-line bg-surface px-2"><option value="">All</option>{Object.entries(BOOKING_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
          <button className="min-h-11 rounded-xl border border-line px-3">Filter</button>
        </form>
      </div>
      <p className="text-sm text-muted">Operational view: visit descriptions, screening answers and visit records are never shown here.</p>
      <ul className="divide-y divide-line">
        {rows.map((b) => (
          <li key={b.booking_id} className="space-y-2 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-navy">{b.booking_number} · {b.service_name} · {b.status === "escalated" ? "screening escalation" : fmtSlot(b.slot_start)}</span>
              <Badge tone={BOOKING_STATUS[b.status].tone}>{BOOKING_STATUS[b.status].label}</Badge>
            </div>
            <p className="text-sm text-muted">{b.provider_name ?? "No professional assigned"} · {b.area ?? "—"} · {b.offers} offer{b.offers === 1 ? "" : "s"}{b.total_minor ? ` · ${formatMoney(b.total_minor, b.currency)}` : ""}</p>
            <BookingOpsForm bookingId={b.booking_id} status={b.status} />
          </li>
        ))}
        {rows.length === 0 ? <li className="py-3 text-muted">No bookings.</li> : null}
      </ul>
    </Card>
  );
}
