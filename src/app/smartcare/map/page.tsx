import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { NearList } from "./near-list";

export const metadata: Metadata = {
  title: "SmartCare: care near you",
  description: "Verified professionals who cover your location, as an accessible list.",
  alternates: { canonical: "/smartcare/map" },
};

export default function SmartCarePage() {
  return (
    <>
      <PageHeader eyebrow="SmartCare" title="Care near you" intro="Verified professionals whose service area covers where you are, nearest first." />
      <div className="container-page max-w-3xl space-y-6 py-10">
        <Card><NearList /></Card>
        <Alert tone="info" title="Map view not activated yet">
          <p>An interactive map needs a mapping provider, which isn&apos;t connected yet. This list shows the same information and works with screen readers. Exact locations of professionals are never shown.</p>
        </Alert>
      </div>
    </>
  );
}
