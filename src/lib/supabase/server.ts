import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { supabaseEnv } from "@/lib/env";

/** Per-request client acting as the signed-in user. RLS applies. */
export async function createClient() {
  const { url, anonKey } = supabaseEnv();
  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, where cookies are read-only. The proxy refreshes sessions.
        }
      },
    },
  });
}

/**
 * Anonymous client with no cookies, for public data (active coverage, verified
 * emergency contacts, public settings). Safe to use on statically rendered pages.
 */
export function createAnonClient() {
  const { url, anonKey } = supabaseEnv();
  return createPlainClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
