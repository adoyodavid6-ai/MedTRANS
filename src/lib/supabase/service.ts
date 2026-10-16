import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. Bypasses RLS, so it is used ONLY for actions no user may perform:
 * recording payment-provider outcomes after verifying the callback, and disabling sign-in for an
 * account whose erasure an administrator has completed. Never import it into
 * anything a user's request can steer beyond that.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured (server only).");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
