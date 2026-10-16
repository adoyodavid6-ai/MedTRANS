import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { site } from "@/lib/site/config";
import { CoverageChecker } from "./coverage-checker";

export const metadata: Metadata = {
  title: "Check coverage",
  description: "See whether MedTRANS services are active where you are.",
  alternates: { canonical: "/coverage" },
};

export default function CoveragePage() {
  return (
    <>
      <PageHeader
        eyebrow="SmartCare"
        title="Check coverage"
        intro={`MedTRANS is preparing a pilot in ${site.pilot.city}. Services switch on area by area, and only once verified pharmacies and professionals are in place.`}
      />
      <div className="container-page max-w-3xl py-10">
        <Card>
          <h2 className="text-xl font-semibold">Is MedTRANS active where I am?</h2>
          <p className="mt-2 mb-5 text-[0.95rem] text-muted">
            We check your location against the service areas that are currently switched on. We never guess.
          </p>
          <CoverageChecker />
        </Card>
      </div>
    </>
  );
}
