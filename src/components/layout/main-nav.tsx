"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { NAV_GROUPS } from "@/lib/site/routes";

/**
 * Desktop menu bar: one disclosure button per group, each revealing a list of links.
 * Closes on Escape (returning focus to its button), on a click elsewhere and on navigation.
 */
export function MainNav() {
  const [open, setOpen] = useState<number | null>(null);
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = useId();

  // Close when the route changes (state adjusted during render, not in an effect).
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(null);
  }

  useEffect(() => {
    if (open === null) return;
    const onDown = (e: PointerEvent) => {
      if (!navRef.current?.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        buttons.current[open]?.focus();
        setOpen(null);
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const isCurrent = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <nav ref={navRef} aria-label="Main">
      <ul className="flex items-stretch">
        {NAV_GROUPS.map((group, i) => {
          const active = group.links.some((l) => isCurrent(l.href));
          const panelId = `${baseId}-${i}`;
          return (
            <li key={group.label} className="relative">
              <button
                ref={(el) => {
                  buttons.current[i] = el;
                }}
                type="button"
                aria-expanded={open === i}
                aria-controls={panelId}
                onClick={() => setOpen(open === i ? null : i)}
                className={cn(
                  "inline-flex h-12 items-center gap-1.5 border-b-[3px] px-4 text-[0.95rem] font-semibold text-navy hover:bg-black/5",
                  open === i ? "border-primary bg-black/5" : active ? "border-primary" : "border-transparent",
                )}
              >
                {group.label}
                <ChevronDown aria-hidden className={cn("size-4 transition-transform", open === i && "rotate-180")} strokeWidth={2.5} />
              </button>
              <ul
                id={panelId}
                hidden={open !== i}
                className="absolute top-full left-0 z-50 min-w-60 rounded-b-lg border border-t-0 border-line bg-surface py-2 shadow-lg"
              >
                {group.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      aria-current={pathname === l.href ? "page" : undefined}
                      onClick={() => setOpen(null)}
                      className="flex min-h-11 items-center px-4 text-[0.95rem] text-navy hover:bg-primary-soft aria-[current=page]:font-semibold aria-[current=page]:text-primary-hover"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
