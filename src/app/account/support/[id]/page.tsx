import { notFound } from "next/navigation";
import { CustomerReplyForm, Messages, RateForm } from "@/components/support/thread";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireAccount } from "@/lib/auth/session";
import { TICKET_STATUS } from "@/lib/support/labels";
import { createClient } from "@/lib/supabase/server";

export default async function Ticket({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  const { id } = await params;
  const user = await requireAccount(`/account/support/${id}`);
  const supabase = await createClient();
  const { data: t } = await supabase.from("support_tickets").select("id, ticket_number, subject, status, satisfaction, requester_id").eq("id", id).maybeSingle();
  if (!t || t.requester_id !== user.id) notFound();
  const { data: msgs } = await supabase.from("support_messages").select("author_kind, body, created_at").eq("ticket_id", id).eq("is_internal", false).order("id");
  const s = TICKET_STATUS[t.status];
  return (
    <>
      {(await searchParams).new ? <Alert tone="success" title={`Message received: ${t.ticket_number}`}><p>You&apos;ll be notified here when we reply.</p></Alert> : null}
      <Card className="space-y-4">
        <div><h2 className="text-xl font-semibold">{t.subject}</h2><p className="flex items-center gap-2 text-sm text-muted">{t.ticket_number} <Badge tone={s.tone}>{s.label}</Badge></p></div>
        <Messages messages={msgs ?? []} />
      </Card>
      {t.status !== "closed" ? <Card><CustomerReplyForm ticketId={t.id} /></Card> : null}
      {["resolved", "closed"].includes(t.status) && !t.satisfaction ? <Card><RateForm ticketId={t.id} /></Card> : null}
    </>
  );
}
