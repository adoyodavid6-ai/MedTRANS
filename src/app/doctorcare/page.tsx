import type { Metadata } from "next";
import Link from "next/link";
import { House, MapPinned, Siren, Stethoscope } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createAnonClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "DoctorCare",
  description: "Request qualified healthcare professionals for eligible home visits, follow-up care, and non-emergency medical needs.",
  alternates: { canonical: "/doctorcare" },
};
export const revalidate = 300;

export default async function DoctorCarePage() {
  let services: { slug: string; name: string; summary: string; duration_minutes: number }[] = [];
  try {
    const { data } = await createAnonClient().from("care_services").select("slug, name, summary, duration_minutes").eq("is_active", true).order("name");
    services = data ?? [];
  } catch {}
  return (
    <>
      <PageHeader eyebrow="DoctorCare" title="Professional care. In the comfort of home."
        intro="Request qualified healthcare professionals for eligible home visits, follow-up care, and non-emergency medical needs.">
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href="/doctorcare/book" size="lg"><House aria-hidden className="size-5" />Request a Home Visit</ButtonLink>
          <ButtonLink href="/smartcare/map" size="lg" variant="navy"><MapPinned aria-hidden className="size-5" />Find a Doctor Near Me</ButtonLink>
          <ButtonLink href="/emergency" size="lg" variant="urgent"><Siren aria-hidden className="size-5" />Get Urgent Medical Help</ButtonLink>
        </div>
      </PageHeader>
      <div className="container-page space-y-8 py-10">
        <Alert tone="info" title="Availability depends on where and when">
          <p>Visits are only offered where DoctorCare is switched on, by professionals who are verified, qualified for the service, and genuinely free at the time you choose. If nobody suitable is available, we&apos;ll tell you plainly. You are never charged unless a professional accepts.</p>
        </Alert>
        <section aria-labelledby="services-heading">
          <h2 id="services-heading" className="text-2xl font-medium">Services</h2>
          {services.length === 0 ? <p className="mt-2 text-muted">No home-visit services are switched on yet.</p> : (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {services.map((s) => (
                <Card key={s.slug}>
                  <Stethoscope aria-hidden className="size-7 text-primary" />
                  <h3 className="mt-3 text-lg font-semibold"><Link href={`/doctorcare/services/${s.slug}`} className="underline-offset-2 hover:underline">{s.name}</Link></h3>
                  <p className="mt-1.5 text-[0.95rem] text-muted">{s.summary}</p>
                  <p className="mt-2 text-sm text-muted">About {s.duration_minutes} minutes</p>
                </Card>
              ))}
            </div>
          )}
        </section>
        <section aria-labelledby="how-heading">
          <h2 id="how-heading" className="text-2xl font-medium">How it works</h2>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-[0.95rem]">
            <li>Choose the service and who it&apos;s for, and confirm where you are.</li>
            <li>Answer a few safety questions. If anything suggests an emergency, we&apos;ll direct you to emergency help instead.</li>
            <li>Pick a time and a verified professional. You see their credentials, fee and approximate distance.</li>
            <li>They accept, you pay to confirm, and you can follow the visit as it happens.</li>
            <li>Afterwards you receive a visit summary from the professional.</li>
          </ol>
        </section>
      </div>
    </>
  );
}
