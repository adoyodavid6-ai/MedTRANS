import type { ReactNode } from "react";
import type { Confirmable } from "@/lib/site/config";

const showTokens = process.env.NODE_ENV !== "production";

/**
 * Renders a confirmed value, or an honest fallback when the value has not been supplied yet.
 * In development the checklist token is shown alongside, so gaps are visible to the team.
 */
export function Pending<T extends ReactNode>({
  item,
  fallback,
  render,
}: {
  item: Confirmable<T>;
  fallback: ReactNode;
  render?: (value: T) => ReactNode;
}) {
  if (item.value !== null) return <>{render ? render(item.value) : item.value}</>;
  return (
    <>
      {fallback}
      {showTokens ? (
        <code className="ml-1.5 rounded bg-warning-soft px-1.5 py-0.5 text-xs text-warning-ink">{item.token}</code>
      ) : null}
    </>
  );
}
