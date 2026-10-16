import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/app/orders/[id]/auto-refresh";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EMERGENCY_STATUS } from "@/lib/emergency/status";
import { createAnonClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Your request", robots: { index: false, follow: false }, referrer: "no-referrer" };

type S = { reference: string; status: string; created_at: string; acknowledged_at: string | null; events: { status: string; at: string; note: string | null }[] };

export default async function RequestStatus({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f]{48}$/.test(token)) notFound();
  const { data } = await createAnonClient().rpc("emergency_request_status", { p_token: token });
  const r = data as S | null;
  if (!r) notFound();
  const s = EMERGENCY_STATUS[r.status];
  const fmt = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeStyle: "short", dateStyle: "medium", timeZone: "Africa/Nairobi" }).format(new Date(iso));
  return (
    <div className="container-page max-w-2xl space-y-5 py-8">
      {!["completed", "cancelled"].includes(r.status) ? <AutoRefresh seconds={10} /> : null}
      <Alert tone="urgent" title="If things get worse, call local emergency services now">
        <p><Link href="/emergency" className="font-semibold underline">Emergency Help</Link> shows what to do and verified numbers.</p>
      </Alert>
      <h1 className="text-2xl font-bold">Request {r.reference}</h1>
      <Card aria-live="polite">
        <Badge tone={s.tone}>{s.label}</Badge>
        <p className="mt-2 text-[0.95rem]">{s.explanation}</p>
        <p className="mt-2 text-sm text-muted">Sent {fmt(r.created_at)}{r.acknowledged_at ? ` · first seen by a responder ${fmt(r.acknowledged_at)}` : ""}</p>
      </Card>
      <Card>
        <h2 className="text-lg font-semibold">What has happened so far</h2>
        <ol className="mt-2 space-y-1 text-[0.95rem]">
          {r.events.map((e, i) => <li key={i}><span className="text-muted">{fmt(e.at)}</span> · {EMERGENCY_STATUS[e.status]?.label}{e.note ? ` — ${e.note}` : ""}</li>)}
        </ol>
      </Card>
      <p className="text-sm text-muted">Keep this page&apos;s link private. MedTRANS does not send ambulances; this page shows only what our responders have actually done.</p>
    </div>
  );
}
