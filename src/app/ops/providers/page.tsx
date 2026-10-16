import { VerificationBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireAccount } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ProviderStatusForm } from "../care-forms";

type P = { user_id: string; profession: string; display_name: string; regulator: string; registration_number: string; verification_status: "verified" | "pending" | "suspended" | "unverified"; check_method: string | null; accepts_bookings: boolean; created_at: string };

export default async function Providers() {
  await requireAccount("/ops/providers", ["admin"]);
  const supabase = await createClient();
  const { data } = await supabase.from("provider_profiles").select("user_id, profession, display_name, regulator, registration_number, verification_status, check_method, accepts_bookings, created_at").order("verification_status").order("created_at");
  const rows = (data ?? []) as P[];
  return (
    <Card className="space-y-3">
      <h2 className="text-xl font-semibold">Doctors &amp; nurses</h2>
      <p className="text-sm text-muted">Verify only after checking the registration with the regulator yourself. Verifying grants the clinical role; suspending stops new requests immediately.</p>
      <ul className="divide-y divide-line">
        {rows.map((p) => (
          <li key={p.user_id} className="space-y-2 py-3">
            <p className="flex flex-wrap items-center gap-2 font-semibold text-navy">{p.display_name} <VerificationBadge status={p.verification_status} /></p>
            <p className="text-sm text-muted">{p.profession} · {p.regulator} {p.registration_number}{p.check_method ? ` · checked: ${p.check_method}` : ""}</p>
            <ProviderStatusForm providerId={p.user_id} status={p.verification_status} />
          </li>
        ))}
        {rows.length === 0 ? <li className="py-3 text-muted">No applications yet.</li> : null}
      </ul>
    </Card>
  );
}
