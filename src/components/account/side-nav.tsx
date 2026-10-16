"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export type SideNavItem = { href: string; label: string; planned?: string };

export function SideNav({ items, label }: { items: SideNavItem[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label}>
      <ul className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center justify-between gap-3 rounded-xl px-3 text-[0.95rem] font-medium whitespace-nowrap",
                  active ? "bg-primary-soft text-primary-hover" : "text-navy hover:bg-primary-soft/60",
                )}
              >
                {item.label}
                {item.planned ? <span className="text-xs font-normal text-muted">{item.planned}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
