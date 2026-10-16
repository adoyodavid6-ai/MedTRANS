import Link from "next/link";
import { Card } from "@/components/ui/card";
import { requireAccount } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function AccountOverview() {
  const user = await requireAccount("/account");
  const supabase = await createClient();
  const [{ data: profile }, { count: addressCount }, { count: householdCount }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase.from("addresses").select("id", { count: "exact", head: true }),
    supabase.from("household_members").select("id", { count: "exact", head: true }),
  ]);

  return (
    <>
      <Card>
        <h2 className="text-xl font-semibold">{profile?.full_name ? `Hello, ${profile.full_name}` : "Hello"}</h2>
        <p className="mt-1 text-muted">Signed in as {user.phone ?? user.email}</p>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-background p-4">
            <dt className="text-sm text-muted">Saved addresses</dt>
            <dd className="mt-1 text-2xl font-semibold text-navy">{addressCount ?? 0}</dd>
            <Link href="/account/addresses" className="mt-1 inline-flex min-h-9 items-center text-sm font-semibold text-primary">Manage addresses</Link>
          </div>
          <div className="rounded-xl bg-background p-4">
            <dt className="text-sm text-muted">Household members</dt>
            <dd className="mt-1 text-2xl font-semibold text-navy">{householdCount ?? 0}</dd>
            <Link href="/account/household" className="mt-1 inline-flex min-h-9 items-center text-sm font-semibold text-primary">Manage household</Link>
          </div>
        </dl>
      </Card>
      <nav aria-label="Quick links" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: "/account/orders", label: "Medicine orders" },
          { href: "/account/bookings", label: "Home visits" },
          { href: "/account/prescriptions", label: "Prescriptions" },
          { href: "/account/support", label: "Support" },
        ].map((l) => (
          <Link key={l.href} href={l.href} className="flex min-h-14 items-center rounded-[var(--radius-card)] border border-line bg-surface px-4 font-semibold text-navy hover:border-primary">{l.label}</Link>
        ))}
      </nav>
      <p className="text-sm text-muted">Payment receipts and refund status are shown on each order and home visit.</p>
    </>
  );
}
