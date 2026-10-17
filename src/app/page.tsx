import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  CornerDownRight,
  CreditCard,
  FileLock2,
  FileUp,
  MapPinned,
  PackageCheck,
  Pill,
  ReceiptText,
  Search,
  Siren,
  Stethoscope,
  Store,
  UserRoundSearch,
  House,
  ChevronDown,
} from "lucide-react";
import { TrackView } from "@/components/analytics/track-view";
import { HeroBackdrop, PanelBackdrop, ParcelArt } from "@/components/home/art";
import { LocationSelector } from "@/components/layout/location-selector";
import { ButtonLink } from "@/components/ui/button";
import { formatLongDate } from "@/lib/content/articles";
import { isSupabaseConfigured } from "@/lib/env";
import { site } from "@/lib/site/config";
import { createAnonClient } from "@/lib/supabase/server";

export const revalidate = 300;

const trust = [
  { icon: BadgeCheck, title: "Checked credentials", body: "Professional registration and pharmacy licences are checked before anyone is shown as verified. Pending checks are labelled as pending." },
  { icon: ReceiptText, title: "Transparent pricing", body: "Item prices, delivery and service fees are shown before you confirm. Totals are calculated on our servers, not guessed." },
  { icon: CreditCard, title: "Secure payments", body: "Payments go through regulated payment providers. MedTRANS never stores your card details." },
  { icon: FileLock2, title: "Private by design", body: "Health information is only visible to you and the professionals treating you. Every access to sensitive records is logged." },
] as const;

type Tile = { icon: LucideIcon; title: string; tag: string; start: string; more: string };

const pharmacyTiles: Tile[] = [
  { icon: Search, title: "Find a medicine", tag: "Prices from verified pharmacies", start: "/pharmacy/medicines", more: "/pharmacy" },
  { icon: FileUp, title: "Upload a prescription", tag: "Checked by a licensed pharmacist", start: "/pharmacy/medicines", more: "/how-it-works" },
  { icon: Store, title: "Find a pharmacy", tag: "Licensed and verified", start: "/pharmacies", more: "/pharmacy" },
  { icon: PackageCheck, title: "Track an order", tag: "Every real step, as it happens", start: "/orders/track", more: "/help" },
];

const careTiles: Tile[] = [
  { icon: House, title: "Home-care services", tag: "Eligible, non-emergency visits", start: "/doctorcare/services", more: "/doctorcare" },
  { icon: UserRoundSearch, title: "Find a doctor", tag: "Verified doctors and nurses", start: "/find-a-doctor", more: "/doctorcare" },
  { icon: Stethoscope, title: "Request a home visit", tag: "Safety questions first", start: "/doctorcare/book", more: "/how-it-works" },
  { icon: MapPinned, title: "SmartCare map", tag: "Suitable care near you", start: "/smartcare/map", more: "/coverage" },
];

const steps = [
  { title: "Tell us what you need", body: "Search for a medicine, or choose a home-care service and answer a few safety questions. Urgent symptoms are sent straight to emergency guidance." },
  { title: "Verified professionals check it", body: "A licensed pharmacist reviews any prescription, and only qualified, available clinicians who cover your area are offered your visit." },
  { title: "Delivered to your door", body: "Pay securely, then follow every real step of the delivery or visit. Your parcel is handed over only with your 4-digit code." },
] as const;

const faqs = [
  { q: "Is MedTRANS available now?", a: `We are preparing a pilot in ${site.pilot.city}. Services switch on area by area, only once pharmacies and professionals there have been verified. Use the coverage checker to see what's active where you are.` },
  { q: "Can MedTRANS send an ambulance?", a: "No. MedTRANS is not an emergency dispatch service. If someone's life may be at risk, contact local emergency services immediately. Our Emergency Help page shows what to do and which verified numbers to call." },
  { q: "How do you know a pharmacy or professional is genuine?", a: "Before anyone is shown as verified, we check their licence or professional registration with the relevant regulator and record who checked it and when. If a check is incomplete, we say so." },
  { q: "Will a pharmacy accept any uploaded prescription?", a: "No. An uploaded prescription is never automatically valid. A licensed pharmacist reviews it, and may approve it, ask for clarification, or decline it, before anything is dispensed." },
  { q: "Who can see my health information?", a: "You, and the professionals directly involved in your care. Delivery partners never see your prescriptions or clinical records. See our privacy notice for details." },
] as const;

async function latestArticles() {
  if (!isSupabaseConfigured()) return [];
  try {
    const { data } = await createAnonClient().from("articles").select("slug, title, summary, reviewed_at").eq("is_published", true).order("reviewed_at", { ascending: false }).limit(2);
    return data ?? [];
  } catch {
    return [];
  }
}

