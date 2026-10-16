import Link from "next/link";
import { Siren } from "lucide-react";
import { cn } from "@/lib/cn";

/** The always-visible route to emergency guidance (§10). A plain link: works without JavaScript. */
export function EmergencyButton({ className }: { className?: string }) {
  return (
    <Link
      href="/emergency"
      aria-label="Emergency Help"
      className={cn(
        "inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-urgent px-3 py-2 text-sm font-semibold whitespace-nowrap text-white hover:bg-urgent-hover",
        className,
      )}
    >
      <Siren aria-hidden className="size-4" />
      <span>
        Emergency<span className="hidden min-[400px]:inline"> Help</span>
      </span>
    </Link>
  );
}
