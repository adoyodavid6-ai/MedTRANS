import { CalendarCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAccount } from "@/lib/auth/session";
import { BOOKING_STATUS, fmtSlot, NEED_DURATION } from "@/lib/doctorcare/status";
import { createClient } from "@/lib/supabase/server";
import { VisitActions, VisitRecordForm } from "../forms";

type V = { booking_id: string; booking_number: string; status: string; service_name: string; slot_start: string; patient_name: string; patient_phone: string | null; address: { line1: string; area: string | null; building_details: string | null; landmark: string | null } | null; lat: number | null; lng: number | null; need_description: string | null; need_duration: string | null; has_record: boolean };

export default async function Visits() {
  await requireAccount("/portal/care/visits", ["doctor", "nurse"]);
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_visits");
  const rows = (data ?? []) as V[];
  return (
    <section aria-labelledby="visits-heading" className="space-y-3">
      <h2 id="visits-heading" className="text-xl font-semibold">Your visits</h2>
      {rows.length === 0 ? <EmptyState icon={CalendarCheck} title="No visits yet" /> : rows.map((v) => (
        <Card key={v.booking_id} className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-navy">{v.service_name} · {fmtSlot(v.slot_start)} · {v.patient_name}</p>
            <Badge tone={BOOKING_STATUS[v.status].tone}>{BOOKING_STATUS[v.status].label}</Badge>
          </div>
          {v.address ? (
            <p className="text-sm">{[v.address.line1, v.address.area, v.address.building_details, v.address.landmark && `near ${v.address.landmark}`].filter(Boolean).join(", ")}
              {v.lat !== null && v.lng !== null ? <> · <a href={`https://www.openstreetmap.org/?mlat=${v.lat}&mlon=${v.lng}#map=17/${v.lat}/${v.lng}`} target="_blank" rel="noreferrer" className="text-primary underline">map</a></> : null}
              {v.patient_phone ? <> · <a href={`tel:${v.patient_phone}`} className="text-primary underline">call patient</a></> : null}</p>
          ) : <p className="text-sm text-muted">The address appears once the patient has paid to confirm.</p>}
          {v.need_description ? <p className="rounded-lg bg-background p-3 text-[0.95rem]">{v.need_description}{v.need_duration ? ` (${NEED_DURATION[v.need_duration]})` : ""}</p> : null}
          <VisitActions bookingId={v.booking_id} status={v.status} />
          {v.status === "in_progress" && !v.has_record ? <details open className="rounded-xl border border-line p-4"><summary className="cursor-pointer font-semibold">Document and complete the visit</summary><div className="mt-3"><VisitRecordForm bookingId={v.booking_id} /></div></details> : null}
        </Card>
      ))}
    </section>
  );
}
