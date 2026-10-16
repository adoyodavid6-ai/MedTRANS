import Link from "next/link";
import { Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAccount } from "@/lib/auth/session";
import { formatMoney } from "@/lib/money";
import { ORDER_STATUS } from "@/lib/pharmacy/status";
import { createClient } from "@/lib/supabase/server";

export default async function OrdersPage() {
  await requireAccount("/account/orders");
  const supabase = await createClient();
  const { data } = await supabase.from("orders").select("id, order_number, status, total_minor, currency, created_at, pharmacies(name)").order("created_at", { ascending: false }).limit(50);
  const orders = (data ?? []) as unknown as { id: string; order_number: string; status: string; total_minor: number; currency: string; created_at: string; pharmacies: { name: string } }[];
  return (
    <section aria-labelledby="orders-heading" className="space-y-3">
      <h2 id="orders-heading" className="text-xl font-semibold">Orders</h2>
      {orders.length === 0 ? (
        <EmptyState icon={Package} title="No orders yet" action={<ButtonLink href="/pharmacy/medicines">Find a medicine</ButtonLink>} />
      ) : (
        <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface">
          {orders.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <Link href={`/orders/${o.id}`} className="font-semibold text-navy underline-offset-2 hover:underline">Order {o.order_number}</Link>
                <p className="text-sm text-muted">{o.pharmacies.name} · {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(o.created_at))}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={ORDER_STATUS[o.status]?.tone}>{ORDER_STATUS[o.status]?.label ?? o.status}</Badge>
                <span className="font-semibold tabular-nums">{formatMoney(o.total_minor, o.currency)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
