import type { Metadata, Viewport } from "next";
import { AnnouncementStrip } from "@/components/layout/announcement-strip";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { JsonLd } from "@/components/seo/json-ld";
import { siteUrl } from "@/lib/env";
import { site } from "@/lib/site/config";
import "@fontsource-variable/inter-tight";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: `${site.name} — ${site.promise}`, template: `%s · ${site.name}` },
  description: "Order medicines from verified pharmacies, request qualified home care, and get clear guidance when it's urgent.",
  applicationName: site.name,
  openGraph: { siteName: site.name, type: "website", locale: "en_GB" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#2A2A28",
  width: "device-width",
  initialScale: 1,
};

// Public chrome (announcement strip) refreshes every five minutes.
export const revalidate = 300;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB">
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only z-50 rounded-lg bg-navy px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
        >
          Skip to main content
        </a>
        <AnnouncementStrip />
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
        <JsonLd data={{ "@context": "https://schema.org", "@type": "Organization", name: site.name, url: siteUrl, slogan: site.promise, areaServed: `${site.pilot.city}, ${site.pilot.country}` }} />
      </body>
    </html>
  );
}
