import Link from "next/link";
import { Inbox } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAccount } from "@/lib/auth/session";
import { PRESCRIPTION_STATUS } from "@/lib/pharmacy/status";
import { isVerifiedPharmacist, myPharmacyMemberships } from "@/lib/pharmacy/staff";
import { createClient } from "@/lib/supabase/server";

export default async function Queue() {
  await requireAccount("/portal/pharmacy/prescriptions", ["pharmacist", "pharmacy_admin"]);
  const ms = await myPharmacyMemberships();
  const ph = ms[0]?.pharmacies;
  if (!ph || !isVerifiedPharmacist(ms, ph.id)) {
    return <Alert tone="info" title="Only verified pharmacists can review prescriptions"><p>Prescriptions are visible only to pharmacists whose registration MedTRANS has checked.</p></Alert>;
  }
  const supabase = await createClient();
  const { data } = await supabase.from("prescriptions").select("id, status, created_at, prescription_items(quantity_requested)")
    .eq("pharmacy_id", ph.id).order("status").order("created_at").limit(100);
  const rows = (data ?? []) as { id: string; status: string; created_at: string; prescription_items: { quantity_requested: number }[] }[];
  const fmt = (iso: string) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Nairobi" }).format(new Date(iso));
  return (
    <section aria-labelledby="q-heading" className="space-y-3">
      <h2 id="q-heading" className="text-xl font-semibold">Prescriptions</h2>
      {rows.length === 0 ? <EmptyState icon={Inbox} title="Nothing to review" /> : (
        <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <Link href={`/portal/pharmacy/prescriptions/${r.id}`} className="font-semibold text-navy underline">Prescription received {fmt(r.created_at)}</Link>
                <p className="text-sm text-muted">{r.prescription_items.length} medicine{r.prescription_items.length === 1 ? "" : "s"} requested</p>
              </div>
              <Badge tone={PRESCRIPTION_STATUS[r.status].tone}>{PRESCRIPTION_STATUS[r.status].label}</Badge>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
