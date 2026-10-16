import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth/session";
import { homeFor, safeNextPath } from "@/lib/auth/roles";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; mode?: string }> }) {
  const { next: rawNext, mode } = await searchParams;
  const next = safeNextPath(rawNext);
  const user = await getSessionUser();
  if (user) redirect(next ?? homeFor(user.roles));

  const starting = mode === "start";
  return (
    <div className="container-page flex max-w-md flex-col py-10 sm:py-16">
      <h1 className="text-3xl font-bold">{starting ? "Get started" : "Sign in"}</h1>
      <p className="mt-2 text-muted">
        {starting ? "Create your MedTRANS account with your mobile number or email." : "Welcome back. Sign in with your mobile number or email."}
      </p>
      <Card className="mt-6">
        <SignInForm next={next} />
      </Card>
      <p className="mt-6 text-sm text-muted">
        By continuing you&apos;ll be asked to accept our <Link href="/legal/terms" className="underline">terms</Link> and{" "}
        <Link href="/legal/privacy" className="underline">privacy notice</Link>. Need urgent help?{" "}
        <Link href="/emergency" className="font-semibold text-urgent underline">Emergency Help</Link> works without an account.
      </p>
    </div>
  );
}
