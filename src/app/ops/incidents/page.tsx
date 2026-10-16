import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireAccount } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { IncidentForm } from "../support-forms";

export default async function Incidents() {
  await requireAccount("/ops/incidents", ["admin"]);
  const supabase = await createClient();
  const { data } = await supabase.from("safety_incidents").select("id, reference, kind, severity, status, reporter_capacity, related_order_id, related_booking_id, description, resolution_note, created_at").order("status").order("created_at", { ascending: false }).limit(200);
  const fmt = (iso: string) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Nairobi" }).format(new Date(iso));
  return (
    <Card className="space-y-3">
      <h2 className="text-xl font-semibold">Safety incidents</h2>
      <p className="text-sm text-muted">Reports may contain health information. Access is limited to administrators for safety governance, and every view is part of the audit trail of this page&apos;s actions.</p>
      <ul className="divide-y divide-line">
        {(data ?? []).map((i) => (
          <li key={i.id} className="space-y-2 py-4">
            <p className="flex flex-wrap items-center gap-2 font-semibold text-navy">{i.reference} · {i.kind.replace(/_/g, " ")}
              <Badge tone={i.severity === "critical" || i.severity === "severe" ? "urgent" : "warning"}>{i.severity}</Badge>
              <Badge tone={i.status === "resolved" ? "success" : "primary"}>{i.status}</Badge></p>
            <p className="text-sm text-muted">Reported {fmt(i.created_at)} by a {i.reporter_capacity}{i.related_order_id ? " · about an order" : ""}{i.related_booking_id ? " · about a home visit" : ""}</p>
            <p className="text-[0.95rem]">{i.description}</p>
            {i.resolution_note ? <p className="text-sm"><strong>Resolution:</strong> {i.resolution_note}</p> : null}
            <IncidentForm id={i.id} status={i.status} severity={i.severity} />
          </li>
        ))}
        {(data ?? []).length === 0 ? <li className="py-3 text-muted">No incidents reported.</li> : null}
      </ul>
    </Card>
  );
}
