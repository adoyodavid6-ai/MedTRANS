import type { Metadata } from "next";
import Link from "next/link";
import { Construction, Siren } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { routeFor, type PublicHref } from "@/lib/site/routes";

const MODULE_NOTES: Record<string, string> = {
  pharmacy:
    "MedTRANS Pharmacy will open once licensed pharmacies have been verified, prescription review is staffed by licensed pharmacists, and payments are connected. Until then, nothing here can be ordered.",
  doctorcare:
    "DoctorCare will open once doctors and nurses have been verified with their regulators and their availability is live. Until then, no visit can be booked.",
  smartcare:
    "Matching and maps will open alongside DoctorCare, using only verified, genuinely available professionals.",
  partners:
    "Registration will open with the verification workflow for this partner type, so every application is checked properly from the start.",
  company: "This section will be published once its content has been professionally reviewed.",
};

export function plannedMetadata(href: PublicHref): Metadata {
  const r = routeFor(href);
  return {
    title: r.title,
    description: r.description,
    alternates: { canonical: href },
    // Placeholder pages are not indexed until they hold real content (§19: no thin pages).
    robots: { index: false, follow: true },
  };
}

/** The explicit "not yet activated" state required by §21 for every nav item that is not live yet. */
export function NotYetActivated({ href }: { href: PublicHref }) {
  const r = routeFor(href);
  const note = (r.module && MODULE_NOTES[r.module]) ?? "This part of MedTRANS is not active yet.";
  return (
    <>
      <PageHeader title={r.title} intro={r.description}>
        <div className="mt-4">
          <Badge tone="warning">
            <Construction aria-hidden className="size-3.5" />
            Not yet activated
          </Badge>
        </div>
      </PageHeader>
      <div className="container-page max-w-3xl space-y-6 py-10">
        <Alert tone="info" title="This service is not available yet">
          <p>{note}</p>
          <p className="text-sm">Planned for build phase {r.phase}. We will not take requests here until it is genuinely ready.</p>
        </Alert>
        <Alert tone="urgent" title="Need help urgently?">
          <p>
            If someone&apos;s life may be at risk, contact local emergency services now.{" "}
            <Link href="/emergency" className="font-semibold underline underline-offset-2">
              Open Emergency Help
            </Link>
          </p>
        </Alert>
        <div className="flex flex-wrap gap-3">
          <Link href="/coverage" className={buttonClasses("secondary")}>
            Check coverage in your area
          </Link>
          <Link href="/help" className={buttonClasses("ghost")}>
            Visit the Help Centre
          </Link>
          <Link href="/emergency" className={buttonClasses("ghost", "md", "text-urgent")}>
            <Siren aria-hidden className="size-4" />
            Emergency Help
          </Link>
        </div>
      </div>
    </>
  );
}
