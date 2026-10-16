import { Card } from "@/components/ui/card";
import { requireAccount } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm, ServicesForm } from "../forms";

export default async function ProfilePage() {
  const user = await requireAccount("/portal/care/profile", ["doctor", "nurse"]);
  const supabase = await createClient();
  const [{ data: p }, { data: services }, { data: mine }] = await Promise.all([
    supabase.from("provider_profiles").select("profession, bio, languages, service_radius_m, travel_buffer_minutes, accepts_bookings, base_location, display_name, regulator, registration_number").eq("user_id", user.id).maybeSingle(),
    supabase.from("care_services").select("id, name, required_profession").eq("is_active", true).order("name"),
    supabase.from("provider_services").select("service_id, fee_minor").eq("provider_id", user.id),
  ]);
  if (!p) return <p>No provider profile found. <a href="/join/provider" className="underline">Register here</a>.</p>;
  const fees = new Map((mine ?? []).map((m) => [m.service_id, m.fee_minor as number]));
  return (
    <>
      <Card>
        <h2 className="text-xl font-semibold">{p.display_name}</h2>
        <p className="mb-4 text-sm text-muted">{p.regulator} registration {p.registration_number}. Changing your registration details requires re-verification, so contact MedTRANS operations.</p>
        <ProfileForm p={{ bio: p.bio, languages: p.languages, service_radius_m: p.service_radius_m, travel_buffer_minutes: p.travel_buffer_minutes, accepts_bookings: p.accepts_bookings, has_location: Boolean(p.base_location) }} />
      </Card>
      <Card>
        <h2 className="mb-3 text-lg font-semibold">Services and fees</h2>
        <ServicesForm services={(services ?? []).filter((s) => s.required_profession === p.profession).map((s) => ({ id: s.id, name: s.name, offered: fees.has(s.id), fee_minor: fees.get(s.id) ?? null }))} />
      </Card>
    </>
  );
}
