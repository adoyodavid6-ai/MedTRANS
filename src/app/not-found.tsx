import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="container-page max-w-xl py-16 text-center">
      <p className="text-sm font-semibold text-primary">404</p>
      <h1 className="mt-2 text-3xl font-bold">We couldn&apos;t find that page</h1>
      <p className="mt-3 text-muted">It may have moved, or the link may be mistyped.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/">Go to the homepage</ButtonLink>
        <ButtonLink href="/emergency" variant="urgent">Emergency Help</ButtonLink>
      </div>
      <p className="mt-6 text-sm"><Link href="/help" className="text-primary underline">Help Centre</Link></p>
    </div>
  );
}
