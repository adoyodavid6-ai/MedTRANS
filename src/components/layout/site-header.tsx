import Link from "next/link";
import { MAIN_NAV } from "@/lib/site/routes";
import { AccountLinks } from "./account-links";
import { EmergencyButton } from "./emergency-button";
import { LocationSelector } from "./location-selector";
import { Logo } from "./logo";
import { MobileMenu } from "./mobile-menu";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
      <div className="container-page flex h-16 max-w-[84rem] items-center gap-3">
        <Logo />
        <nav aria-label="Main" className="ml-2 hidden xl:block">
          <ul className="flex items-center gap-0.5">
            {MAIN_NAV.filter((i) => i.href !== "/emergency").map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="inline-flex min-h-11 items-center rounded-lg px-2 text-[0.9rem] font-medium whitespace-nowrap text-navy hover:bg-primary-soft hover:text-primary-hover"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden 2xl:block">
            <LocationSelector />
          </div>
          <EmergencyButton />
          <div className="hidden xl:block">
            <AccountLinks />
          </div>
          <div className="xl:hidden">
            <MobileMenu />
          </div>
        </div>
      </div>
    </header>
  );
}
