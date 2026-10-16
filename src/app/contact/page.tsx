import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Pending } from "@/components/pending";
import { InquiryForm } from "@/components/support/inquiry-form";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth/session";
import { site } from "@/lib/site/config";

export const metadata: Metadata = {
  title: "Contact us",
  description: "Send MedTRANS a message. Not for emergencies.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage() {
  const user = await getSessionUser();
  return (
    <>
      <PageHeader title="Contact us" intro="Questions about an order, a visit, a payment or your account. We reply by your chosen method." />
      <div className="container-page grid max-w-5xl gap-6 py-10 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Alert tone="urgent" title="This form is not for emergencies">
            <p>Messages are not monitored around the clock. If someone&apos;s life may be at risk, contact local emergency services now. <Link href="/emergency" className="font-semibold underline">Emergency Help</Link></p>
          </Alert>
          <Card><InquiryForm signedIn={Boolean(user)} /></Card>
        </div>
        <Card className="h-fit">
          <h2 className="text-lg font-semibold">Other ways to reach us</h2>
          <dl className="mt-3 space-y-3 text-[0.95rem]">
            <div><dt className="font-semibold text-navy">Email</dt><dd><Pending item={site.support.email} fallback="Being confirmed" render={(v) => <a className="text-primary underline" href={`mailto:${v}`}>{v}</a>} /></dd></div>
            <div><dt className="font-semibold text-navy">Phone</dt><dd><Pending item={site.support.phone} fallback="Being confirmed" /></dd></div>
            <div><dt className="font-semibold text-navy">Hours</dt><dd><Pending item={site.support.hours} fallback="Being confirmed" /></dd></div>
            <div><dt className="font-semibold text-navy">Business address</dt><dd><Pending item={site.business.address} fallback="Being confirmed" /></dd></div>
          </dl>
        </Card>
      </div>
    </>
  );
}
