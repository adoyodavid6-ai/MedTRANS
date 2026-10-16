import { cn } from "@/lib/cn";

export type TimelineStep = {
  key: string;
  label: string;
  explanation?: string;
  /** ISO timestamp from a recorded event. Only steps with a real timestamp are shown as done. */
  at?: string | null;
};

/**
 * Generic, honest status timeline. A step is "done" only if a recorded event backs it,
 * so this component cannot show progress that didn't happen. Used by orders, visits and
 * emergency requests from Phase 2 onwards.
 */
export function StatusTimeline({ steps, formatTime }: { steps: TimelineStep[]; formatTime?: (iso: string) => string }) {
  const fmt =
    formatTime ??
    ((iso: string) =>
      new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Nairobi" }).format(
        new Date(iso),
      ));
  const lastDone = steps.reduce((acc, s, i) => (s.at ? i : acc), -1);

  return (
    <ol className="space-y-0">
      {steps.map((step, i) => {
        const done = Boolean(step.at);
        const current = i === lastDone;
        return (
          <li key={step.key} className="relative flex gap-3 pb-5 last:pb-0" aria-current={current ? "step" : undefined}>
            {i < steps.length - 1 ? (
              <span aria-hidden className={cn("absolute top-6 left-[0.6875rem] h-full w-0.5", done ? "bg-primary" : "bg-line")} />
            ) : null}
            <span
              aria-hidden
              className={cn(
                "relative z-10 mt-1 size-6 shrink-0 rounded-full border-2",
                done ? "border-primary bg-primary" : "border-line bg-surface",
              )}
            />
            <div>
              <p className={cn("font-semibold", done ? "text-navy" : "text-muted")}>
                {step.label}
                <span className="sr-only">{done ? " — completed" : " — not yet"}</span>
              </p>
              {step.at ? <p className="text-sm text-muted">{fmt(step.at)}</p> : null}
              {step.explanation ? <p className="text-sm text-muted">{step.explanation}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
