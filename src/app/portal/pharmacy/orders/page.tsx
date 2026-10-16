import { ShoppingBag } from "lucide-react";
import { ReportIncident } from "@/components/safety/report-incident";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAccount } from "@/lib/auth/session";
import { formatMoney } from "@/lib/money";
import { ORDER_STATUS } from "@/lib/pharmacy/status";
import { myPharmacyMemberships } from "@/lib/pharmacy/staff";
import { createClient } from "@/lib/supabase/server";
import { OrderActions } from "../forms";

type O = { id: string; order_number: string; status: string; total_minor: number; currency: string; created_at: string; prescription_id: string | null; order_items: { product_name: string; strength: string; quantity: number }[] };

export default async function PharmacyOrders() {
  await requireAccount("/portal/pharmacy/orders", ["pharmacist", "pharmacy_admin"]);
  const ph = (await myPharmacyMemberships())[0]?.pharmacies;
  if (!ph) return <EmptyState icon={ShoppingBag} title="Not linked to a pharmacy" />;
  const supabase = await createClient();
  const { data } = await supabase.from("orders")
    .select("id, order_number, status, total_minor, currency, created_at, prescription_id, order_items(product_name, strength, quantity)")
    .eq("pharmacy_id", ph.id).neq("status", "pending_payment").order("created_at", { ascending: false }).limit(100);
  const orders = (data ?? []) as O[];
  const active = orders.filter((o) => ["awaiting_pharmacy_acceptance", "confirmed", "preparing", "ready_for_dispatch"].includes(o.status));
  const other = orders.filter((o) => !active.includes(o));
  const card = (o: O) => (
    <Card key={o.id} className="space-y-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-navy">Order {o.order_number}</p>
        <Badge tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Badge>
      </div>
      <ul className="text-[0.95rem]">{o.order_items.map((i) => <li key={i.product_name}>{i.quantity} × {i.product_name} {i.strength}</li>)}</ul>
      <p className="text-sm text-muted">{formatMoney(o.total_minor, o.currency)} · paid{o.prescription_id ? " · prescription approved by your pharmacist" : ""}</p>
      <OrderActions orderId={o.id} status={o.status} />
      <ReportIncident orderId={o.id} title="Report a safety incident" />
    </Card>
  );
  return (
    <>
      <section aria-labelledby="active-heading" className="space-y-3">
        <h2 id="active-heading" className="text-xl font-semibold">To do</h2>
        {active.length === 0 ? <EmptyState icon={ShoppingBag} title="No paid orders waiting" /> : active.map(card)}
      </section>
      {other.length ? (
        <section aria-labelledby="done-heading" className="space-y-3">
          <h2 id="done-heading" className="text-lg font-semibold">Recent</h2>
          {other.slice(0, 20).map(card)}
        </section>
      ) : null}
    </>
  );
}
