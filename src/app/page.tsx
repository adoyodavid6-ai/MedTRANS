import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  ClipboardCheck,
  CreditCard,
  FileLock2,
  HeartPulse,
  House,
  MapPinned,
  Pill,
  ReceiptText,
  ShieldCheck,
  Siren,
  Stethoscope,
} from "lucide-react";
import { LocationSelector } from "@/components/layout/location-selector";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { site } from "@/lib/site/config";

const services = [
  {
    icon: Pill,
    title: "Medicine delivered to your door",
    body: "Order from verified, licensed pharmacies. Prescription medicines are checked by a pharmacist before they're dispensed.",
    href: "/pharmacy",
    cta: "About MedTRANS Pharmacy",
  },
  {
    icon: Stethoscope,
    title: "Qualified professionals at home",
    body: "Request a verified doctor or nurse for eligible, non-emergency home visits and follow-up care.",
    href: "/doctorcare",
    cta: "About DoctorCare",
  },
  {
    icon: MapPinned,
    title: "Find the right care near you",
    body: "We match you with the nearest suitable provider who is qualified, genuinely available and covers your area.",
    href: "/coverage",
    cta: "Check your area",
  },
] as const;

const trust = [
  { icon: BadgeCheck, title: "Checked credentials", body: "Professional registration and pharmacy licences are checked before anyone is shown as verified. Pending checks are labelled as pending." },
  { icon: ReceiptText, title: "Transparent pricing", body: "Item prices, delivery and service fees are shown before you confirm. Totals are calculated on our servers, not guessed." },
  { icon: CreditCard, title: "Secure payments", body: "Payments go through regulated payment providers. MedTRANS never stores your card details." },
  { icon: FileLock2, title: "Private by design", body: "Health information is only visible to you and the professionals treating you. Every access to sensitive records is logged." },
] as const;

const flows = [
  {
    icon: Pill,
    title: "Pharmacy",
    steps: [
      "Search for your medicine",
      "Choose an eligible verified pharmacy",
      "Upload a prescription if one is required",
      "A licensed pharmacist reviews it",
      "Pay securely",
      "Track your delivery",
    ],
  },
  {
    icon: House,
    title: "DoctorCare",
    steps: [
      "Share your location",
      "Choose the service you need",
      "Answer a few safety questions",
      "Review suitable, available professionals",
      "Confirm and track the visit",
      "Receive your visit summary",
    ],
  },
  {
    icon: Siren,
    title: "Emergency",
    steps: [
      "Open Emergency Help — no sign-in needed",
      "See what to do right away",
      "Contact local emergency services",
      "Share your location with them if you choose",
      "Get clear, honest status — never a false “help is on the way”",
    ],
  },
] as const;

const faqs = [
  {
    q: "Is MedTRANS available now?",
    a: `We are preparing a pilot in ${site.pilot.city}. Services switch on area by area, only once pharmacies and professionals there have been verified. Use the coverage checker to see what's active where you are.`,
  },
  {
    q: "Can MedTRANS send an ambulance?",
    a: "No. MedTRANS is not an emergency dispatch service. If someone's life may be at risk, contact local emergency services immediately. Our Emergency Help page shows what to do and which verified numbers to call.",
  },
  {
    q: "How do you know a pharmacy or professional is genuine?",
    a: "Before anyone is shown as verified, we check their licence or professional registration with the relevant regulator and record who checked it and when. If a check is incomplete, we say so.",
  },
  {
    q: "Will a pharmacy accept any uploaded prescription?",
    a: "No. An uploaded prescription is never automatically valid. A licensed pharmacist reviews it, and may approve it, ask for clarification, or decline it, before anything is dispensed.",
  },
  {
    q: "Who can see my health information?",
    a: "You, and the professionals directly involved in your care. Delivery partners never see your prescriptions or clinical records. See our privacy notice for details.",
  },
] as const;

