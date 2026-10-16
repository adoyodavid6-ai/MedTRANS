"use client";

import { useRef } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { NAV_GROUPS } from "@/lib/site/routes";
import { AccountLinks } from "./account-links";
import { LocationSelector } from "./location-selector";
import { SiteSearch } from "./site-search";

export function MobileMenu() {
  const ref = useRef<HTMLDialogElement>(null);
  const close = () => ref.current?.close();

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className="inline-flex size-11 items-center justify-center rounded-xl border border-line bg-surface text-navy"
        aria-haspopup="dialog"
      >
        <Menu aria-hidden className="size-5" />
        <span className="sr-only">Open menu</span>
      </button>
      <dialog
        ref={ref}
        aria-label="Menu"
        className="m-0 ml-auto h-dvh max-h-dvh w-[min(22rem,100vw)] border-l border-line bg-surface p-0 text-ink backdrop:bg-navy/40"
      >
        <div className="flex items-center justify-between border-b border-line p-4">
          <span className="font-semibold text-navy">Menu</span>
          <button type="button" onClick={close} className="inline-flex size-11 items-center justify-center rounded-xl hover:bg-primary-soft">
            <X aria-hidden className="size-5" />
            <span className="sr-only">Close menu</span>
          </button>
        </div>
        <div className="space-y-5 overflow-y-auto p-4">
          <LocationSelector className="w-full max-w-none" />
          <SiteSearch id="mobile-search" />
          <nav aria-label="Main" className="space-y-4">
            {NAV_GROUPS.map((group) => (
              <section key={group.label} aria-labelledby={`m-${group.label}`}>
                <h2 id={`m-${group.label}`} className="px-3 pb-1 text-xs font-bold tracking-[0.08em] text-muted uppercase">{group.label}</h2>
                <ul>
                  {group.links.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={close}
                        className="flex min-h-11 items-center rounded-xl px-3 font-medium text-navy hover:bg-primary-soft"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </nav>
          <div onClick={close}>
            <AccountLinks stacked />
          </div>
        </div>
      </dialog>
    </>
  );
}
