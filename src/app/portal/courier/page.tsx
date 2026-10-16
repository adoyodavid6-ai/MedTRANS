import { Bike } from "lucide-react";
import { AreaShell } from "@/components/account/area-shell";
import { Alert } from "@/components/ui/alert";
import { Badge, VerificationBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAccount } from "@/lib/auth/session";
import { ORDER_STATUS } from "@/lib/pharmacy/status";
import { createClient } from "@/lib/supabase/server";
import { AssignmentActions } from "./assignment";

export const metadata = { title: "Delivery portal" };

type A = {
  order_id: string; order_number: string; status: string; pharmacy_name: string; pharmacy_address: string; pharmacy_phone: string | null;
  pharmacy_lat: number; pharmacy_lng: number; delivery_address: { line1: string; area: string | null; building_details: string | null; landmark: string | null };
  delivery_lat: number; delivery_lng: number; recipient_name: string; recipient_phone: string | null; item_count: number; handover_locked: boolean;
};

const mapLink = (lat: number, lng: number) => `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;

export default async function CourierPortal() {
  const user = await requireAccount("/portal/courier", ["courier"]);
  const supabase = await createClient();
  const [{ data: profile }, { data }] = await Promise.all([
    supabase.from("courier_profiles").select("verification_status").eq("user_id", user.id).maybeSingle(),
    supabase.rpc("courier_assignments"),
  ]);
  const status = (profile?.verification_status ?? "unverified") as "verified" | "pending" | "suspended" | "unverified";
  const jobs = (data ?? []) as A[];
  return (
    <AreaShell title="Delivery portal" roles={user.roles} nav={[{ href: "/portal/courier", label: "Assignments" }]}>
      <Card className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">Identity verification</h2>
        <VerificationBadge status={status} />
        {status !== "verified" ? <p className="w-full text-sm text-muted">You can be assigned deliveries once MedTRANS operations has checked your identity.</p> : null}
      </Card>
      <Alert tone="info" title="Privacy"><p>You see where to collect and deliver, and how many items. You never see which medicines are inside.</p></Alert>
      {jobs.length === 0 ? <EmptyState icon={Bike} title="No assignments right now" /> : jobs.map((j) => (
        <Card key={j.order_id} className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-navy">Order {j.order_number} · {j.item_count} item{j.item_count === 1 ? "" : "s"}</p>
            <Badge tone={ORDER_STATUS[j.status].tone}>{ORDER_STATUS[j.status].label}</Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-sm font-semibold text-muted">Collect from</p>
              <p>{j.pharmacy_name}</p><p className="text-sm">{j.pharmacy_address}</p>
              {j.pharmacy_phone ? <a href={`tel:${j.pharmacy_phone.replace(/\s/g, "")}`} className="text-sm text-primary underline">{j.pharmacy_phone}</a> : null}
              <a href={mapLink(j.pharmacy_lat, j.pharmacy_lng)} target="_blank" rel="noreferrer" className="block text-sm text-primary underline">Open map</a>
            </div>
            <div>
              <p className="text-sm font-semibold text-muted">Deliver to {j.recipient_name}</p>
              <p className="text-sm">{[j.delivery_address.line1, j.delivery_address.area, j.delivery_address.building_details, j.delivery_address.landmark && `near ${j.delivery_address.landmark}`].filter(Boolean).join(", ")}</p>
              {j.recipient_phone ? <a href={`tel:${j.recipient_phone}`} className="text-sm text-primary underline">Call recipient</a> : null}
              <a href={mapLink(j.delivery_lat, j.delivery_lng)} target="_blank" rel="noreferrer" className="block text-sm text-primary underline">Open map</a>
            </div>
          </div>
          {j.handover_locked ? <Alert tone="urgent" title="Handover locked after too many wrong codes"><p>Contact MedTRANS operations.</p></Alert> : null}
          <AssignmentActions orderId={j.order_id} status={j.status} locked={j.handover_locked} />
        </Card>
      ))}
    </AreaShell>
  );
}
