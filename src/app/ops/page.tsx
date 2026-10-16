import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { ROLE_LABELS, isRole } from "@/lib/auth/roles";
import { requireAccount } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

type Overview = {
  generated_at: string;
  accounts_total: number;
  accounts_last_7_days: number;
  roles: Record<string, number>;
  countries_active: number;
  areas_active: number;
  areas_total: number;
  emergency_contacts_published: number;
};

export default async function OpsOverview() {
  const user = await requireAccount("/ops", ["admin", "support"]);
  if (!user.roles.includes("admin")) {
    return (
      <Alert tone="info" title="Support">
        <p><Link href="/ops/support" className="font-semibold underline">Open the support ticket queue</Link>.</p>
      </Alert>
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_overview");
  if (error || !data) return <Alert tone="warning" title="Couldn't load the overview. Please refresh." />;
  const o = data as Overview;

  const metrics = [
    { label: "Accounts", value: o.accounts_total, def: "All registered accounts." },
    { label: "New accounts (7 days)", value: o.accounts_last_7_days, def: "Accounts created in the last 7 days." },
    { label: "Active countries", value: o.countries_active, def: "Countries switched on after recorded regulatory review." },
    { label: "Active coverage areas", value: `${o.areas_active} of ${o.areas_total}`, def: "Areas with a boundary that are switched on." },
    { label: "Published emergency numbers", value: o.emergency_contacts_published, def: "Verified, active numbers shown on Emergency Help." },
  ];

  return (
    <>
      <section aria-labelledby="metrics-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="metrics-heading" className="text-xl font-semibold">Overview</h2>
          <p className="text-sm text-muted">
            Live from the database ·{" "}
            {new Intl.DateTimeFormat("en-GB", { timeStyle: "short", dateStyle: "medium", timeZone: "Africa/Nairobi" }).format(new Date(o.generated_at))} EAT
          </p>
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {metrics.map((m) => (
            <Card key={m.label} className="p-4 sm:p-5">
              <dt className="text-sm font-medium text-muted">{m.label}</dt>
              <dd className="mt-1 text-3xl font-semibold text-navy tabular-nums">{m.value}</dd>
              <dd className="mt-1 text-xs text-muted">{m.def}</dd>
            </Card>
          ))}
        </dl>
      </section>
      <Card>
        <h2 className="text-lg font-semibold">Active role grants</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {Object.entries(o.roles).map(([role, n]) => (
            <li key={role} className="flex justify-between rounded-lg bg-background px-3 py-2 text-[0.95rem]">
              <span>{isRole(role) ? ROLE_LABELS[role] : role}</span>
              <span className="font-semibold tabular-nums">{n}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Alert tone="info" title="More metrics arrive with each module">
        <p>Orders, prescriptions, bookings, deliveries and tickets will be added here, from real records, as each module opens.</p>
      </Alert>
    </>
  );
}
