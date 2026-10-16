import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-line bg-surface px-5 py-8 text-center">
      <Icon aria-hidden className="mx-auto size-8 text-muted" />
      <p className="mt-3 font-semibold text-navy">{title}</p>
      {children ? <div className="mx-auto mt-1.5 max-w-prose text-[0.95rem] text-muted">{children}</div> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
