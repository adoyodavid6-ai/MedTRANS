import Link from "next/link";
import { ArrowRight, Siren } from "lucide-react";
import { Pending } from "@/components/pending";
import { site } from "@/lib/site/config";
import { FOOTER_NAV } from "@/lib/site/routes";
import { Logo } from "./logo";

const LEGAL = [
  { href: "/legal/privacy", label: "Privacy notice" },
  { href: "/legal/terms", label: "Terms of service" },
  { href: "/legal/cancellation-and-refunds", label: "Cancellation and refunds" },
  { href: "/legal/healthcare-disclaimer", label: "Healthcare disclaimer" },
] as const;

export function SiteFooter() {
  return (
    <footer className="mt-20 px-2 pb-2">
      <div className="rounded-xl bg-nav px-5 pt-10 pb-12 text-white sm:px-10 lg:px-16">
        <div className="flex justify-center"><Logo tone="light" /></div>
        <p className="display mx-auto mt-12 max-w-4xl text-center text-[2.6rem] text-white sm:text-6xl lg:text-7xl">
          Your medicine. Your doctor. Your care.
        </p>

        <div className="mt-16 grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="grid min-w-0 grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4">
            {FOOTER_NAV.filter((g) => g.heading !== "Legal").map((group) => (
              <nav key={group.heading} aria-label={group.heading} className="border-t border-white/15 pt-4">
                <h2 className="label-mono text-white/70">{group.heading}</h2>
                <ul className="mt-4 space-y-0.5">
                  {group.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="inline-flex min-h-9 items-center text-[0.95rem] text-white hover:underline hover:underline-offset-4">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
            <div className="col-span-2 border-t border-white/15 pt-4 md:col-span-1">
              <h2 className="label-mono text-white/70">For support and questions</h2>
              <p className="mt-4 text-[0.95rem]">
                <Pending item={site.support.email} fallback={<Link href="/contact" className="underline underline-offset-4">Use our contact form</Link>} render={(v) => <a href={`mailto:${v}`} className="underline underline-offset-4">{v}</a>} />
              </p>
            </div>
            <div className="col-span-2 border-t border-white/15 pt-4 md:col-span-2">
              <h2 className="label-mono text-white/70">If someone&apos;s life may be at risk</h2>
              <p className="mt-4 text-[0.95rem]">
                MedTRANS is not an emergency service.{" "}
                <Link href="/emergency" className="inline-flex items-center gap-1 font-medium underline underline-offset-4">
                  <Siren aria-hidden className="size-4" />
                  Emergency Help
                </Link>
              </p>
            </div>
          </div>

          <div className="min-w-0 space-y-2">
            <Link href="/sign-in?mode=start" className="group block overflow-hidden rounded-md bg-primary p-5 text-white hover:bg-primary-hover">
              <span className="label-mono text-white/85">Ready to get started?</span>
              <span aria-hidden className="mt-20 block overflow-hidden whitespace-nowrap">
                <span className="marquee inline-block text-5xl font-normal tracking-[-0.04em]">
                  Order medicines &nbsp;·&nbsp; Request home care &nbsp;·&nbsp; Order medicines &nbsp;·&nbsp; Request home care &nbsp;·&nbsp;
                </span>
              </span>
              <span className="sr-only">Create your MedTRANS account</span>
            </Link>
            <Link href="/sign-in" className="flex h-12 items-center gap-2 rounded-md bg-surface px-4 text-[0.95rem] text-navy hover:bg-white">
              <ArrowRight aria-hidden className="size-4" />
              Member login
            </Link>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2 px-2 py-4 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>
          <Pending item={site.business.legalName} fallback="Registered business details are being confirmed." /> · © {new Date().getFullYear()} MedTRANS
        </p>
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {LEGAL.map((l) => (
            <li key={l.href}><Link href={l.href} className="underline underline-offset-2 hover:text-navy">{l.label}</Link></li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
