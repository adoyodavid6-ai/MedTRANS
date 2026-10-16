import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAccount } from "@/lib/auth/session";
import { TICKET_STATUS } from "@/lib/support/labels";
import { createClient } from "@/lib/supabase/server";

export default async function SupportList() {
  const user = await requireAccount("/account/support");
  const supabase = await createClient();
  const { data } = await supabase.from("support_tickets").select("id, ticket_number, subject, status, updated_at").eq("requester_id", user.id).order("updated_at", { ascending: false });
  const rows = data ?? [];
  return (
    <section aria-labelledby="s-heading" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="s-heading" className="text-xl font-semibold">Support</h2>
        <ButtonLink href="/contact" variant="secondary">New message</ButtonLink>
      </div>
      {rows.length === 0 ? <EmptyState icon={LifeBuoy} title="No messages yet" /> : (
        <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface">
          {rows.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div><Link href={`/account/support/${t.id}`} className="font-semibold text-navy underline-offset-2 hover:underline">{t.subject}</Link><p className="text-sm text-muted">{t.ticket_number}</p></div>
              <Badge tone={TICKET_STATUS[t.status].tone}>{TICKET_STATUS[t.status].label}</Badge>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
