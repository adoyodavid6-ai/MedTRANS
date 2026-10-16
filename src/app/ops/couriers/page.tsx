import { VerificationBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireAccount } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { CourierForm } from "../pharmacy-forms";

export default async function Couriers() {
  await requireAccount("/ops/couriers", ["admin"]);
  const supabase = await createClient();
  const { data: users } = await supabase.rpc("admin_list_users", { search: null, max_rows: 200 });
  const couriers = ((users ?? []) as { id: string; full_name: string | null; phone: string | null; roles: string[] }[]).filter((u) => u.roles.includes("courier"));
  const { data: profiles } = await supabase.from("courier_profiles").select("user_id, verification_status, check_method");
  const byId = new Map((profiles ?? []).map((p) => [p.user_id, p]));
  return (
    <Card className="space-y-3">
      <h2 className="text-xl font-semibold">Delivery partners</h2>
      <p className="text-sm text-muted">Grant the Delivery partner role in Users &amp; roles first. Only verified partners can be assigned orders.</p>
      <ul className="divide-y divide-line">
        {couriers.map((c) => {
          const p = byId.get(c.id);
          const st = (p?.verification_status ?? "unverified") as "verified" | "pending" | "suspended" | "unverified";
          return (
            <li key={c.id} className="space-y-2 py-3">
              <p className="flex flex-wrap items-center gap-2 font-semibold text-navy">{c.full_name ?? "Unnamed"} <span className="text-sm font-normal text-muted">{c.phone ? `+${c.phone.replace(/^\+/, "")}` : ""}</span><VerificationBadge status={st} /></p>
              {p?.check_method ? <p className="text-sm text-muted">Checked: {p.check_method}</p> : null}
              <CourierForm userId={c.id} status={st} />
            </li>
          );
        })}
        {couriers.length === 0 ? <li className="py-3 text-muted">No delivery partners yet.</li> : null}
      </ul>
    </Card>
  );
}
