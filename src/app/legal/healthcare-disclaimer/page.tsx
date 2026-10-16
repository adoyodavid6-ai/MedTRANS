import type { Metadata } from "next";
import Link from "next/link";
import { LegalDraftNotice } from "@/components/legal-draft-notice";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Healthcare disclaimer", alternates: { canonical: "/legal/healthcare-disclaimer" } };

export default function DisclaimerPage() {
  return (
    <>
      <PageHeader eyebrow="Legal" title="Healthcare disclaimer" />
      <div className="container-page prose-page max-w-3xl py-10">
        <LegalDraftNotice token="[[CONFIRM: clinically and legally reviewed healthcare disclaimer]]" />
        <ul>
          <li>MedTRANS is not an emergency service. In an emergency, contact local emergency services — see <Link href="/emergency">Emergency Help</Link>.</li>
          <li>Information on MedTRANS does not replace advice from a qualified healthcare professional.</li>
          <li>MedTRANS does not diagnose conditions, and no automated feature on MedTRANS makes clinical decisions.</li>
          <li>Prescription medicines are dispensed only after review by a licensed pharmacist.</li>
        </ul>
      </div>
    </>
  );
}
