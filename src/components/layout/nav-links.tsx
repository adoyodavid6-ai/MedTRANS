"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import type { PublicHref } from "@/lib/site/routes";

const LINKS: { href: PublicHref; label: string }[] = [
  { href: "/pharmacy", label: "Pharmacy" },
  { href: "/doctorcare", label: "DoctorCare" },
  { href: "/find-a-doctor", label: "Find a Doctor" },
  { href: "/resources", label: "Resources" },
  { href: "/help", label: "Help" },
];

/** Desktop links in the floating header, separated by thin rules. */
export function NavLinks() {
  const pathname = usePathname();
  return (
    <ul className="flex items-center">
      {LINKS.map((l, i) => {
        const current = pathname === l.href || pathname.startsWith(`${l.href}/`);
        return (
          <li key={l.href} className={cn("flex items-center", i > 0 && "before:mx-0.5 before:h-4 before:w-px before:bg-white/20")}>
            <Link
              href={l.href}
              aria-current={current ? "page" : undefined}
              className="inline-flex h-11 items-center rounded px-2.5 text-[0.9rem] font-medium whitespace-nowrap text-white/90 hover:text-white aria-[current=page]:text-white aria-[current=page]:underline aria-[current=page]:underline-offset-8"
            >
              {l.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
