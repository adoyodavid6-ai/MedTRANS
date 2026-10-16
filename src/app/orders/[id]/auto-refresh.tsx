"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-fetches the server-rendered status while something external (a payment, the pharmacy) is pending. */
export function AutoRefresh({ seconds = 5 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
