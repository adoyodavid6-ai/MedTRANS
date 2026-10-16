import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { PartnerApplicationForm } from "@/components/partners/application-form";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Register your pharmacy",
  description: "List your licensed pharmacy on MedTRANS. Every pharmacy is checked with the Pharmacy and Poisons Board before it can sell.",
  alternates: { canonical: "/join/pharmacy" },
};

export default function JoinPharmacy() {
  return (
    <>
      <PageHeader eyebrow="Join MedTRANS" title="Register your pharmacy" intro="Reach patients who need medicines delivered, with prescriptions checked by your own pharmacists." />
      <div className="container-page max-w-3xl space-y-6 py-10">
        <Card>
          <h2 className="text-lg font-semibold">How registration works</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-[0.95rem]">
            <li>Send your details below.</li>
            <li>MedTRANS checks your premises licence and superintendent pharmacist with the Pharmacy and Poisons Board, and records how each was checked.</li>
            <li>We agree commercial terms with you in writing. Nothing is charged before that.</li>
            <li>Once verified, your team manages stock, prices, prescriptions and orders in the pharmacy portal.</li>
          </ol>
          <p className="mt-3 text-sm text-muted">Your pharmacy is not shown to patients, and cannot sell, until every check is complete.</p>
        </Card>
        <Card><PartnerApplicationForm kind="pharmacy" /></Card>
      </div>
    </>
  );
}
