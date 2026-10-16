import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Alert } from "@/components/ui/alert";
import { VerificationBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { CourierApplyForm } from "./apply-form";

export const metadata: Metadata = {
  title: "Deliver with MedTRANS",
  description: "Apply to deliver medicines for MedTRANS. Every delivery partner is identity-checked before taking any orders.",
  alternates: { canonical: "/join/courier" },
};

type Status = "verified" | "pending" | "suspended" | "unverified";
type CourierProfile = { verification_status: Status; applied_at: string | null };

export default async function JoinCourier() {
  const user = await getSessionUser();
  let profile: CourierProfile | null = null;
  let name: string | undefined;
  if (user) {
    const supabase = await createClient();
    const [{ data }, { data: me }] = await Promise.all([
      supabase.from("courier_profiles").select("verification_status, applied_at").eq("user_id", user.id).maybeSingle(),
      supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    ]);
    profile = (data as CourierProfile | null) ?? null;
    name = me?.full_name ?? undefined;
  }
  const status = profile?.verification_status;
  return (
    <>
      <PageHeader eyebrow="Join MedTRANS" title="Deliver with MedTRANS" intro="Deliver medicines from verified pharmacies to people's homes, in the areas and hours that suit you." />
      <div className="container-page max-w-3xl space-y-6 py-10">
        <Card>
          <h2 className="text-lg font-semibold">How joining works</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-[0.95rem]">
            <li>Apply below with the account and mobile number you&apos;ll use for deliveries.</li>
            <li>MedTRANS checks your national ID (and driving licence for motorbikes and cars) in person, and records how it was checked.</li>
            <li>Once verified, you receive deliveries in your delivery portal. You see only what you need to deliver: never prescriptions or health details.</li>
            <li>At the door, you hand over the parcel only when the customer gives you their 4-digit code.</li>
          </ol>
          <p className="mt-3 text-sm text-muted">Payment terms for delivery partners are agreed with you in writing before you start.</p>
        </Card>
        {!user ? (
          <Alert tone="info" title="Sign in to apply">
            <p><Link href="/sign-in?next=/join/courier" className="font-semibold underline">Sign in or create an account</Link> with the mobile number you&apos;ll use for deliveries.</p>
          </Alert>
        ) : status === "verified" ? (
          <Card className="space-y-3">
            <p className="flex flex-wrap items-center gap-2 text-lg font-semibold">You&apos;re a MedTRANS delivery partner <VerificationBadge status="verified" /></p>
            <ButtonLink href="/portal/courier">Open your delivery portal</ButtonLink>
          </Card>
        ) : status === "pending" ? (
          <Card className="space-y-2">
            <p className="flex flex-wrap items-center gap-2 text-lg font-semibold">Application received <VerificationBadge status="pending" /></p>
            <p className="text-[0.95rem]">Our operations team will contact you to check your ID. You can&apos;t be given deliveries until that is done.</p>
          </Card>
        ) : status === "suspended" ? (
          <Alert tone="warning" title="Your delivery account is paused"><p>Please <Link href="/contact" className="underline">contact us</Link>.</p></Alert>
        ) : (
          <Card><CourierApplyForm defaultName={name} /></Card>
        )}
      </div>
    </>
  );
}
