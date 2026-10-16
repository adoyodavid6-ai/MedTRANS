import { Siren, Timer } from "lucide-react";
import { AreaShell } from "@/components/account/area-shell";
import { PortalPlaceholder } from "@/components/account/portal-placeholder";
import { AutoRefresh } from "@/app/orders/[id]/auto-refresh";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAccount } from "@/lib/auth/session";
import { isEmergencyOperationStaffed } from "@/lib/emergency/contacts";
import { EMERGENCY_STATUS, SEVERITY } from "@/lib/emergency/status";
import { timeAgo } from "@/lib/pharmacy/status";
import { createClient } from "@/lib/supabase/server";
import { ResponderActions } from "./responder-forms";

export const metadata = { title: "Emergency operations" };

type R = { id: string; reference: string; status: string; severity: string | null; caller_name: string | null; callback_phone: string; location_text: string | null; location_shared: boolean; nature: string | null; conscious: string; breathing: string; repeat_count: number; created_at: string; acknowledged_at: string | null };

export default async function EmergencyPortal() {
  const user = await requireAccount("/portal/emergency", ["emergency_responder"]);
  const staffed = await isEmergencyOperationStaffed();
  const supabase = await createClient();
  const { data } = await supabase.from("emergency_requests").select("id, reference, status, severity, caller_name, callback_phone, location_text, location_shared, nature, conscious, breathing, repeat_count, created_at, acknowledged_at")
    .not("status", "in", "(completed,cancelled)").order("created_at");
  const rows = (data ?? []) as R[];
  return (
    <AreaShell title="Emergency operations" roles={user.roles} nav={[{ href: "/portal/emergency", label: "Queue" }]}>
      {!staffed && rows.length === 0 ? (
        <PortalPlaceholder intro="The MedTRANS emergency operation is switched off, so no requests are being accepted. An administrator switches it on only when a staffed, supervised operation is in place."
          verificationNote="Responders need training and supervision arrangements recorded by MedTRANS operations."
          sections={[{ icon: Siren, title: "Request queue", body: "Appears when the operation is staffed." }, { icon: Timer, title: "Acknowledgement tracking", body: "Time to first acknowledgement is recorded for every request." }]} />
      ) : (
        <>
          <AutoRefresh seconds={10} />
          {rows.length === 0 ? <EmptyState icon={Siren} title="No open requests" /> : rows.map((r) => {
            const waiting = r.status === "received";
            return (
              <Card key={r.id} className={waiting ? "space-y-3 border-urgent" : "space-y-3"}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-navy">{r.reference} · {r.caller_name ?? "Caller"} · <a href={`tel:${r.callback_phone}`} className="text-primary underline">{r.callback_phone}</a></p>
                  <span className="flex gap-1.5">{r.severity ? <Badge tone={r.severity === "life_threatening" ? "urgent" : "warning"}>{SEVERITY[r.severity]}</Badge> : null}<Badge tone={EMERGENCY_STATUS[r.status].tone}>{EMERGENCY_STATUS[r.status].label}</Badge></span>
                </div>
                <p className={waiting ? "text-sm font-semibold text-urgent" : "text-sm text-muted"}>Received {timeAgo(r.created_at)}{waiting ? " · NOT YET ACKNOWLEDGED" : r.acknowledged_at ? ` · acknowledged ${timeAgo(r.acknowledged_at)}` : ""}{r.repeat_count ? ` · submitted ${r.repeat_count + 1} times` : ""}</p>
                <dl className="grid gap-1 text-[0.95rem] sm:grid-cols-2">
                  <div><dt className="inline text-muted">Situation: </dt><dd className="inline">{r.nature ?? "Not given"}</dd></div>
                  <div><dt className="inline text-muted">Awake / breathing: </dt><dd className="inline">{r.conscious} / {r.breathing}</dd></div>
                  <div className="sm:col-span-2"><dt className="inline text-muted">Location: </dt><dd className="inline">{r.location_text ?? "Not given"}{r.location_shared ? " · device location shared" : ""}</dd></div>
                </dl>
                <ResponderActions requestId={r.id} status={r.status} severity={r.severity} />
              </Card>
            );
          })}
        </>
      )}
    </AreaShell>
  );
}
