import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireAccount } from "@/lib/auth/session";
import { formatMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { namesFor } from "@/lib/profiles";
import { GenerateForm, SettlementActions } from "../commercial-forms";

function lastMonth() {
  const now = new Date();
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  return { start: first.toISOString().slice(0, 10), end: last.toISOString().slice(0, 10) };
}

export default async function Settlements() {
  await requireAccount("/ops/settlements", ["admin"]);
  const supabase = await createClient();
  const [{ data: rows }, { data: rates }, { data: pharmacies }] = await Promise.all([
    supabase.from("settlements").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.from("platform_settings").select("key, value").in("key", ["commission.pharmacy_bps", "commission.doctorcare_bps"]),
    supabase.from("pharmacies").select("id, name"),
  ]);
  const rate = (k: string) => rates?.find((r) => r.key === k)?.value;
  const ratesSet = typeof rate("commission.pharmacy_bps") === "number" && typeof rate("commission.doctorcare_bps") === "number";
  const phNames = new Map((pharmacies ?? []).map((p) => [p.id, p.name]));
  const provNames = await namesFor((rows ?? []).filter((r) => r.provider_id).map((r) => r.provider_id as string));
  const lm = lastMonth();
  return (
    <>
      <Card className="space-y-3">
        <h2 className="text-xl font-semibold">Settlements</h2>
        {ratesSet ? (
          <p className="text-sm text-muted">Commission: pharmacy {Number(rate("commission.pharmacy_bps")) / 100}% of item sales · DoctorCare {Number(rate("commission.doctorcare_bps")) / 100}% of visit fees. Delivery, service and booking fees are MedTRANS revenue.</p>
        ) : (
          <Alert tone="warning" title="Commission rates are not confirmed"><p>Set <code>commission.pharmacy_bps</code> and <code>commission.doctorcare_bps</code> in Settings once agreed. Settlements can&apos;t be calculated until then.</p></Alert>
        )}
        <GenerateForm defaultStart={lm.start} defaultEnd={lm.end} />
        <p className="text-xs text-muted">MedTRANS does not send payouts automatically. Pay through your bank or M-Pesa B2C, then record the reference. A second administrator must record each payout.</p>
      </Card>
      <Card className="p-0 sm:p-0">
        <ul className="divide-y divide-line">
          {(rows ?? []).map((s) => (
            <li key={s.id} className="space-y-2 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-navy">{s.payee_kind === "pharmacy" ? phNames.get(s.pharmacy_id) : provNames.get(s.provider_id)} · {s.period_start} to {s.period_end}</p>
                <Badge tone={s.status === "paid" ? "success" : s.status === "void" ? "neutral" : "warning"}>{s.status}</Badge>
              </div>
              <p className="text-sm">{s.item_count} item{s.item_count === 1 ? "" : "s"} · gross {formatMoney(s.gross_minor, s.currency)} · commission {formatMoney(s.commission_minor, s.currency)} · <strong>net {formatMoney(s.net_minor, s.currency)}</strong>{s.paid_reference ? ` · paid ref ${s.paid_reference}` : ""}</p>
              <SettlementActions id={s.id} status={s.status} />
            </li>
          ))}
          {(rows ?? []).length === 0 ? <li className="p-4 text-muted">No settlements yet.</li> : null}
        </ul>
      </Card>
    </>
  );
}
