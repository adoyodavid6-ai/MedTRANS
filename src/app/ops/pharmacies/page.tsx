import Link from "next/link";
import { Badge, VerificationBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireAccount } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { CreatePharmacyForm } from "../pharmacy-forms";

export default async function OpsPharmacies() {
  await requireAccount("/ops/pharmacies", ["admin"]);
  const supabase = await createClient();
  const [{ data }, { data: areas }] = await Promise.all([
    supabase.from("pharmacies").select("id, name, address_line, verification_status, is_listed").order("name"),
    supabase.from("service_coverage_areas").select("id, name").order("name"),
  ]);
  const rows = (data ?? []) as { id: string; name: string; address_line: string; verification_status: "verified" | "pending" | "suspended" | "unverified"; is_listed: boolean }[];
  const sellable = await Promise.all(rows.map(async (r) => (await supabase.rpc("pharmacy_can_sell", { p: r.id })).data === true));
  return (
    <>
      <Card>
        <h2 className="text-xl font-semibold">Pharmacies</h2>
        <ul className="mt-3 divide-y divide-line">
          {rows.map((r, i) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div><Link href={`/ops/pharmacies/${r.id}`} className="font-semibold text-navy underline">{r.name}</Link><p className="text-sm text-muted">{r.address_line}</p></div>
              <div className="flex flex-wrap gap-1.5"><VerificationBadge status={r.verification_status} />{r.is_listed ? <Badge>Listed</Badge> : null}{sellable[i] ? <Badge tone="primary">Can sell</Badge> : <Badge tone="warning">Cannot sell</Badge>}</div>
            </li>
          ))}
          {rows.length === 0 ? <li className="py-3 text-muted">No pharmacies yet.</li> : null}
        </ul>
      </Card>
      <Card>
        <h2 className="mb-3 text-lg font-semibold">Add a pharmacy</h2>
        <CreatePharmacyForm areas={(areas ?? []) as { id: string; name: string }[]} />
      </Card>
    </>
  );
}
