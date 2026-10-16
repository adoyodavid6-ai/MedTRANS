import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "How it works",
  description: "How MedTRANS pharmacy orders, home visits and emergency guidance work.",
  alternates: { canonical: "/how-it-works" },
};

export default function HowItWorksPage() {
  return (
    <>
      <PageHeader title="How MedTRANS works" intro="One account, one location, and an honest status at every step." />
      <div className="container-page prose-page max-w-3xl py-10">
        <h2>Ordering medicines</h2>
        <ol>
          <li>Search by medicine name, generic name or brand. Prescription-only medicines are always labelled separately from over-the-counter ones.</li>
          <li>Choose a verified, licensed pharmacy that can deliver to you and has the item in stock.</li>
          <li>If the medicine needs a prescription, upload it securely. Only the reviewing pharmacy can open it.</li>
          <li>A licensed pharmacist reviews it and approves it, asks a question, or explains why it can&apos;t be dispensed.</li>
          <li>Before you pay, we re-check stock and prices on our servers and show the full total, including delivery and fees.</li>
          <li>Track your order. Each status reflects something that actually happened, with the time it happened.</li>
        </ol>

        <h2>Requesting a home visit (DoctorCare)</h2>
        <ol>
          <li>Tell us where you are and choose the service you need.</li>
          <li>Say who the visit is for — you, or someone you are authorised to arrange care for.</li>
          <li>Answer a few short safety questions. If your answers suggest an emergency, we&apos;ll direct you to emergency help instead of a routine booking.</li>
          <li>We show professionals who are verified, qualified for the service, cover your area and are genuinely available.</li>
          <li>Review their credentials, fees and cancellation terms, then confirm.</li>
          <li>Follow the visit from request to completion, and receive a visit summary afterwards where appropriate.</li>
        </ol>

        <h2>In an emergency</h2>
        <p>
          <Link href="/emergency">Emergency Help</Link> is always one tap away and needs no sign-in. It tells you what to do right
          now and shows only verified local emergency numbers. MedTRANS is not an emergency dispatch service and will never
          tell you help is on the way unless it genuinely is.
        </p>

        <h2>What we will never do</h2>
        <ul>
          <li>Show a pharmacy or professional as verified unless a completed check is on record.</li>
          <li>Show reviews, ratings, prices, stock or arrival times that aren&apos;t real.</li>
          <li>Show a delivery or visit as moving when nothing is moving.</li>
          <li>Let a sponsored listing outrank safety or suitability.</li>
        </ul>
      </div>
    </>
  );
}
