import { SettlementList, type SettlementRow } from "@/components/account/settlement-list";
import { Card } from "@/components/ui/card";
import { requireAccount } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function Earnings() {
  const user = await requireAccount("/portal/care/earnings", ["doctor", "nurse"]);
  const supabase = await createClient();
  const { data } = await supabase.from("settlements").select("id, period_start, period_end, item_count, gross_minor, commission_minor, net_minor, currency, status, paid_reference, paid_at").eq("provider_id", user.id).neq("status", "void").order("period_end", { ascending: false });
  return <Card><h2 className="mb-3 text-xl font-semibold">Earnings &amp; settlements</h2><SettlementList rows={(data ?? []) as SettlementRow[]} /></Card>;
}