export default function HomePage() {
  return (
    <>
      {/* Hero: the three core actions, above the fold on a phone (§6). */}
      <section className="border-b border-line bg-gradient-to-b from-surface to-background">
        <div className="container-page grid gap-10 py-8 sm:py-14 lg:grid-cols-[1.15fr_1fr] lg:items-center">
          <div>
            <h1 className="text-[2rem] font-bold sm:text-5xl">Healthcare that comes to you.</h1>
            <p className="mt-3 max-w-xl text-base text-muted sm:mt-4 sm:text-lg">
              Order your medicines, find trusted healthcare professionals, and request home-based care through one convenient
              platform.
            </p>

            <div className="mt-5 grid gap-2.5 sm:mt-7 sm:flex sm:flex-wrap sm:gap-3">
              <ButtonLink href="/pharmacy" size="lg">
                <Pill aria-hidden className="size-5" />
                Order Medicines
              </ButtonLink>
              <ButtonLink href="/doctorcare" size="lg" variant="navy">
                <Stethoscope aria-hidden className="size-5" />
                Request Home Care
              </ButtonLink>
              <ButtonLink href="/emergency" size="lg" variant="urgent">
                <Siren aria-hidden className="size-5" />
                Get Urgent Medical Help
              </ButtonLink>
            </div>

            <div className="mt-5 max-w-xl sm:mt-7">
              <p className="mb-1.5 text-sm font-semibold text-navy">
                Enter your location or allow location access.
              </p>
              <LocationSelector className="w-full max-w-none justify-start px-4 py-3 text-base" />
            </div>
          </div>

          <Card className="hidden lg:block">
            <p className="text-sm font-semibold tracking-wide text-primary uppercase">Our promise</p>
            <p className="mt-2 text-2xl font-semibold text-navy">{site.promise}</p>
            <ul className="mt-5 space-y-3 text-[0.95rem]">
              {[
                "Only verified pharmacies and professionals can accept your request.",
                "Every price is confirmed before you pay.",
                "Every status you see reflects something that actually happened.",
                "Emergency guidance is always one tap away, with no sign-in.",
              ].map((t) => (
                <li key={t} className="flex gap-2.5">
                  <ShieldCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </section>

      {/* Services */}
      <section aria-labelledby="services-heading" className="container-page py-12 sm:py-16">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="services-heading" className="text-2xl font-bold sm:text-3xl">
            One account for your care
          </h2>
          <Badge tone="warning">Pilot in preparation · {site.pilot.city}</Badge>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {services.map(({ icon: Icon, title, body, href, cta }) => (
            <Card key={title} className="flex flex-col">
              <span className="inline-flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <Icon aria-hidden className="size-6" />
              </span>
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <p className="mt-2 flex-1 text-[0.95rem] text-muted">{body}</p>
              <Link href={href} className="mt-4 inline-flex min-h-11 items-center gap-1.5 font-semibold text-primary hover:text-primary-hover">
                {cta}
                <ArrowRight aria-hidden className="size-4" />
              </Link>
            </Card>
          ))}
        </div>
      </section>

      {/* Trust & verification (§6D). Explains the process; shows no counts, logos or ratings we can't back. */}
      <section aria-labelledby="trust-heading" className="border-y border-line bg-surface">
        <div className="container-page py-12 sm:py-16">
          <h2 id="trust-heading" className="text-2xl font-bold sm:text-3xl">
            Trust you can check
          </h2>
          <p className="mt-2 max-w-2xl text-muted">
            When MedTRANS says a pharmacy or professional is verified, it means a completed check is on record. Anything else is
            labelled honestly as pending, suspended or not verified.
          </p>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {trust.map(({ icon: Icon, title, body }) => (
              <div key={title}>
                <Icon aria-hidden className="size-7 text-primary" />
                <h3 className="mt-3 font-semibold">{title}</h3>
                <p className="mt-1.5 text-[0.95rem] text-muted">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works (§6E) */}
      <section aria-labelledby="how-heading" className="container-page py-12 sm:py-16">
        <h2 id="how-heading" className="text-2xl font-bold sm:text-3xl">
          How it works
        </h2>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {flows.map(({ icon: Icon, title, steps }) => (
            <Card key={title}>
              <div className="flex items-center gap-2.5">
                <Icon aria-hidden className={title === "Emergency" ? "size-6 text-urgent" : "size-6 text-primary"} />
                <h3 className="text-lg font-semibold">{title}</h3>
              </div>
              <ol className="mt-4 space-y-2.5">
                {steps.map((s, i) => (
                  <li key={s} className="flex gap-3 text-[0.95rem]">
                    <span
                      aria-hidden
                      className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary-hover"
                    >
                      {i + 1}
                    </span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            </Card>
          ))}
        </div>
        <p className="mt-6">
          <Link href="/how-it-works" className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-primary">
            Read the full walkthrough
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </p>
      </section>

      {/* Prescription verification + matching explainers */}
      <section className="border-y border-line bg-surface">
        <div className="container-page grid gap-10 py-12 sm:py-16 lg:grid-cols-2">
          <div>
            <ClipboardCheck aria-hidden className="size-8 text-primary" />
            <h2 className="mt-3 text-2xl font-bold">How prescription checks work</h2>
            <ul className="mt-4 space-y-2 text-[0.95rem] text-muted">
              <li>You upload your prescription securely; only the reviewing pharmacy can open it.</li>
              <li>A licensed pharmacist checks it is valid, current and matches what you ordered.</li>
              <li>They approve it, ask you a question, or explain why it can&apos;t be dispensed.</li>
              <li>Nothing prescription-only is dispensed without that approval.</li>
            </ul>
          </div>
          <div>
            <HeartPulse aria-hidden className="size-8 text-primary" />
            <h2 className="mt-3 text-2xl font-bold">Nearest suitable, not just nearest</h2>
            <ul className="mt-4 space-y-2 text-[0.95rem] text-muted">
              <li>Only verified, active professionals qualified for your service are considered.</li>
              <li>They must genuinely be available and cover your area.</li>
              <li>Among those, we rank by travel time, distance and timing.</li>
              <li>If no one suitable is available, we tell you plainly and show your options.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Coverage + providers */}
      <section className="container-page grid gap-4 py-12 sm:py-16 md:grid-cols-2">
        <div className="rounded-[var(--radius-card)] bg-navy p-5 text-white shadow-[var(--shadow-card)] sm:p-6">
          <h2 className="text-xl font-semibold text-white">Do we cover your area?</h2>
          <p className="mt-2 text-[0.95rem] text-white/85">
            Services switch on area by area, only once verified pharmacies and professionals are in place.
          </p>
          <ButtonLink href="/coverage" variant="secondary" className="mt-5">
            Check coverage
          </ButtonLink>
        </div>
        <Card>
          <h2 className="text-xl font-semibold">Are you a pharmacy or healthcare professional?</h2>
          <p className="mt-2 text-[0.95rem] text-muted">
            Join a platform built around verification, transparent fees and safe clinical practice.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <ButtonLink href="/join/pharmacy" variant="secondary">
              Register a pharmacy
            </ButtonLink>
            <ButtonLink href="/join/provider" variant="secondary">
              Join as a doctor or nurse
            </ButtonLink>
          </div>
        </Card>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq-heading" className="container-page pb-4">
        <h2 id="faq-heading" className="text-2xl font-bold sm:text-3xl">
          Questions people ask
        </h2>
        <div className="mt-6 divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface">
          {faqs.map(({ q, a }) => (
            <details key={q} className="group p-5">
              <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-4 font-semibold text-navy">
                {q}
                <span aria-hidden className="text-xl text-primary transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-[0.95rem] text-muted">{a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
