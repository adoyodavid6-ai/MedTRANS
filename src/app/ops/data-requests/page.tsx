import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireAccount } from "@/lib/auth/session";
import { namesFor } from "@/lib/profiles";
import { createClient } from "@/lib/supabase/server";
import { ErasureDecision } from "./forms";

const fmt = (iso: string) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Nairobi" }).format(new Date(iso));
type Preview = { remove: Record<string, number>; retain: Record<string, number>; open_orders: number; open_bookings: number; staff_roles: string[] };

export default async function DataRequests() {
  await requireAccount("/ops/data-requests", ["admin"]);
  const supabase = await createClient();
  const { data: rows } = await supabase.from("data_subject_requests").select("*").eq("kind", "erasure").order("created_at", { ascending: false }).limit(200);
  const open = (rows ?? []).filter((r) => ["received", "in_progress"].includes(r.status));
  const names = await namesFor(open.map((r) => r.user_id as string).filter(Boolean));
  const previews = new Map<string, Preview>();
  await Promise.all(open.map(async (r) => {
    const { data } = await supabase.rpc("admin_erasure_preview", { p_request: r.id });
    if (data) previews.set(r.id, data as Preview);
  }));
  const { count: exports } = await supabase.from("data_subject_requests").select("id", { count: "exact", head: true }).eq("kind", "export");
  return (
    <>
      <Card className="space-y-2">
        <h2 className="text-xl font-semibold">Data requests</h2>
        <p className="text-sm text-muted">Deletion requests must be answered within the statutory period. Finish or cancel any open orders or visits and revoke staff roles first. Records the law requires us to keep are retained; tell the person what they are. {exports ?? 0} self-service data download{exports === 1 ? "" : "s"} recorded.</p>
      </Card>
      <Card className="p-0 sm:p-0">
        <ul className="divide-y divide-line">
          {(rows ?? []).map((r) => {
            const pv = previews.get(r.id);
            return (
              <li key={r.id} className="space-y-2 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-navy">{names.get(r.user_id) ?? "Account"} <span className="font-normal text-muted">· requested {fmt(r.created_at)}</span></p>
                  <Badge tone={r.status === "completed" ? "success" : r.status === "declined" ? "neutral" : "warning"}>{r.status.replace("_", " ")}</Badge>
                </div>
                {r.reason ? <p className="text-sm">Reason: {r.reason}</p> : null}
                {pv ? (
                  <p className="text-sm">Will remove: {Object.entries(pv.remove).map(([k, n]) => `${n} ${k.replace("_", " ")}`).join(", ")}. Will retain: {Object.entries(pv.retain).map(([k, n]) => `${n} ${k}`).join(", ")}.
                    {pv.open_orders + pv.open_bookings > 0 ? <strong className="text-urgent"> {pv.open_orders} open order(s) and {pv.open_bookings} open visit(s) must finish first.</strong> : null}
                    {pv.staff_roles.length ? <strong className="text-urgent"> Revoke roles first: {pv.staff_roles.join(", ")}.</strong> : null}</p>
                ) : null}
                {r.outcome_note ? <p className="text-sm text-muted">Outcome: {r.outcome_note}</p> : null}
                {["received", "in_progress"].includes(r.status) ? <ErasureDecision id={r.id} /> : null}
              </li>
            );
          })}
          {(rows ?? []).length === 0 ? <li className="p-4 text-muted">No deletion requests.</li> : null}
        </ul>
      </Card>
    </>
  );
}
