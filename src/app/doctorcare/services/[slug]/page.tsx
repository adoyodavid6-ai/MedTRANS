import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";
import { createAnonClient } from "@/lib/supabase/server";

type S = { id: string; slug: string; name: string; summary: string; description: string | null; required_profession: string; duration_minutes: number; eligibility_notes: string | null; escalation_notes: string | null };

async function load(slug: string) {
  const db = createAnonClient();
  const { data } = await db.from("care_services").select("id, slug, name, summary, description, required_profession, duration_minutes, eligibility_notes, escalation_notes").eq("slug", slug).eq("is_active", true).maybeSingle();
  if (!data) return null;
  const { data: dir } = await db.rpc("provider_directory");
  const fees = ((dir ?? []) as { accepts_bookings: boolean; services: { slug: string; fee_minor: number }[] }[])
    .filter((p) => p.accepts_bookings).flatMap((p) => p.services.filter((s) => s.slug === slug).map((s) => s.fee_minor));
  return { s: data as S, fees };
}

// Strip checklist tokens from public text; they are visible to the team in the ops console.
const clean = (t: string | null) => t?.replace(/\s*\[\[[^\]]+\]\]/g, "").trim() || null;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const r = await load((await params).slug);
  return r ? { title: r.s.name, description: r.s.summary, alternates: { canonical: `/doctorcare/services/${r.s.slug}` } } : { title: "Service not found" };
}

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const r = await load((await params).slug);
  if (!r) notFound();
  const { s, fees } = r;
  return (
    <>
      <PageHeader eyebrow="DoctorCare" title={s.name} intro={s.summary}>
        <div className="mt-6"><ButtonLink href={`/doctorcare/book?service=${s.slug}`} size="lg">Request this visit</ButtonLink></div>
      </PageHeader>
      <div className="container-page max-w-3xl space-y-6 py-10">
        {s.description ? <p className="text-[0.95rem]">{s.description}</p> : null}
        <Card>
          <dl className="grid gap-2 text-[0.95rem] sm:grid-cols-[12rem_1fr]">
            <dt className="text-muted">Who provides it</dt><dd>A verified, registered {s.required_profession}</dd>
            <dt className="text-muted">Typical length</dt><dd>About {s.duration_minutes} minutes</dd>
            <dt className="text-muted">Visit fees</dt>
            <dd>{fees.length ? `${formatMoney(Math.min(...fees))}${fees.length > 1 ? ` to ${formatMoney(Math.max(...fees))}` : ""}, set by each professional, plus a booking fee. You see the exact total before you confirm.` : "No professional is currently offering this service."}</dd>
          </dl>
        </Card>
        {clean(s.eligibility_notes) ? <Alert tone="info" title="Is this right for me?"><p>{clean(s.eligibility_notes)}</p></Alert> : null}
        {clean(s.escalation_notes) ? <Alert tone="warning" title="If it turns out to be serious"><p>{clean(s.escalation_notes)}</p></Alert> : null}
        <Alert tone="urgent" title="Not for emergencies"><p>If someone&apos;s life may be at risk, contact local emergency services now. <a href="/emergency" className="font-semibold underline">Emergency Help</a></p></Alert>
      </div>
    </>
  );
}
