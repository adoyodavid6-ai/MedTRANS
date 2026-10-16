import type { Metadata } from "next";
import { LegalDraftNotice } from "@/components/legal-draft-notice";
import { PageHeader } from "@/components/page-header";
import { Pending } from "@/components/pending";
import { site } from "@/lib/site/config";

export const metadata: Metadata = { title: "Privacy notice", alternates: { canonical: "/legal/privacy" } };

export default function PrivacyPage() {
  return (
    <>
      <PageHeader eyebrow="Legal" title="Privacy notice" />
      <div className="container-page prose-page max-w-3xl py-10">
        <LegalDraftNotice token="[[CONFIRM: legal-reviewed Privacy Notice — Kenya Data Protection Act, 2019]]" />
        <h2>Our commitments</h2>
        <ul>
          <li>We collect only what each service needs, and ask for consent for each specific purpose.</li>
          <li>Health information (prescriptions, visit records) is visible only to you and the professionals directly involved in your care.</li>
          <li>Delivery partners never see prescriptions or clinical records.</li>
          <li>Administrators may access sensitive records only for legitimate, authorised purposes, and every access is logged.</li>
          <li>Your location is used only when you choose to share it, for the service you are using.</li>
          <li>We never send identifiable medical information to advertising or analytics platforms.</li>
          <li>You can withdraw consent, and ask for a copy of your data or its deletion, subject to legal retention duties.</li>
        </ul>
        <h2>Data Protection Officer</h2>
        <p>
          <Pending item={site.dataProtectionOfficer} fallback="Contact details are being confirmed." />
        </p>
      </div>
    </>
  );
}
