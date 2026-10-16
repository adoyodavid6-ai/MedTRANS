"use client";

import { useRef } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { MAIN_NAV } from "@/lib/site/routes";
import { AccountLinks } from "./account-links";
import { LocationSelector } from "./location-selector";

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
        <div className="space-y-5 p-4">
          <LocationSelector className="w-full max-w-none" />
          <nav aria-label="Main">
            <ul className="space-y-1">
              {MAIN_NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={close}
                    className="flex min-h-12 items-center rounded-xl px-3 font-medium text-navy hover:bg-primary-soft"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div onClick={close}>
            <AccountLinks stacked />
          </div>
        </div>
      </dialog>
    </>
  );
}
