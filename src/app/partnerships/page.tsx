import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { PartnerApplicationForm } from "@/components/partners/application-form";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Partnerships",
  description: "Work with MedTRANS as an employer, insurer, clinic or institution.",
  alternates: { canonical: "/partnerships" },
};

const AUDIENCE: Record<string, string> = { pharmacy: "For pharmacies", provider: "For doctors and nurses", organisation: "For organisations" };

export default async function Partnerships() {
  const supabase = await createClient();
  const { data: plans } = await supabase.from("subscription_plans").select("id, audience, name, summary, features, price_minor, billing_period").eq("is_active", true).order("audience");
  return (
    <>
      <PageHeader eyebrow="Partners" title="Work with MedTRANS" intro="We work with employers, insurers, clinics and institutions that want reliable access to medicines and home care for the people they serve." />
      <div className="container-page max-w-4xl space-y-6 py-10">
        {(plans ?? []).length > 0 ? (
          <section aria-labelledby="plans-h" className="space-y-3">
            <h2 id="plans-h" className="text-xl font-semibold">Plans</h2>
            <ul className="grid gap-4 sm:grid-cols-2">
              {(plans ?? []).map((p) => (
                <li key={p.id}>
                  <Card className="h-full space-y-2">
                    <p className="text-sm font-semibold text-primary">{AUDIENCE[p.audience]}</p>
                    <h3 className="text-lg font-semibold">{p.name}</h3>
                    <p className="text-[0.95rem]">{p.summary}</p>
                    {p.price_minor !== null ? <p className="font-semibold text-navy">{formatMoney(p.price_minor, "KES")} per {p.billing_period}</p> : null}
                    {(p.features ?? []).length > 0 ? <ul className="list-disc pl-5 text-sm">{(p.features as string[]).map((f) => <li key={f}>{f}</li>)}</ul> : null}
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <Card><p className="text-[0.95rem]">Partnership terms are agreed individually during the pilot. Tell us what you need and our team will be in touch.</p></Card>
        )}
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Tell us about your organisation</h2>
          <PartnerApplicationForm kind="organisation" />
        </Card>
        <p className="text-sm text-muted">Pharmacies: please use <Link href="/join/pharmacy" className="underline">Register your pharmacy</Link>. Doctors and nurses: <Link href="/join/provider" className="underline">Join as a provider</Link>.</p>
      </div>
    </>
  );
}
