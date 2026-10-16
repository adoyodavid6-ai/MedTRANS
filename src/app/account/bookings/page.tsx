import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAccount } from "@/lib/auth/session";
import { BOOKING_STATUS, fmtSlot } from "@/lib/doctorcare/status";
import { createClient } from "@/lib/supabase/server";

export default async function BookingsPage() {
  await requireAccount("/account/bookings");
  const supabase = await createClient();
  const { data } = await supabase.from("care_bookings").select("id, booking_number, status, slot, patient_name, care_services(name)").order("created_at", { ascending: false }).limit(50);
  const rows = (data ?? []) as unknown as { id: string; booking_number: string; status: string; slot: string; patient_name: string; care_services: { name: string } }[];
  return (
    <section aria-labelledby="bookings-heading" className="space-y-3">
      <h2 id="bookings-heading" className="text-xl font-semibold">Home visits</h2>
      {rows.length === 0 ? <EmptyState icon={CalendarClock} title="No home visits yet" action={<ButtonLink href="/doctorcare/book">Request a home visit</ButtonLink>} /> : (
        <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface">
          {rows.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <Link href={`/bookings/${b.id}`} className="font-semibold text-navy underline-offset-2 hover:underline">{b.care_services.name}</Link>
                <p className="text-sm text-muted">{b.booking_number} · for {b.patient_name}{b.status !== "escalated" ? ` · ${fmtSlot(b.slot.replace(/^[[(]"?/, "").split(",")[0].replace(/"/g, ""))}` : ""}</p>
              </div>
              <Badge tone={BOOKING_STATUS[b.status]?.tone}>{BOOKING_STATUS[b.status]?.label}</Badge>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
