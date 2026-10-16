import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireAccount } from "@/lib/auth/session";
import { timeAgo } from "@/lib/pharmacy/status";
import { CATEGORIES, TICKET_STATUS } from "@/lib/support/labels";
import { createClient } from "@/lib/supabase/server";

export default async function SupportQueue({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAccount("/ops/support", ["admin", "support"]);
  const status = (await searchParams).status ?? "active";
  const supabase = await createClient();
  let q = supabase.from("support_tickets").select("id, ticket_number, subject, category, status, priority, created_at, assigned_to, requester_id").order("priority", { ascending: false }).order("created_at").limit(200);
  q = status === "active" ? q.in("status", ["new", "open", "waiting_on_customer"]) : status in TICKET_STATUS ? q.eq("status", status) : q;
  const { data } = await q;
  const rows = data ?? [];
  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">Support tickets</h2>
        <nav aria-label="Filter" className="flex flex-wrap gap-1 text-sm">
          {[["active", "Active"], ["new", "New"], ["resolved", "Resolved"], ["closed", "Closed"]].map(([k, l]) => (
            <Link key={k} href={`/ops/support?status=${k}`} aria-current={status === k ? "page" : undefined} className={status === k ? "rounded-lg bg-primary-soft px-3 py-2 font-semibold" : "rounded-lg px-3 py-2"}>{l}</Link>
          ))}
        </nav>
      </div>
      <ul className="divide-y divide-line">
        {rows.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div>
              <Link href={`/ops/support/${t.id}`} className="font-semibold text-navy underline">{t.subject}</Link>
              <p className="text-sm text-muted">{t.ticket_number} · {CATEGORIES[t.category]} · {t.requester_id ? "account holder" : "guest"} · opened {timeAgo(t.created_at)}</p>
            </div>
            <span className="flex gap-1.5">
              {t.priority === "urgent" || t.priority === "high" ? <Badge tone="urgent">{t.priority}</Badge> : null}
              <Badge tone={TICKET_STATUS[t.status].tone}>{TICKET_STATUS[t.status].label}</Badge>
            </span>
          </li>
        ))}
        {rows.length === 0 ? <li className="py-3 text-muted">Nothing here.</li> : null}
      </ul>
    </Card>
  );
}
