import type { Metadata } from "next";
import { LegalDraftNotice } from "@/components/legal-draft-notice";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Cancellation and refunds", alternates: { canonical: "/legal/cancellation-and-refunds" } };

export default function RefundsPage() {
  return (
    <>
      <PageHeader eyebrow="Legal" title="Cancellation and refunds" />
      <div className="container-page prose-page max-w-3xl py-10">
        <LegalDraftNotice token="[[CONFIRM: cancellation windows, refund policy and settlement terms]]" />
        <p>
          Cancellation windows and refund amounts for orders and home visits will be shown to you before you confirm, and the
          status of any refund will be visible in your account. Final terms will be published here once confirmed.
        </p>
      </div>
    </>
  );
}
