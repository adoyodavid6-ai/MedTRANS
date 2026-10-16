import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireAccount } from "@/lib/auth/session";
import { formatMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { togglePlan } from "../commercial-actions";
import { PlanForm } from "../commercial-forms";

export default async function Plans() {
  await requireAccount("/ops/plans", ["admin"]);
  const supabase = await createClient();
  const { data: plans } = await supabase.from("subscription_plans").select("*").order("created_at", { ascending: false });
  return (
    <>
      <Card className="p-0 sm:p-0">
        <div className="p-4"><h2 className="text-xl font-semibold">Subscription plans</h2>
          <p className="text-sm text-muted">A plan can only be shown on the Partnerships page once its price and billing period are confirmed. No plan is billed automatically.</p></div>
        <ul className="divide-y divide-line">
          {(plans ?? []).map((p) => (
            <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
              <div>
                <p className="font-semibold text-navy">{p.name} <span className="font-normal text-muted">· {p.audience}</span></p>
                <p className="text-sm">{p.summary}</p>
                <p className="text-sm text-muted">{p.price_minor !== null && p.billing_period ? `${formatMoney(p.price_minor)} per ${p.billing_period}` : "Price not confirmed"}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={p.is_active ? "success" : "neutral"}>{p.is_active ? "Shown" : "Hidden"}</Badge>
                <form action={togglePlan}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="active" value={String(!p.is_active)} />
                  <Button type="submit" variant="secondary" disabled={!p.is_active && (p.price_minor === null || !p.billing_period)}>{p.is_active ? "Hide" : "Show"}</Button></form>
              </div>
            </li>
          ))}
          {(plans ?? []).length === 0 ? <li className="p-4 text-muted">No plans yet.</li> : null}
        </ul>
      </Card>
      <Card><h2 className="mb-3 text-lg font-semibold">New plan</h2><PlanForm /></Card>
    </>
  );
}
