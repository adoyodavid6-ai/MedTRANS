import Link from "next/link";
import { cn } from "@/lib/cn";

/** Text wordmark. [[CONFIRM: brand assets]] — replace with the approved logo when supplied. */
export function Logo({ size = "md", tone = "dark" }: { size?: "md" | "lg"; tone?: "dark" | "light" }) {
  return (
    <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-lg" aria-label="MedTRANS home">
      <svg aria-hidden viewBox="0 0 32 32" className={cn("shrink-0", size === "lg" ? "size-10" : "size-7")}>
        <rect width="32" height="32" rx="8" fill={tone === "light" ? "#fffdf9" : "var(--color-primary)"} />
        <path d="M13.5 8h5v5.5H24v5h-5.5V24h-5v-5.5H8v-5h5.5z" fill={tone === "light" ? "var(--color-nav)" : "#fff"} />
      </svg>
      <span className={cn("font-semibold tracking-[-0.03em]", size === "lg" ? "text-3xl" : "text-[1.2rem]", tone === "light" ? "text-white" : "text-navy")}>
        MedTRANS
      </span>
    </Link>
  );
}
