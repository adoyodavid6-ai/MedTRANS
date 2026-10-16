import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, intro, children }: { eyebrow?: string; title: string; intro?: ReactNode; children?: ReactNode }) {
  return (
    <div className="border-b border-line bg-surface">
      <div className="container-page py-10 sm:py-14">
        {eyebrow ? <p className="text-sm font-semibold tracking-wide text-primary uppercase">{eyebrow}</p> : null}
        <h1 className="mt-1 text-3xl font-bold sm:text-4xl">{title}</h1>
        {intro ? <div className="mt-3 max-w-2xl text-lg text-muted">{intro}</div> : null}
        {children}
      </div>
    </div>
  );
}
