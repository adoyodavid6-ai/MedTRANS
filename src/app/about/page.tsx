import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { site } from "@/lib/site/config";

export const metadata: Metadata = {
  title: "About MedTRANS",
  description: "Why MedTRANS exists and how we work.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <>
      <PageHeader eyebrow="About" title={site.promise} intro={site.tagline} />
      <div className="container-page prose-page max-w-3xl py-10">
        <p>
          For many people, getting the right medicine, getting a qualified clinician to come to them, or knowing what to do when
          something is urgent is far harder than it should be. MedTRANS brings those three needs together in one account.
        </p>
        <h2>How we work</h2>
        <ul>
          <li><strong>Verification first.</strong> Pharmacies and professionals are checked with their regulators before they can accept requests.</li>
          <li><strong>Clinical judgement stays with clinicians.</strong> Software helps people find care; it never diagnoses or authorises dispensing.</li>
          <li><strong>Honest status.</strong> What you see reflects what has actually happened.</li>
          <li><strong>Privacy by design.</strong> Health information is seen only by the people involved in your care.</li>
        </ul>
        <h2>Where we are</h2>
        <p>
          We are preparing a pilot in {site.pilot.city}, {site.pilot.country}. Services will open area by area, once the
          pharmacies, professionals and regulatory approvals behind them are in place.
        </p>
      </div>
    </>
  );
}
