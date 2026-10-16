import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Badge, VerificationBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireAccount } from "@/lib/auth/session";
import { myPharmacyMemberships } from "@/lib/pharmacy/staff";
import { createClient } from "@/lib/supabase/server";

export default async function PharmacyOverview() {
  await requireAccount("/portal/pharmacy", ["pharmacist", "pharmacy_admin"]);
  const ms = await myPharmacyMemberships();
  if (ms.length === 0) {
    return (
      <Alert tone="info" title="You are not linked to a pharmacy yet">
        <p>An administrator links your account to your pharmacy and checks your professional registration. Until then there is nothing to manage here.</p>
      </Alert>
    );
  }
  const supabase = await createClient();
  const ph = ms[0].pharmacies;
  const [{ data: canSell }, { count: queue }, { count: toAccept }, { count: inProgress }] = await Promise.all([
    supabase.rpc("pharmacy_can_sell", { p: ph.id }),
    supabase.from("prescriptions").select("id", { count: "exact", head: true }).eq("pharmacy_id", ph.id).eq("status", "submitted"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("pharmacy_id", ph.id).eq("status", "awaiting_pharmacy_acceptance"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("pharmacy_id", ph.id).in("status", ["confirmed", "preparing"]),
  ]);
  return (
    <>
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold">{ph.name}</h2>
          <VerificationBadge status={ph.verification_status} />
          {canSell ? <Badge tone="primary">Taking orders</Badge> : <Badge>Not taking orders</Badge>}
        </div>
        <ul className="mt-3 space-y-1 text-sm text-muted">
          {ms.map((m) => (
            <li key={m.staff_role}>Your role: {m.staff_role}{m.staff_role === "pharmacist" ? <> · registration <VerificationBadge status={m.registration_status} /></> : null}</li>
          ))}
        </ul>
        {!canSell ? <p className="mt-3 text-sm">Patients can&apos;t order until the pharmacy, its licence and at least one pharmacist are verified, and delivery is configured. Contact MedTRANS operations.</p> : null}
      </Card>
      <dl className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Prescriptions to review", value: queue ?? 0, href: "/portal/pharmacy/prescriptions" },
          { label: "Orders to accept", value: toAccept ?? 0, href: "/portal/pharmacy/orders" },
          { label: "Orders being prepared", value: inProgress ?? 0, href: "/portal/pharmacy/orders" },
        ].map((m) => (
          <Card key={m.label} className="p-4">
            <dt className="text-sm text-muted">{m.label}</dt>
            <dd className="mt-1 text-3xl font-semibold text-navy tabular-nums">{m.value}</dd>
            <dd><Link href={m.href} className="text-sm font-semibold text-primary underline">Open</Link></dd>
          </Card>
        ))}
      </dl>
    </>
  );
}
