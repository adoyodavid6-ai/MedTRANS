"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UserRound } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";

/**
 * Sign In / Get Started, or My account when signed in.
 * Client-side so public pages stay static; this only affects which link shows.
 * Access to the account itself is checked on the server.
 */
export function AccountLinks({ stacked = false, variant = "default" }: { stacked?: boolean; variant?: "default" | "pill" }) {
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const [signedIn, setSignedIn] = useState<boolean | null>(configured ? null : false);

  useEffect(() => {
    if (!configured) return;
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setSignedIn(Boolean(session)));
    return () => sub.subscription.unsubscribe();
  }, [configured]);

  if (variant === "pill") {
    return (
      <Link
        href={signedIn ? "/account" : "/sign-in"}
        className="inline-flex h-11 items-center gap-1.5 rounded-md bg-black/35 px-3.5 text-sm font-medium text-white hover:bg-black/60"
      >
        <UserRound aria-hidden className="size-4" />
        {signedIn ? "My account" : "Login"}
      </Link>
    );
  }

  if (signedIn) {
    return (
      <Link href="/account" className={buttonClasses("secondary", "md", stacked ? "w-full" : undefined)}>
        <UserRound aria-hidden className="size-4" />
        My account
      </Link>
    );
  }

  return (
    <div className={cn("flex gap-2", stacked && "flex-col")}>
      <Link href="/sign-in" className={buttonClasses("ghost", "md", stacked ? "w-full" : undefined)}>
        Sign In
      </Link>
      <Link href="/sign-in?mode=start" className={buttonClasses("primary", "md", stacked ? "w-full" : undefined)}>
        Get Started
      </Link>
    </div>
  );
}
