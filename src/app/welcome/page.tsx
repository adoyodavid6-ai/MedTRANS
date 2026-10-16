import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { homeFor, safeNextPath } from "@/lib/auth/roles";
import { requireUser } from "@/lib/auth/session";
import { hasAcceptedRequiredPolicies } from "@/lib/consent/server";
import { WelcomeForm } from "./welcome-form";

export const metadata: Metadata = { title: "Welcome", robots: { index: false, follow: false } };

export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNextPath((await searchParams).next);
  const user = await requireUser("/welcome");
  if (await hasAcceptedRequiredPolicies()) redirect(next ?? homeFor(user.roles));

  return (
    <div className="container-page max-w-md py-10 sm:py-16">
      <h1 className="text-3xl font-bold">Welcome to MedTRANS</h1>
      <p className="mt-2 text-muted">A couple of things before you start.</p>
      <Card className="mt-6">
        <WelcomeForm next={next} />
      </Card>
    </div>
  );
}
