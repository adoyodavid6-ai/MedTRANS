import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Alert } from "@/components/ui/alert";

export const metadata: Metadata = {
  title: "Help Centre",
  description: "Answers to common questions about MedTRANS.",
  alternates: { canonical: "/help" },
};

const topics = [
  {
    heading: "Your account",
    items: [
      { q: "How do I sign in?", a: "Use your mobile number or email address. We send you a one-time code — there is no password to remember." },
      { q: "Can I manage care for someone else?", a: "Yes. In your account you can add household members you are authorised to arrange care for, such as a child or an older parent." },
      { q: "How do I delete my account or get a copy of my data?", a: "Data requests will be handled through your account's privacy settings and our support team. The full workflow opens with our support system." },
    ],
  },
  {
    heading: "Medicines and prescriptions",
    items: [
      { q: "Do I need a prescription?", a: "Only for prescription-only medicines. They are always clearly labelled, and a licensed pharmacist must approve your prescription before anything is dispensed." },
      { q: "Can MedTRANS give me medical advice?", a: "No. MedTRANS connects you with licensed pharmacists and registered clinicians. Please ask them about your treatment." },
    ],
  },
  {
    heading: "Home visits",
    items: [
      { q: "Is DoctorCare for emergencies?", a: "No. DoctorCare is for eligible, non-emergency home visits. If your request suggests an emergency, we will direct you to emergency help." },
    ],
  },
];

export default function HelpPage() {
  return (
    <>
      <PageHeader title="Help Centre" intro="Answers to common questions. More topics will be added as each service opens." />
      <div className="container-page max-w-3xl space-y-8 py-10">
        <Alert tone="urgent" title="This page is not for emergencies">
          <p>
            If someone&apos;s life may be at risk, contact local emergency services now. <Link href="/emergency" className="font-semibold underline">Emergency Help</Link>
          </p>
        </Alert>
        {topics.map((t) => (
          <section key={t.heading} aria-labelledby={`h-${t.heading}`}>
            <h2 id={`h-${t.heading}`} className="text-xl font-semibold">
              {t.heading}
            </h2>
            <div className="mt-3 divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface">
              {t.items.map((i) => (
                <details key={i.q} className="p-5">
                  <summary className="cursor-pointer font-semibold text-navy">{i.q}</summary>
                  <p className="mt-2 text-[0.95rem] text-muted">{i.a}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
        <p>
          Still need help? <Link href="/contact" className="font-semibold text-primary underline">Contact us</Link>.
        </p>
      </div>
    </>
  );
}
