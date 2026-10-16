"use server";

import { isSupabaseConfigured } from "@/lib/env";
import { createAnonClient } from "@/lib/supabase/server";

export type TrackedEvent =
  | "landing_view" | "pharmacy_search" | "product_view" | "add_to_cart" | "checkout_started"
  | "prescription_upload_started" | "doctorcare_service_view" | "booking_started" | "emergency_view" | "coverage_check";

/**
 * Anonymous daily count. No user id, session id, IP, device or clinical content is sent or stored;
 * `path` must be a route template or a public slug, never something identifying a person.
 */
export async function track(event: TrackedEvent, path: string) {
  if (!isSupabaseConfigured()) return;
  try {
    await createAnonClient().rpc("track_event", { p_event: event, p_path: path.slice(0, 120) });
  } catch {
    // Analytics must never break a page or a transaction.
  }
}