function MoreLink({ href, children, light = false }: { href: string; children: React.ReactNode; light?: boolean }) {
  return (
    <Link href={href} className={`inline-flex min-h-11 items-center gap-1.5 text-[0.95rem] font-medium hover:underline hover:underline-offset-4 ${light ? "text-white" : "text-navy"}`}>
      <CornerDownRight aria-hidden className="size-4" />
      {children}
    </Link>
  );
}

function TileCard({ tile }: { tile: Tile }) {
  const Icon = tile.icon;
  return (
    <article className="flex w-[78vw] shrink-0 snap-start flex-col rounded-md bg-surface p-4 sm:w-auto">
      <h3 className="text-lg font-medium tracking-[-0.02em]">{tile.title}</h3>
      <p className="label-mono mt-1 text-accent">{tile.tag}</p>
      <div className="grid flex-1 place-items-center py-10">
        <span className="grid size-24 place-items-center rounded-full bg-primary-soft text-primary">
          <Icon aria-hidden className="size-11" strokeWidth={1.25} />
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-line pt-2">
        <ButtonLink href={tile.start} className="min-h-11 px-2">Get started<span className="sr-only">: {tile.title}</span></ButtonLink>
        <Link href={tile.more} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md bg-background text-[0.95rem] text-navy hover:bg-sand">
          <CornerDownRight aria-hidden className="size-4" />Learn more<span className="sr-only">: {tile.title}</span>
        </Link>
      </div>
    </article>
  );
}

function CategoryPanel({ index, title, intro, tone, tiles }: { index: string; title: string; intro: string; tone: "sage" | "sand"; tiles: Tile[] }) {
  return (
    <div className="relative overflow-hidden rounded-xl">
      <PanelBackdrop tone={tone} />
      <div className="relative px-4 pt-10 pb-4 sm:px-8 sm:pt-14">
        <h2 className="display text-[3.4rem] text-white sm:text-8xl lg:text-[8.5rem]">{title}</h2>
        <p className="label-mono mt-8 text-white/90">{index}</p>
        <p className="mt-2 max-w-sm text-lg leading-snug text-white">{intro}</p>
        <div className="-mx-4 mt-10 flex snap-x gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
          {tiles.map((t) => <TileCard key={t.title} tile={t} />)}
        </div>
      </div>
    </div>
  );
}

