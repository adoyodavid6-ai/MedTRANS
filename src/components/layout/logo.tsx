import Link from "next/link";
import { cn } from "@/lib/cn";

/** Text wordmark. [[CONFIRM: brand assets]] — replace with the approved logo when supplied. */
export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <Link href="/" className="inline-flex min-h-11 items-center gap-2.5 rounded-lg" aria-label="MedTRANS home">
      <svg aria-hidden viewBox="0 0 32 32" className={cn("shrink-0", size === "lg" ? "size-11" : "size-8")}>
        <rect width="32" height="32" rx="9" fill="var(--color-primary)" />
        <path d="M13.5 8h5v5.5H24v5h-5.5V24h-5v-5.5H8v-5h5.5z" fill="#fff" />
      </svg>
      <span className={cn("font-bold tracking-tight text-navy", size === "lg" ? "text-[2rem] leading-none" : "text-lg")}>
        Med<span className="text-primary">TRANS</span>
      </span>
    </Link>
  );
}
