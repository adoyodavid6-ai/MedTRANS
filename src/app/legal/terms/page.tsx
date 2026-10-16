import type { Metadata } from "next";
import { LegalDraftNotice } from "@/components/legal-draft-notice";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Terms of service", alternates: { canonical: "/legal/terms" } };

export default function TermsPage() {
  return (
    <>
      <PageHeader eyebrow="Legal" title="Terms of service" />
      <div className="container-page prose-page max-w-3xl py-10">
        <LegalDraftNotice token="[[CONFIRM: legal-reviewed Terms of Service]]" />
        <h2>In plain terms</h2>
        <ul>
          <li>MedTRANS connects you with licensed pharmacies and registered healthcare professionals. They are responsible for the care and medicines they provide.</li>
          <li>MedTRANS is not an emergency service.</li>
          <li>Prices and fees are confirmed before you pay; you are not charged anything you weren&apos;t shown.</li>
          <li>You must give accurate information, and only arrange care for others when you are authorised to.</li>
        </ul>
      </div>
    </>
  );
}
