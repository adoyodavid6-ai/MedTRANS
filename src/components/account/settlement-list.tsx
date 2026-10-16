import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/money";

export type SettlementRow = { id: string; period_start: string; period_end: string; item_count: number; gross_minor: number; commission_minor: number; net_minor: number; currency: string; status: string; paid_reference: string | null; paid_at: string | null };

const LABEL: Record<string, string> = { draft: "Being checked", approved: "Approved, payout pending", paid: "Paid", void: "Withdrawn" };

export function SettlementList({ rows }: { rows: SettlementRow[] }) {
  if (rows.length === 0) return <p className="text-muted">No settlements yet. They are calculated after each period from completed work.</p>;
  return (
    <ul className="divide-y divide-line">
      {rows.map((s) => (
        <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
          <div>
            <p className="font-semibold text-navy">{s.period_start} to {s.period_end}</p>
            <p className="text-sm text-muted">{s.item_count} item{s.item_count === 1 ? "" : "s"} · gross {formatMoney(s.gross_minor, s.currency)} · commission {formatMoney(s.commission_minor, s.currency)}{s.paid_reference ? ` · reference ${s.paid_reference}` : ""}</p>
          </div>
          <div className="flex items-center gap-2"><span className="font-semibold tabular-nums">{formatMoney(s.net_minor, s.currency)}</span><Badge tone={s.status === "paid" ? "success" : "warning"}>{LABEL[s.status]}</Badge></div>
        </li>
      ))}
    </ul>
  );
}
