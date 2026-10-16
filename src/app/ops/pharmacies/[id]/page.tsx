import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { VerificationBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireAccount } from "@/lib/auth/session";
import { namesFor } from "@/lib/profiles";
import { createClient } from "@/lib/supabase/server";
import { LicenceForm, PharmacySettingsForm, StaffForm } from "../../pharmacy-forms";

type V = "verified" | "pending" | "suspended" | "unverified";

export default async function OpsPharmacy({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAccount(`/ops/pharmacies/${id}`, ["admin"]);
  const supabase = await createClient();
  const [{ data: p }, { data: lic }, { data: staff }, { data: areas }, { data: canSell }] = await Promise.all([
    supabase.from("pharmacies").select("id, name, address_line, verification_status, is_listed, is_accepting_orders, delivery_radius_m, delivery_fee_minor, verified_hours, area_id").eq("id", id).maybeSingle(),
    supabase.from("pharmacy_licences").select("id, licence_number, valid_until, status, checked_at, check_method").eq("pharmacy_id", id).order("created_at", { ascending: false }),
    supabase.from("pharmacy_staff").select("id, user_id, staff_role, registration_number, registration_status").eq("pharmacy_id", id),
    supabase.from("service_coverage_areas").select("id, name").order("name"),
    supabase.rpc("pharmacy_can_sell", { p: id }),
  ]);
  if (!p) notFound();
  const names = await namesFor((staff ?? []).map((s) => s.user_id as string));
  return (
    <>
      <Card>
        <div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold">{p.name}</h2><VerificationBadge status={p.verification_status as V} /></div>
        <p className="text-sm text-muted">{p.address_line}</p>
        {canSell ? <Alert tone="success" title="All gates pass: this pharmacy can take orders." className="mt-3" /> : (
          <Alert tone="warning" title="This pharmacy cannot take orders yet" className="mt-3">
            <p>Needs: verified status, a current verified licence, a verified pharmacist, accepting orders, delivery radius and fee, and an active coverage area with Pharmacy switched on in an active country.</p>
          </Alert>
        )}
      </Card>
      <Card><h2 className="mb-3 text-lg font-semibold">Settings</h2><PharmacySettingsForm p={p} areas={(areas ?? []) as { id: string; name: string }[]} /></Card>
      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">Licences</h2>
        <ul className="space-y-1 text-[0.95rem]">
          {(lic ?? []).map((l) => <li key={l.id} className="flex flex-wrap items-center gap-2">{l.licence_number} · valid until {l.valid_until} <VerificationBadge status={l.status as V} /> <span className="text-sm text-muted">{l.check_method}</span></li>)}
          {(lic ?? []).length === 0 ? <li className="text-muted">No licence recorded.</li> : null}
        </ul>
        <LicenceForm pharmacyId={p.id} />
      </Card>
      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">Staff</h2>
        <ul className="space-y-1 text-[0.95rem]">
          {((staff ?? []) as { id: string; user_id: string; staff_role: string; registration_number: string | null; registration_status: V }[]).map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-2">{names.get(s.user_id) ?? "Unnamed"} · {s.staff_role}{s.staff_role === "pharmacist" ? <> · reg {s.registration_number ?? "—"} <VerificationBadge status={s.registration_status} /></> : null}</li>
          ))}
        </ul>
        <StaffForm pharmacyId={p.id} />
      </Card>
    </>
  );
}
