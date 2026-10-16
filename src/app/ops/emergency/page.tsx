import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { requireAccount } from "@/lib/auth/session";
import { EMERGENCY_STATUS } from "@/lib/emergency/status";
import { daysAgoIso } from "@/lib/pharmacy/status";
import { createClient } from "@/lib/supabase/server";
import { OperationForm } from "./operation-form";

export default async function OpsEmergency() {
  await requireAccount("/ops/emergency", ["admin"]);
  const supabase = await createClient();
  const [{ data: setting }, { data: staffed }, { data: reqs }, { data: users }] = await Promise.all([
    supabase.from("platform_settings").select("value").eq("key", "emergency.operation").single(),
    supabase.rpc("emergency_operation_staffed"),
    supabase.from("emergency_requests").select("status, created_at, acknowledged_at").gte("created_at", daysAgoIso(30)),
    supabase.rpc("admin_list_users", { search: null, max_rows: 200 }),
  ]);
  const v = (setting?.value ?? {}) as { staffed?: boolean; hours?: string; supervisor?: string };
  const responders = ((users ?? []) as { roles: string[] }[]).filter((u) => u.roles.includes("emergency_responder")).length;
  const rows = reqs ?? [];
  const acked = rows.filter((r) => r.acknowledged_at).map((r) => (new Date(r.acknowledged_at!).getTime() - new Date(r.created_at).getTime()) / 60000);
  const median = acked.length ? acked.sort((a, b) => a - b)[Math.floor(acked.length / 2)] : null;
  const waiting = rows.filter((r) => r.status === "received").length;
  return (
    <>
      <Card className="space-y-3">
        <h2 className="text-xl font-semibold">Emergency coordination operation</h2>
        {staffed ? <Alert tone="success" title="Live: Emergency Help shows the callback form" /> : <Alert tone="info" title="Off: Emergency Help is guidance and verified numbers only" />}
        <p className="text-sm text-muted">Active responders: {responders}. Grant the Emergency responder role in Users &amp; roles.</p>
        <OperationForm staffed={Boolean(v.staffed)} hours={v.hours ?? ""} supervisor={v.supervisor ?? ""} />
      </Card>
      <Card>
        <h2 className="text-lg font-semibold">Last 30 days</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-3">
          <div><dt className="text-sm text-muted">Requests</dt><dd className="text-2xl font-semibold tabular-nums">{rows.length}</dd></div>
          <div><dt className="text-sm text-muted">Waiting for acknowledgement now</dt><dd className={waiting ? "text-2xl font-semibold text-urgent tabular-nums" : "text-2xl font-semibold tabular-nums"}>{waiting}</dd></div>
          <div><dt className="text-sm text-muted">Median time to acknowledge</dt><dd className="text-2xl font-semibold tabular-nums">{median === null ? "—" : `${median.toFixed(1)} min`}</dd></div>
        </dl>
        <ul className="mt-3 text-sm text-muted">{Object.entries(EMERGENCY_STATUS).map(([k, s]) => { const n = rows.filter((r) => r.status === k).length; return n ? <li key={k}>{s.label}: {n}</li> : null; })}</ul>
      </Card>
    </>
  );
}
