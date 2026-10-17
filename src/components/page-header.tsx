import type { ReactNode } from "react";

/** Editorial page heading: small monospaced label, large light title, thin rule below. */
export function PageHeader({ eyebrow, title, intro, children }: { eyebrow?: string; title: string; intro?: ReactNode; children?: ReactNode }) {
  return (
    <div className="container-page pt-10 sm:pt-16">
      <div className="border-b border-line pb-10 sm:pb-14">
        {eyebrow ? <p className="label-mono text-accent">{eyebrow}</p> : null}
        <h1 className="display mt-3 text-[2.75rem] sm:text-6xl lg:text-7xl">{title}</h1>
        {intro ? <div className="mt-5 max-w-2xl text-lg leading-snug text-muted">{intro}</div> : null}
        {children}
      </div>
    </div>
  );
}
