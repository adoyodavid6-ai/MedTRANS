import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, Siren } from "lucide-react";
import { cn } from "@/lib/cn";

type Tone = "info" | "warning" | "urgent" | "success";

const styles: Record<Tone, { box: string; Icon: typeof Info }> = {
  info: { box: "bg-primary-soft border-[#b9dfdc] text-ink", Icon: Info },
  warning: { box: "bg-warning-soft border-[#f0d58a] text-warning-ink", Icon: AlertTriangle },
  urgent: { box: "bg-urgent-soft border-[#f3b9b9] text-[#7a1717]", Icon: Siren },
  success: { box: "bg-[#e3f5ec] border-[#a9dcc2] text-[#14583a]", Icon: CheckCircle2 },
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
  role,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
  role?: "status" | "alert";
}) {
  const { box, Icon } = styles[tone];
  return (
    <div role={role} className={cn("flex gap-3 rounded-xl border p-4", box, className)}>
      <Icon aria-hidden className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 space-y-1 text-[0.95rem]">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children}
      </div>
    </div>
  );
}
