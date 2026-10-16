import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireAccount } from "@/lib/auth/session";
import { formatMoney } from "@/lib/money";
import { ORDER_STATUS } from "@/lib/pharmacy/status";
import { namesFor } from "@/lib/profiles";
import { createClient } from "@/lib/supabase/server";
import { DispatchForm } from "../pharmacy-forms";

export default async function OpsOrders({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAccount("/ops/orders", ["admin"]);
  const status = (await searchParams).status;
  const supabase = await createClient();
  let q = supabase.from("orders").select("id, order_number, status, total_minor, currency, created_at, pharmacies(name)").order("created_at", { ascending: false }).limit(100);
  if (status && status in ORDER_STATUS) q = q.eq("status", status);
  const [{ data }, { data: couriers }] = await Promise.all([
    q,
    supabase.from("courier_profiles").select("user_id").eq("verification_status", "verified"),
  ]);
  const names = await namesFor((couriers ?? []).map((c) => c.user_id as string));
  const courierOptions = (couriers ?? []).map((c) => ({ id: c.user_id as string, name: names.get(c.user_id as string) ?? "Unnamed partner" }));
  const rows = (data ?? []) as unknown as { id: string; order_number: string; status: string; total_minor: number; currency: string; created_at: string; pharmacies: { name: string } }[];
  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">Orders &amp; dispatch</h2>
        <form className="flex items-center gap-2 text-sm">
          <label htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={status ?? ""} className="min-h-11 rounded-xl border border-line bg-surface px-2">
            <option value="">All</option>{Object.entries(ORDER_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <button className="min-h-11 rounded-xl border border-line px-3">Filter</button>
        </form>
      </div>
      <p className="text-sm text-muted">Operational view only: prescriptions are never shown here.</p>
      <ul className="divide-y divide-line">
        {rows.map((o) => (
          <li key={o.id} className="space-y-2 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-navy">{o.order_number} · {o.pharmacies.name}</span>
              <span className="flex items-center gap-2"><Badge tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Badge><span className="tabular-nums">{formatMoney(o.total_minor, o.currency)}</span></span>
            </div>
            <DispatchForm orderId={o.id} status={o.status} couriers={courierOptions} />
          </li>
        ))}
        {rows.length === 0 ? <li className="py-3 text-muted">No orders.</li> : null}
      </ul>
    </Card>
  );
}
