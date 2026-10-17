"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="container-page max-w-xl py-16 text-center">
      <h1 className="text-3xl font-medium">Something went wrong</h1>
      <p className="mt-3 text-muted">This page couldn&apos;t load. Nothing you entered has been submitted twice. Please try again.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button onClick={() => reset()}>Try again</Button>
        <Link href="/emergency" className="inline-flex min-h-11 items-center rounded-xl bg-urgent px-4 font-semibold text-white">Emergency Help</Link>
      </div>
    </div>
  );
}
