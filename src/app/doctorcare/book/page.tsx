import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import { Alert } from "@/components/ui/alert";
import { requireAccount } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { BookingWizard } from "./wizard";

export const metadata: Metadata = { title: "Request a home visit", robots: { index: false, follow: false } };

function nextDays(n: number) {
  const fmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Nairobi" });
  const iso = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi" });
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.now() + i * 864e5);
    return { value: iso.format(d), label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : fmt.format(d) };
  });
}

export default async function BookPage({ searchParams }: { searchParams: Promise<{ service?: string }> }) {
  await requireAccount("/doctorcare/book");
  const supabase = await createClient();
  const [{ data: services }, { data: addrs }, { data: household }, { data: questions }, { data: fee }] = await Promise.all([
    supabase.from("care_services").select("id, slug, name, summary, duration_minutes").eq("is_active", true).order("name"),
    supabase.from("addresses").select("id, label, line1, area, location").order("is_default", { ascending: false }),
    supabase.from("household_members").select("id, full_name"),
    supabase.from("care_screening_questions").select("id, question, clinically_reviewed_at").eq("is_active", true).order("position"),
    supabase.from("platform_settings").select("value").eq("key", "doctorcare.booking_fee_minor").maybeSingle(),
  ]);
  const qs = questions ?? [];
  const reviewed = qs.length > 0 && qs.every((q) => q.clinically_reviewed_at);

  return (
    <div className="container-page max-w-3xl space-y-6 py-10">
      <h1 className="text-3xl font-bold">Request a home visit</h1>
      <Alert tone="urgent" title="Not for emergencies"><p>If someone&apos;s life may be at risk, contact local emergency services now. <a href="/emergency" className="font-semibold underline">Emergency Help</a></p></Alert>
      {(services ?? []).length === 0 || !reviewed ? (
        <Alert tone="info" title="Home visits are not available yet">
          <p>{(services ?? []).length === 0 ? "No home-visit service is switched on yet." : "Our safety questions are awaiting clinical review, so we can't take requests yet."}</p>
        </Alert>
      ) : (
        <BookingWizard
          services={services ?? []}
          addresses={(addrs ?? []).filter((a) => a.location).map((a) => ({ id: a.id, label: a.label, line1: a.line1, area: a.area }))}
          household={household ?? []}
          questions={qs.map((q) => ({ id: q.id, question: q.question }))}
          bookingFeeMinor={typeof fee?.value === "number" ? fee.value : null}
          initialService={(await searchParams).service ?? null}
          days={nextDays(7)}
          idempotencyKey={randomUUID()}
          escalationKey={randomUUID()}
        />
      )}
    </div>
  );
}
