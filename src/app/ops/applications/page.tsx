import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireAccount } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ApplicationForm } from "../commercial-forms";

const fmt = (iso: string) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Nairobi" }).format(new Date(iso));
const DETAIL_LABELS: Record<string, string> = { licence_number: "PPB licence", town: "Town", organisation_type: "Type", message: "Message" };

export default async function Applications() {
  await requireAccount("/ops/applications", ["admin"]);
  const supabase = await createClient();
  const { data: rows } = await supabase.from("partner_applications").select("*").order("created_at", { ascending: false }).limit(200);
  return (
    <Card className="p-0 sm:p-0">
      <div className="p-4"><h2 className="text-xl font-semibold">Partner applications</h2>
        <p className="text-sm text-muted">Approving an application records the decision only. Pharmacies still need licence verification in Pharmacies before they can sell.</p></div>
      <ul className="divide-y divide-line">
        {(rows ?? []).map((r) => (
          <li key={r.id} className="space-y-2 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-navy">{r.organisation_name} <span className="font-normal text-muted">· {r.kind} · {fmt(r.created_at)}</span></p>
              <Badge tone={r.status === "approved" ? "success" : r.status === "declined" ? "neutral" : "warning"}>{r.status.replace("_", " ")}</Badge>
            </div>
            <p className="text-sm">{r.contact_name} · {[r.contact_phone, r.contact_email].filter(Boolean).join(" · ")}</p>
            <dl className="grid gap-x-4 text-sm sm:grid-cols-[auto_1fr]">
              {Object.entries((r.details ?? {}) as Record<string, string>).map(([k, v]) => (
                <div key={k} className="contents"><dt className="text-muted">{DETAIL_LABELS[k] ?? k}</dt><dd className="whitespace-pre-line">{v}</dd></div>
              ))}
            </dl>
            {r.review_note ? <p className="text-sm text-muted">Note: {r.review_note}</p> : null}
            <ApplicationForm id={r.id} status={r.status} />
          </li>
        ))}
        {(rows ?? []).length === 0 ? <li className="p-4 text-muted">No applications yet.</li> : null}
      </ul>
    </Card>
  );
}
