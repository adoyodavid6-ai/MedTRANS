import Link from "next/link";
import { VerificationBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireAccount } from "@/lib/auth/session";
import { VEHICLES } from "@/lib/courier/vehicles";
import { createClient } from "@/lib/supabase/server";
import { CourierForm } from "../pharmacy-forms";

export default async function Couriers() {
  await requireAccount("/ops/couriers", ["admin"]);
  const supabase = await createClient();
  const { data: users } = await supabase.rpc("admin_list_users", { search: null, max_rows: 200 });
  const { data: profiles } = await supabase.from("courier_profiles").select("user_id, verification_status, check_method, vehicle_type, driving_licence_number, operating_area, applied_at");
  const byId = new Map((profiles ?? []).map((p) => [p.user_id, p]));
  // Everyone with the role, plus applicants who have not been verified yet; pending applications first.
  const couriers = ((users ?? []) as { id: string; full_name: string | null; phone: string | null; roles: string[] }[])
    .filter((u) => u.roles.includes("courier") || byId.has(u.id))
    .sort((a, b) => Number(byId.get(b.id)?.verification_status === "pending") - Number(byId.get(a.id)?.verification_status === "pending"));
  return (
    <Card className="space-y-3">
      <h2 className="text-xl font-semibold">Delivery partners</h2>
      <p className="text-sm text-muted">People apply at <Link href="/join/courier" className="underline">/join/courier</Link>. Check their national ID (and driving licence for motorbikes and cars) in person, then verify them here: that grants the delivery partner role. Only verified partners can be assigned orders.</p>
      <ul className="divide-y divide-line">
        {couriers.map((c) => {
          const p = byId.get(c.id);
          const st = (p?.verification_status ?? "unverified") as "verified" | "pending" | "suspended" | "unverified";
          return (
            <li key={c.id} className="space-y-2 py-3">
              <p className="flex flex-wrap items-center gap-2 font-semibold text-navy">{c.full_name ?? "Unnamed"} <span className="text-sm font-normal text-muted">{c.phone ? `+${c.phone.replace(/^\+/, "")}` : ""}</span><VerificationBadge status={st} /></p>
              {p?.vehicle_type ? <p className="text-sm">{VEHICLES[p.vehicle_type]}{p.driving_licence_number ? ` · licence ${p.driving_licence_number}` : ""}{p.operating_area ? ` · covers ${p.operating_area}` : ""}{p.applied_at ? ` · applied ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Africa/Nairobi" }).format(new Date(p.applied_at))}` : ""}</p> : null}
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