export default async function HomePage() {
  const articles = await latestArticles();
  return (
    <>
      <TrackView event="landing_view" path="/" />

      {/* Hero: full-bleed, the three core actions above the fold on a phone (§6). */}
      <section className="relative -mt-16 flex min-h-[38rem] items-center text-white sm:-mt-[4.25rem] lg:min-h-[44rem]">
        <HeroBackdrop />
        <div className="container-page relative pt-24 pb-10 text-center sm:pt-32 sm:pb-40">
          <h1 className="display mx-auto max-w-5xl text-[2.6rem] text-white sm:text-7xl lg:text-[6.5rem]">Healthcare that comes to you.</h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-white/90 sm:mt-6 sm:text-lg">
            Order your medicines, find trusted healthcare professionals, and request home-based care through one convenient platform.
          </p>
          <div className="mx-auto mt-6 grid max-w-sm gap-2.5 sm:mt-8 sm:flex sm:max-w-none sm:flex-wrap sm:justify-center">
            <ButtonLink href="/pharmacy" size="lg"><Pill aria-hidden className="size-5" />Order Medicines</ButtonLink>
            <ButtonLink href="/doctorcare" size="lg" variant="navy"><Stethoscope aria-hidden className="size-5" />Request Home Care</ButtonLink>
            <ButtonLink href="/emergency" size="lg" variant="urgent"><Siren aria-hidden className="size-5" />Get Urgent Medical Help</ButtonLink>
          </div>
          <div className="mx-auto mt-5 max-w-sm text-left">
            <p className="mb-1.5 text-sm text-white/90">Enter your location or allow location access.</p>
            <LocationSelector className="w-full max-w-none justify-start px-4 py-3 text-base" />
          </div>
        </div>
        {/* Floating card (desktop), as in the reference layout; points at something real: coverage. */}
        <div className="absolute bottom-3 left-3 hidden w-[27rem] grid-cols-[6rem_1fr] gap-4 rounded-md bg-surface p-3 text-ink shadow-xl lg:grid">
          <div className="grid place-items-center rounded bg-primary-soft text-primary"><MapPinned aria-hidden className="size-10" strokeWidth={1.25} /></div>
          <div>
            <p className="label-mono text-accent">{site.pilot.city} pilot</p>
            <p className="mt-1 text-lg leading-tight tracking-[-0.02em]">Check whether we cover your area</p>
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-2">
              <MoreLink href="/how-it-works">Learn more</MoreLink>
              <ButtonLink href="/coverage" className="min-h-10 px-3">Check coverage</ButtonLink>
            </div>
          </div>
        </div>
      </section>

      {/* Statement */}
      <section className="container-page grid items-center gap-10 py-16 sm:py-24 lg:grid-cols-2">
        <ParcelArt className="mx-auto w-full max-w-md lg:order-none" />
        <div>
          <h2 className="display text-5xl sm:text-6xl lg:text-7xl">Making good care easy to reach</h2>
          <hr className="my-6 max-w-md border-line" />
          <p className="max-w-md text-[0.95rem] text-muted">
            One account for medicines from verified pharmacies, eligible home visits by qualified professionals, and clear guidance when it&apos;s urgent.
          </p>
          <ButtonLink href="/how-it-works" variant="navy" className="mt-6">How MedTRANS works</ButtonLink>
        </div>
      </section>

      {/* Trust columns */}
      <section aria-labelledby="trust-heading" className="container-page pb-16 sm:pb-24">
        <h2 id="trust-heading" className="max-w-md text-4xl sm:text-5xl">Trust you can check</h2>
        <div className="mt-10 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {trust.map(({ icon: Icon, title, body }) => (
            <div key={title} className="border-t border-line pt-4">
              <Icon aria-hidden className="size-6 text-navy" strokeWidth={1.5} />
              <h3 className="mt-10 text-xl font-normal">{title}</h3>
              <p className="mt-2 max-w-xs text-[0.9rem] text-muted">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Category panels */}
      <section aria-label="Services" className="space-y-20 px-2 sm:space-y-28">
        <div>
          <CategoryPanel index="01" title="Pharmacy" tone="sage" tiles={pharmacyTiles}
            intro="Medicines from verified, licensed pharmacies, with prescriptions checked by a pharmacist before anything is dispensed." />
          <div className="container-page mt-10 grid gap-6 lg:grid-cols-2">
            <p className="text-4xl leading-tight tracking-[-0.03em] sm:text-5xl">Order your <span className="text-primary">medicines</span> with confidence</p>
            <div>
              <p className="max-w-sm text-[0.95rem] text-muted">See real stock and prices from verified pharmacies, and know exactly what you&apos;ll pay before you confirm.</p>
              <div className="mt-4 border-b border-line"><MoreLink href="/pharmacy">Explore Pharmacy</MoreLink></div>
            </div>
          </div>
        </div>
        <div>
          <CategoryPanel index="02" title="DoctorCare" tone="sand" tiles={careTiles}
            intro="Qualified doctors and nurses for eligible, non-emergency home visits, matched by who is genuinely suitable and available." />
          <div className="container-page mt-10 grid gap-6 lg:grid-cols-2">
            <p className="text-4xl leading-tight tracking-[-0.03em] sm:text-5xl">Care from <span className="text-accent">verified professionals</span></p>
            <div>
              <p className="max-w-sm text-[0.95rem] text-muted">Every doctor and nurse is checked with their regulator before they can be offered a visit. If no one suitable is free, we tell you plainly.</p>
              <div className="mt-4 border-b border-line"><MoreLink href="/doctorcare">Explore DoctorCare</MoreLink></div>
              <ButtonLink href="/doctorcare/book" variant="navy" className="mt-4">Request a home visit</ButtonLink>
            </div>
          </div>
        </div>
      </section>

      {/* Explainers */}
      <section className="container-page grid gap-12 py-20 sm:py-28 lg:grid-cols-2">
        <div>
          <h2 className="display text-5xl sm:text-6xl">Medical care, on your terms.</h2>
          <hr className="my-6 max-w-sm border-line" />
          <p className="font-medium">How prescription checks work</p>
          <p className="mt-2 max-w-md text-[0.95rem] text-muted">
            You upload your prescription securely; only the reviewing pharmacy can open it. A licensed pharmacist checks it is valid and matches what you ordered, then approves it, asks you a question, or explains why it can&apos;t be dispensed.
          </p>
          <ButtonLink href="/pharmacy/medicines" variant="navy" className="mt-6">Find a medicine</ButtonLink>
        </div>
        <div className="rounded-xl bg-sand p-6 sm:p-10">
          <p className="label-mono text-accent">Nearest suitable, not just nearest</p>
          <ol className="mt-6 space-y-5">
            {[
              "Only verified, active professionals qualified for your service are considered.",
              "They must genuinely be available and cover your area.",
              "Among those, we rank by travel time, distance and timing.",
              "If no one suitable is available, we tell you plainly and show your options.",
            ].map((t, i) => (
              <li key={t} className="grid grid-cols-[2.5rem_1fr] gap-3 border-t border-line pt-4">
                <span className="label-mono pt-1 text-muted">[0{i + 1}]</span>
                <span className="text-lg leading-snug tracking-[-0.01em]">{t}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* How it works */}
      <section aria-labelledby="how-heading" className="px-2">
        <div className="relative overflow-hidden rounded-xl text-white">
          <PanelBackdrop tone="dusk" />
          <div className="relative px-4 py-12 sm:px-8 sm:py-16">
            <p className="max-w-sm text-lg leading-snug text-white">Follow a short, guided process, with a real person checking every step that needs one.</p>
            <h2 id="how-heading" className="display mt-10 text-6xl text-white sm:text-8xl lg:text-[8.5rem]">How it works</h2>
            <ol className="mt-12 grid gap-3 lg:grid-cols-3">
              {steps.map((s, i) => (
                <li key={s.title} className="rounded-md bg-white/10 p-5 backdrop-blur-sm">
                  <p className="label-mono text-white/80">[0{i + 1}]</p>
                  <h3 className="mt-8 text-2xl font-normal text-white">{s.title}</h3>
                  <p className="mt-3 text-[0.95rem] text-white/85">{s.body}</p>
                </li>
              ))}
            </ol>
            <div className="mt-8"><MoreLink href="/how-it-works" light>Read the full walkthrough</MoreLink></div>
          </div>
        </div>
      </section>

      {/* Health guide */}
      <section aria-labelledby="guide-heading" className="container-page py-20 sm:py-28">
        <h2 id="guide-heading" className="display text-center text-6xl sm:text-8xl lg:text-[8.5rem]">Health Guide</h2>
        <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_2fr]">
          <div className="border-t border-line pt-4">
            <p className="text-xl leading-snug tracking-[-0.01em]">Health information reviewed by qualified clinicians.</p>
            <p className="mt-3 max-w-xs text-[0.9rem] text-muted">Every article names the clinician who reviewed it and when. It is general information, not a diagnosis.</p>
            <ButtonLink href="/resources" variant="navy" className="mt-6">View all articles</ButtonLink>
          </div>
          {articles.length ? (
            <ul className="grid gap-4 sm:grid-cols-2">
              {articles.map((a) => (
                <li key={a.slug} className="flex flex-col">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-md"><PanelBackdrop tone="sand" /></div>
                  <h3 className="mt-4 text-xl font-normal">{a.title}</h3>
                  <p className="mt-1 text-[0.9rem] text-muted">Reviewed {formatLongDate(a.reviewed_at as string)}</p>
                  <MoreLink href={`/resources/${a.slug}`}>Read article<span className="sr-only">: {a.title}</span></MoreLink>
                </li>
              ))}
            </ul>
          ) : (
            <div className="grid place-items-center rounded-md border border-dashed border-line p-10 text-center text-[0.95rem] text-muted">
              Articles appear here once a named clinician has reviewed them.
            </div>
          )}
        </div>
      </section>

      {/* Emergency band: always plain about what MedTRANS is not. */}
      <section aria-labelledby="urgent-heading" className="px-2">
        <div className="grid gap-6 rounded-xl bg-urgent-soft p-6 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="label-mono text-urgent">If someone&apos;s life may be at risk</p>
            <h2 id="urgent-heading" className="mt-2 text-3xl sm:text-4xl">MedTRANS is not an emergency service.</h2>
            <p className="mt-2 max-w-xl text-[0.95rem] text-ink">Contact local emergency services immediately. Emergency Help shows what to do right now and which verified numbers to call, with no sign-in.</p>
          </div>
          <ButtonLink href="/emergency" size="lg" variant="urgent"><Siren aria-hidden className="size-5" />Open Emergency Help</ButtonLink>
        </div>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq-heading" className="container-page grid gap-10 py-20 sm:py-28 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <h2 id="faq-heading" className="text-4xl sm:text-5xl">Questions people ask</h2>
          <p className="mt-4 max-w-sm text-lg leading-snug text-muted">Answers about medicines, home visits, safety and your privacy.</p>
          <p className="mt-6"><MoreLink href="/help">Visit the Help Centre</MoreLink></p>
        </div>
        <div className="border-t border-line">
          {faqs.map(({ q, a }) => (
            <details key={q} className="group border-b border-line">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 text-[0.95rem] text-navy">
                {q}
                <ChevronDown aria-hidden className="size-4 shrink-0 transition-transform group-open:rotate-180" />
              </summary>
              <p className="pb-5 text-[0.95rem] text-muted">{a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
