"use client";
import { createBrowserClient } from "@supabase/ssr";
import { supabasePublicKey } from "@/lib/env";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabasePublicKey()!,
  );
}
