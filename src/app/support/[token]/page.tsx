import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CustomerReplyForm, Messages, RateForm } from "@/components/support/thread";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { TICKET_STATUS } from "@/lib/support/labels";
import { createAnonClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Your message", robots: { index: false, follow: false }, referrer: "no-referrer" };

type T = { id: string; ticket_number: string; subject: string; status: string; satisfaction: number | null; messages: { author_kind: string; body: string; created_at: string }[] };

export default async function GuestTicket({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ new?: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f]{48}$/.test(token)) notFound();
  const { data } = await createAnonClient().rpc("ticket_by_token", { p_token: token });
  const t = data as T | null;
  if (!t) notFound();
  const s = TICKET_STATUS[t.status];
  return (
    <div className="container-page max-w-3xl space-y-5 py-10">
      {(await searchParams).new ? (
        <Alert tone="success" title={`Message received: ${t.ticket_number}`}>
          <p>Keep this page&apos;s link private; it lets you see our reply and respond. We&apos;ll also contact you by your chosen method.</p>
        </Alert>
      ) : null}
      <h1 className="text-2xl font-bold">{t.subject}</h1>
      <p className="flex flex-wrap items-center gap-2 text-muted">{t.ticket_number} <Badge tone={s.tone}>{s.label}</Badge></p>
      <Messages messages={t.messages} />
      {t.status !== "closed" ? <Card><CustomerReplyForm ticketId={t.id} token={token} /></Card> : null}
      {["resolved", "closed"].includes(t.status) && !t.satisfaction ? <Card><RateForm ticketId={t.id} token={token} /></Card> : null}
    </div>
  );
}
