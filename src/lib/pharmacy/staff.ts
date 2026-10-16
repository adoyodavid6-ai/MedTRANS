import "server-only";
import { createClient } from "@/lib/supabase/server";

export type StaffMembership = {
  pharmacy_id: string;
  staff_role: "pharmacist" | "manager" | "dispatcher";
  registration_status: "verified" | "pending" | "suspended" | "unverified";
  pharmacies: { id: string; name: string; slug: string; verification_status: "verified" | "pending" | "suspended" | "unverified" };
};

export async function myPharmacyMemberships(): Promise<StaffMembership[]> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data } = await supabase
    .from("pharmacy_staff")
    .select("pharmacy_id, staff_role, registration_status, pharmacies(id, name, slug, verification_status)")
    .eq("user_id", auth.user?.id ?? "")
    .eq("is_active", true);
  return (data ?? []) as unknown as StaffMembership[];
}

export function isVerifiedPharmacist(ms: StaffMembership[], pharmacyId: string) {
  return ms.some((m) => m.pharmacy_id === pharmacyId && m.staff_role === "pharmacist" && m.registration_status === "verified" && m.pharmacies.verification_status === "verified");
}
