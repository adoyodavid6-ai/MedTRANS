import Link from "next/link";
import { Pending } from "@/components/pending";
import { site } from "@/lib/site/config";
import { FOOTER_NAV } from "@/lib/site/routes";
import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="container-page grid grid-cols-2 gap-x-6 gap-y-10 py-12 md:grid-cols-[1.2fr_repeat(4,1fr)]">
        <div className="col-span-2 space-y-3 md:col-span-1">
          <Logo />
          <p className="max-w-xs text-sm text-muted">{site.tagline}</p>
          <dl className="space-y-1 text-sm text-muted">
            <div>
              <dt className="sr-only">Support email</dt>
              <dd>
                <Pending item={site.support.email} fallback="Support contact details are being confirmed." render={(v) => <a href={`mailto:${v}`}>{v}</a>} />
              </dd>
            </div>
          </dl>
        </div>
        {FOOTER_NAV.map((group) => (
          <nav key={group.heading} aria-label={group.heading}>
            <h2 className="text-sm font-semibold text-navy">{group.heading}</h2>
            <ul className="mt-3 space-y-1">
              {group.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="inline-flex min-h-9 items-center text-sm text-muted hover:text-primary">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="container-page space-y-2 py-6 text-xs text-muted">
          <p>
            <strong className="text-ink">MedTRANS is not an emergency service.</strong> If someone&apos;s life may be at risk,
            contact your local emergency services immediately. See{" "}
            <Link href="/emergency" className="underline underline-offset-2">
              Emergency Help
            </Link>
            .
          </p>
          <p>
            <Pending item={site.business.legalName} fallback="Registered business details are being confirmed." /> ·{" "}
            © {new Date().getFullYear()} MedTRANS
          </p>
        </div>
      </div>
    </footer>
  );
}
