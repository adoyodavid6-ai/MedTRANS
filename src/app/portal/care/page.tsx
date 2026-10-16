import { Inbox } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge, VerificationBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAccount } from "@/lib/auth/session";
import { fmtSlot, formatDistance, NEED_DURATION } from "@/lib/doctorcare/status";
import { formatMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { OfferActions } from "./forms";

type Offer = { offer_id: string; booking_number: string; service_name: string; slot_start: string; area: string | null; distance_m: number | null; need_description: string | null; need_duration: string | null; patient_first_name: string; fee_minor: number; expires_at: string };

export default async function Requests() {
  const user = await requireAccount("/portal/care", ["doctor", "nurse"]);
  const supabase = await createClient();
  const [{ data: profile }, { data: offers }, { data: earned }] = await Promise.all([
    supabase.from("provider_profiles").select("verification_status, accepts_bookings, base_location").eq("user_id", user.id).maybeSingle(),
    supabase.rpc("my_offers"),
    supabase.from("care_bookings").select("visit_fee_minor").eq("provider_id", user.id).eq("status", "completed"),
  ]);
  const rows = (offers ?? []) as Offer[];
  const total = (earned ?? []).reduce((s, r) => s + ((r.visit_fee_minor as number) ?? 0), 0);
  return (
    <>
      <Card className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">Your status</h2>
          <VerificationBadge status={(profile?.verification_status ?? "unverified") as "verified"} />
          {profile?.accepts_bookings ? <Badge tone="primary">Accepting requests</Badge> : <Badge>Not accepting requests</Badge>}
        </div>
        {!profile?.base_location ? <Alert tone="warning" title="Set your base location and services to start receiving requests" /> : null}
        <p className="text-sm text-muted">Completed visit fees so far: <strong className="text-ink">{formatMoney(total)}</strong> (before MedTRANS commission and settlement, which are confirmed separately).</p>
      </Card>
      <section aria-labelledby="offers-heading" className="space-y-3">
        <h2 id="offers-heading" className="text-xl font-semibold">Visit requests for you</h2>
        {rows.length === 0 ? <EmptyState icon={Inbox} title="No requests right now">You only receive requests that match your services, travel area and free time.</EmptyState> : rows.map((o) => (
          <Card key={o.offer_id} className="space-y-2">
            <p className="font-semibold text-navy">{o.service_name} · {fmtSlot(o.slot_start)}</p>
            <p className="text-sm text-muted">{o.patient_first_name} · {o.area ?? "Area not given"} · {formatDistance(o.distance_m)} from your base · fee {formatMoney(o.fee_minor)}</p>
            {o.need_description ? <p className="rounded-lg bg-background p-3 text-[0.95rem]">{o.need_description}{o.need_duration ? ` (${NEED_DURATION[o.need_duration]})` : ""}</p> : null}
            <p className="text-sm text-muted">Respond by {fmtSlot(o.expires_at)}, or it goes to the next suitable professional.</p>
            <OfferActions offerId={o.offer_id} />
          </Card>
        ))}
      </section>
    </>
  );
}
