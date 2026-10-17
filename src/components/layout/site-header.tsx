import { AccountLinks } from "./account-links";
import { EmergencyButton } from "./emergency-button";
import { Logo } from "./logo";
import { MobileMenu } from "./mobile-menu";
import { NavLinks } from "./nav-links";

/**
 * Floating header: a dark bar that sits over the page and stays pinned while scrolling.
 * Emergency Help is always in it, on every screen size.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 px-2 pt-2 sm:pt-3">
      <div className="mx-auto flex h-14 max-w-[64rem] items-center gap-2 rounded-md bg-nav/90 pr-1.5 pl-1.5 text-white shadow-lg backdrop-blur supports-[backdrop-filter]:bg-nav/80 sm:pl-4">
        {/* Mobile: menu · logo · emergency + login */}
        <div className="lg:hidden"><MobileMenu /></div>
        <div className="flex flex-1 justify-center lg:flex-none lg:justify-start"><Logo tone="light" /></div>
        <nav aria-label="Main" className="mx-auto hidden lg:block">
          <NavLinks />
        </nav>
        <div className="flex items-center gap-1.5">
          <EmergencyButton className="h-11 min-h-0 rounded-md px-2.5" />
          <div className="hidden sm:block"><AccountLinks variant="pill" /></div>
        </div>
      </div>
    </header>
  );
}
