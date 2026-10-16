import Link from "next/link";
import { CalendarClock, FileText, Package, Receipt, Bell, LifeBuoy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAccount } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const UPCOMING = [
  { icon: Package, title: "Orders", body: "Your medicine orders and delivery tracking will appear here when MedTRANS Pharmacy opens." },
  { icon: FileText, title: "Prescriptions", body: "Prescriptions you upload, and the pharmacist's decision on each, will appear here." },
  { icon: CalendarClock, title: "Bookings & visit summaries", body: "Home-visit requests, their status, and visit summaries will appear here when DoctorCare opens." },
  { icon: Receipt, title: "Payments", body: "Receipts and refund status will appear here." },
  { icon: Bell, title: "Notifications", body: "Updates about your orders and visits will appear here." },
  { icon: LifeBuoy, title: "Support", body: "Your support requests and replies will appear here." },
];

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
      <section aria-labelledby="upcoming-heading" className="space-y-3">
        <h2 id="upcoming-heading" className="text-lg font-semibold">Coming as services open</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {UPCOMING.map((u) => (
            <EmptyState key={u.title} icon={u.icon} title={u.title}>
              {u.body}
            </EmptyState>
          ))}
        </div>
      </section>
    </>
  );
}
