import { Card } from "@/components/ui/card";
import { requireAccount } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { HoursForm, TimeOffForm } from "../forms";

export default async function Availability() {
  const user = await requireAccount("/portal/care/availability", ["doctor", "nurse"]);
  const supabase = await createClient();
  const [{ data: hours }, { data: off }] = await Promise.all([
    supabase.from("provider_weekly_hours").select("weekday, start_time, end_time").eq("provider_id", user.id),
    supabase.from("provider_time_off").select("id, period, note").eq("provider_id", user.id),
  ]);
  return (
    <>
      <Card><h2 className="mb-3 text-xl font-semibold">Working hours</h2><HoursForm hours={(hours ?? []) as { weekday: number; start_time: string; end_time: string }[]} /></Card>
      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">Time off</h2>
        <ul className="text-sm">{(off ?? []).map((o) => <li key={o.id}>{String(o.period)}{o.note ? ` — ${o.note}` : ""}</li>)}</ul>
        <TimeOffForm />
      </Card>
    </>
  );
}
