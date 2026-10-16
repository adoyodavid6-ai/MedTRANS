import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Pending } from "@/components/pending";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { site } from "@/lib/site/config";

export const metadata: Metadata = {
  title: "Contact us",
  description: "How to reach the MedTRANS team.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <>
      <PageHeader title="Contact us" />
      <div className="container-page max-w-3xl space-y-6 py-10">
        <Alert tone="urgent" title="Not for emergencies">
          <p>
            Messages to MedTRANS are not monitored around the clock. In an emergency, contact local emergency services now —{" "}
            <Link href="/emergency" className="font-semibold underline">Emergency Help</Link>.
          </p>
        </Alert>
        <Card>
          <dl className="grid gap-4 sm:grid-cols-[10rem_1fr]">
            <dt className="font-semibold text-navy">Email</dt>
            <dd><Pending item={site.support.email} fallback="Being confirmed" render={(v) => <a className="text-primary underline" href={`mailto:${v}`}>{v}</a>} /></dd>
            <dt className="font-semibold text-navy">Phone</dt>
            <dd><Pending item={site.support.phone} fallback="Being confirmed" /></dd>
            <dt className="font-semibold text-navy">Hours</dt>
            <dd><Pending item={site.support.hours} fallback="Being confirmed" /></dd>
            <dt className="font-semibold text-navy">Business address</dt>
            <dd><Pending item={site.business.address} fallback="Being confirmed" /></dd>
          </dl>
        </Card>
        <p className="text-[0.95rem] text-muted">
          A secure inquiry form with ticket tracking opens with our support system. We won&apos;t ask you to send health
          information by email.
        </p>
      </div>
    </>
  );
}
