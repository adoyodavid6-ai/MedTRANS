import Link from "next/link";
import { site } from "@/lib/site/config";
import { UTILITY_NAV } from "@/lib/site/routes";
import { AccountLinks } from "./account-links";
import { EmergencyButton } from "./emergency-button";
import { LocationSelector } from "./location-selector";
import { Logo } from "./logo";
import { MainNav } from "./main-nav";
import { MobileMenu } from "./mobile-menu";
import { SiteSearch } from "./site-search";

/**
 * Three-tier header (desktop): utility bar, logo + search, grey menu bar.
 * The header is sticky with a negative offset equal to the first two tiers (2.25rem + 5.5rem),
 * so they scroll away and the menu bar, with Emergency Help, stays pinned to the top.
 * Mobile: one compact sticky row (logo, Emergency Help, menu).
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface lg:top-[-7.75rem] lg:border-b-0">
      {/* Tier 1: utility bar */}
      <div className="hidden h-9 lg:block">
        <div className="container-page flex h-full max-w-[84rem] items-center justify-between gap-4">
          <p className="text-xs font-bold tracking-[0.08em] text-navy uppercase">{site.promise}</p>
          <ul className="flex items-center text-sm font-semibold">
            {UTILITY_NAV.map((l, i) => (
              <li key={l.href} className="flex items-center">
                {i > 0 ? <span aria-hidden className="px-1.5 text-primary">/</span> : null}
                <Link href={l.href} className="text-navy hover:text-primary-hover hover:underline">{l.label}</Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Tier 2: logo and search (desktop) / compact bar (mobile) */}
      <div className="container-page flex h-16 max-w-[84rem] items-center gap-3 lg:h-[5.5rem] lg:gap-4">
        <span className="lg:hidden"><Logo /></span>
        <span className="hidden lg:inline-flex"><Logo size="lg" /></span>
        <div className="ml-auto hidden items-center gap-3 lg:flex">
          <div className="hidden xl:block"><LocationSelector /></div>
          <SiteSearch className="w-72 xl:w-80" />
          <AccountLinks />
        </div>
        <div className="ml-auto flex items-center gap-2 lg:hidden">
          <EmergencyButton />
          <MobileMenu />
        </div>
      </div>

      {/* Tier 3: grey menu bar, pinned while scrolling */}
      <div className="hidden border-y border-line bg-[var(--color-nav)] lg:block">
        <div className="container-page flex max-w-[84rem] items-center justify-between gap-4">
          <div className="-ml-4"><MainNav /></div>
          <EmergencyButton className="min-h-9 py-1.5" />
        </div>
      </div>
    </header>
  );
}
