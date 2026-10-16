import type { ReactNode } from "react";
import { BadgeCheck, CircleDashed, Clock, ShieldOff } from "lucide-react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "primary" | "warning" | "urgent" | "success";

const tones: Record<Tone, string> = {
  neutral: "bg-[#eef2f1] text-ink",
  primary: "bg-primary-soft text-primary-hover",
  warning: "bg-warning-soft text-warning-ink",
  urgent: "bg-urgent-soft text-urgent-hover",
  success: "bg-[#e3f5ec] text-[#14583a]",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone], className)}>
      {children}
    </span>
  );
}

export type VerificationStatus = "unverified" | "pending" | "verified" | "suspended";

const verification: Record<VerificationStatus, { label: string; tone: Tone; Icon: typeof BadgeCheck }> = {
  verified: { label: "Verified", tone: "success", Icon: BadgeCheck },
  pending: { label: "Verification pending", tone: "warning", Icon: Clock },
  suspended: { label: "Suspended", tone: "urgent", Icon: ShieldOff },
  unverified: { label: "Not verified", tone: "neutral", Icon: CircleDashed },
};

/**
 * Shows a verification state exactly as stored. It cannot be told to say "verified";
 * it can only display a status that came from a completed check in the database.
 */
export function VerificationBadge({ status }: { status: VerificationStatus }) {
  const { label, tone, Icon } = verification[status];
  return (
    <Badge tone={tone}>
      <Icon aria-hidden className="size-3.5" />
      {label}
    </Badge>
  );
}
