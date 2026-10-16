import { Search } from "lucide-react";
import { cn } from "@/lib/cn";

/** Medicine search. A plain GET form, so it works without JavaScript. */
export function SiteSearch({ className, id = "site-search" }: { className?: string; id?: string }) {
  return (
    <form action="/pharmacy/medicines" method="get" role="search" className={cn("flex h-11 w-full overflow-hidden rounded-md border border-muted bg-surface focus-within:ring-2 focus-within:ring-primary", className)}>
      <label htmlFor={id} className="sr-only">Search medicines</label>
      <input id={id} name="q" type="search" placeholder="Search medicines" maxLength={80} autoComplete="off"
        className="min-w-0 flex-1 bg-transparent px-3 text-[0.95rem] text-ink placeholder:text-muted focus:outline-none" />
      <button type="submit" className="inline-flex w-12 items-center justify-center border-l border-muted text-navy hover:bg-primary-soft">
        <Search aria-hidden className="size-5" />
        <span className="sr-only">Search</span>
      </button>
    </form>
  );
}
