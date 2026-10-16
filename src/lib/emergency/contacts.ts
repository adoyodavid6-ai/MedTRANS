import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { createAnonClient } from "@/lib/supabase/server";

export type EmergencyContact = {
  id: string;
  label: string;
  phone_number: string;
  description: string | null;
  verified_at: string;
};

export type EmergencyContactsResult =
  | { state: "ok"; contacts: EmergencyContact[] }
  | { state: "unavailable" };

/**
 * Verified, active emergency contacts for a country. The database only exposes rows that
 * passed verification (with a recorded source), so anything returned here may be shown.
 */
export async function getVerifiedEmergencyContacts(countryCode: string): Promise<EmergencyContactsResult> {
  if (!isSupabaseConfigured()) return { state: "unavailable" };
  try {
    const { data, error } = await createAnonClient()
      .from("emergency_contacts")
      .select("id, label, phone_number, description, verified_at")
      .eq("country_code", countryCode)
      .eq("is_active", true)
      .is("area_id", null)
      .order("display_order")
      .order("label");
    if (error) return { state: "unavailable" };
    return { state: "ok", contacts: (data ?? []) as EmergencyContact[] };
  } catch {
    return { state: "unavailable" };
  }
}

/** tel: URI from a stored number (digits and leading + only). */
export function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

/** True only while an admin has recorded a staffed operation and at least one responder exists. */
export async function isEmergencyOperationStaffed(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { data } = await createAnonClient().rpc("emergency_operation_staffed");
    return data === true;
  } catch {
    return false;
  }
}
