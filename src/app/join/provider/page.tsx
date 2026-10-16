import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Alert } from "@/components/ui/alert";
import { VerificationBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ApplyForm } from "./apply-form";

export const metadata: Metadata = {
  title: "Join as a doctor or nurse",
  description: "Register to provide home visits through MedTRANS. Every registration is checked with the regulator.",
  alternates: { canonical: "/join/provider" },
};

export default async function JoinProvider() {
  const user = await getSessionUser();
  type Profile = { verification_status: "verified" | "pending" | "suspended" | "unverified"; display_name: string };
  let profile: Profile | null = null;
  if (user) {
    const supabase = await createClient();
    const { data } = await supabase.from("provider_profiles").select("verification_status, display_name").eq("user_id", user.id).maybeSingle();
    profile = (data as Profile | null) ?? null;
  }
  return (
    <>
      <PageHeader eyebrow="Join MedTRANS" title="Provide home visits with MedTRANS" intro="Set your own fees, hours and travel area. Patients see your verified credentials, and every visit is documented securely." />
      <div className="container-page max-w-3xl space-y-6 py-10">
        <Card>
          <h2 className="text-lg font-semibold">How joining works</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-[0.95rem]">
            <li>Submit your registration details below.</li>
            <li>MedTRANS checks your registration with your regulator and records how it was checked.</li>
            <li>Once verified, set your services, fees, hours and travel area in your clinician portal.</li>
            <li>You only receive requests that match your services, area and free time, and you choose whether to accept.</li>
          </ol>
        </Card>
        {!user ? (
          <Alert tone="info" title="Sign in to apply"><p><Link href="/sign-in?next=/join/provider" className="font-semibold underline">Sign in or create an account</Link> with the mobile number you use for work.</p></Alert>
        ) : profile ? (
          <Card className="space-y-3">
            <p className="flex flex-wrap items-center gap-2 text-lg font-semibold">{profile.display_name} <VerificationBadge status={profile.verification_status} /></p>
            {profile.verification_status === "verified" ? (
              <ButtonLink href="/portal/care">Open your clinician portal</ButtonLink>
            ) : (
              <p className="text-[0.95rem]">Your application is with MedTRANS operations. We&apos;ll verify your registration before you can be offered any visits.</p>
            )}
          </Card>
        ) : (
          <Card><ApplyForm /></Card>
        )}
      </div>
    </>
  );
}
