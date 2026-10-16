import Link from "next/link";

/** Text wordmark. [[CONFIRM: brand assets]] — replace with the approved logo when supplied. */
export function Logo() {
  return (
    <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-lg" aria-label="MedTRANS home">
      <svg aria-hidden viewBox="0 0 32 32" className="size-8 shrink-0">
        <rect width="32" height="32" rx="9" fill="var(--color-primary)" />
        <path d="M13.5 8h5v5.5H24v5h-5.5V24h-5v-5.5H8v-5h5.5z" fill="#fff" />
      </svg>
      <span className="text-lg font-bold tracking-tight text-navy">
        Med<span className="text-primary">TRANS</span>
      </span>
    </Link>
  );
}
