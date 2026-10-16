import { Card } from "@/components/ui/card";
import { requireAccount } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

type Entry = { id: number; occurred_at: string; actor_id: string | null; action: string; table_name: string | null; record_id: string | null; changed_fields: string[] | null; metadata: Record<string, unknown> };

export default async function AuditPage() {
  await requireAccount("/ops/audit", ["admin"]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_logs")
    .select("id, occurred_at, actor_id, action, table_name, record_id, changed_fields, metadata")
    .order("id", { ascending: false })
    .limit(100);
  const rows = (data ?? []) as Entry[];
  const fmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "short", timeStyle: "medium", timeZone: "Africa/Nairobi" });

  return (
    <Card className="p-0 sm:p-0">
      <div className="p-5">
        <h2 className="text-xl font-semibold">Audit log</h2>
        <p className="mt-1 text-sm text-muted">Latest 100 entries. Append-only: entries cannot be edited or deleted. Records which fields changed, never their values.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[42rem] text-left text-sm">
          <caption className="sr-only">Audit log entries, newest first</caption>
          <thead className="border-y border-line bg-background text-xs text-muted uppercase">
            <tr>
              <th scope="col" className="px-4 py-2 font-semibold">Time (EAT)</th>
              <th scope="col" className="px-4 py-2 font-semibold">Action</th>
              <th scope="col" className="px-4 py-2 font-semibold">Record</th>
              <th scope="col" className="px-4 py-2 font-semibold">Fields / details</th>
              <th scope="col" className="px-4 py-2 font-semibold">Actor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2 whitespace-nowrap tabular-nums">{fmt.format(new Date(r.occurred_at))}</td>
                <td className="px-4 py-2 font-medium">{r.action}</td>
                <td className="px-4 py-2">{r.table_name}{r.record_id ? <span className="block font-mono text-xs text-muted">{r.record_id.slice(0, 8)}…</span> : null}</td>
                <td className="px-4 py-2">{r.changed_fields?.join(", ") || (Object.keys(r.metadata ?? {}).length ? JSON.stringify(r.metadata) : "—")}</td>
                <td className="px-4 py-2 font-mono text-xs">{r.actor_id ? `${r.actor_id.slice(0, 8)}…` : "system"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
