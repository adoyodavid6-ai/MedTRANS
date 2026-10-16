import { Card } from "@/components/ui/card";
import { requireAccount } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const user = await requireAccount("/account/profile");
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("full_name, preferred_language").eq("id", user.id).single();
  return (
    <Card>
      <h2 className="text-xl font-semibold">Profile</h2>
      <p className="mt-1 mb-5 text-sm text-muted">Sign-in: {user.phone ?? user.email}</p>
      <ProfileForm fullName={data?.full_name ?? ""} language={data?.preferred_language ?? "en"} />
    </Card>
  );
}
