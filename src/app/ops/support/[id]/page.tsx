import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireAccount } from "@/lib/auth/session";
import { CATEGORIES, TICKET_STATUS } from "@/lib/support/labels";
import { createClient } from "@/lib/supabase/server";
import { updateTicket } from "../../support-actions";
import { StaffReplyForm } from "../../support-forms";

export default async function TicketDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAccount(`/ops/support/${id}`, ["admin", "support"]);
  const supabase = await createClient();
  const { data: t } = await supabase.from("support_tickets").select("*").eq("id", id).maybeSingle();
  if (!t) notFound();
  const { data: msgs } = await supabase.from("support_messages").select("id, author_kind, body, is_internal, created_at").eq("ticket_id", id).order("id");
  const fmt = (iso: string) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Nairobi" }).format(new Date(iso));
  return (
    <>
      <p className="text-sm"><Link href="/ops/support" className="underline">All tickets</Link></p>
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold">{t.subject}</h2><Badge tone={TICKET_STATUS[t.status].tone}>{TICKET_STATUS[t.status].label}</Badge></div>
        <p className="text-sm text-muted">{t.ticket_number} · {CATEGORIES[t.category]} · {t.requester_id ? "account holder (reply arrives in their account)" : `guest: ${t.guest_name ?? "no name"}, ${t.guest_contact}`} · prefers {t.preferred_contact.replace("_", "-")}</p>
        {t.related_order_id ? <p className="text-sm">Related order: <Link className="underline" href={`/ops/orders`}>{t.related_order_id.slice(0, 8)}…</Link></p> : null}
        <form action={updateTicket} className="flex flex-wrap items-end gap-2 text-sm">
          <input type="hidden" name="ticket_id" value={t.id} />
          <label>Priority<select name="priority" defaultValue={t.priority} className="ml-2 min-h-11 rounded-xl border border-line px-2">{["low", "normal", "high", "urgent"].map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
          <label className="inline-flex min-h-11 items-center gap-2"><input type="checkbox" name="assign" value="me" className="size-4" />Assign to me</label>
          <button className="min-h-11 rounded-xl border border-line px-3">Update</button>
        </form>
        {t.satisfaction ? <p className="text-sm">Customer rating: {t.satisfaction}/5 {t.satisfaction_comment ? `— ${t.satisfaction_comment}` : ""}</p> : null}
      </Card>
      <Card>
        <ol className="space-y-3">
          {(msgs ?? []).map((m) => (
            <li key={m.id} className={m.is_internal ? "rounded-xl border border-dashed border-warning-ink/40 bg-warning-soft p-4" : m.author_kind === "staff" ? "rounded-xl bg-primary-soft p-4" : "rounded-xl border border-line p-4"}>
              <p className="text-sm font-semibold">{m.is_internal ? "Internal note" : m.author_kind === "staff" ? "Support" : "Customer"} · <span className="font-normal text-muted">{fmt(m.created_at)}</span></p>
              <p className="mt-1 whitespace-pre-line text-[0.95rem]">{m.body}</p>
            </li>
          ))}
        </ol>
      </Card>
      <Card>
        <h2 className="mb-3 text-lg font-semibold">Reply</h2>
        {!t.requester_id ? <p className="mb-3 text-sm text-muted">Guests see replies at their private ticket link. Until email/SMS delivery is configured, also contact them directly at {t.guest_contact}.</p> : null}
        <StaffReplyForm ticketId={t.id} />
      </Card>
    </>
  );
}
