import type { Metadata } from "next";
import { AreaShell } from "@/components/account/area-shell";
import { requireAccount } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Operations", robots: { index: false, follow: false } };

const NAV = [
  { href: "/ops", label: "Overview" },
  { href: "/ops/support", label: "Support tickets" },
  { href: "/ops/users", label: "Users & roles" },
  { href: "/ops/orders", label: "Orders & dispatch" },
  { href: "/ops/pharmacies", label: "Pharmacies" },
  { href: "/ops/catalogue", label: "Catalogue" },
  { href: "/ops/couriers", label: "Delivery partners" },
  { href: "/ops/bookings", label: "Home-visit bookings" },
  { href: "/ops/providers", label: "Doctors & nurses" },
  { href: "/ops/care-services", label: "Home-care services" },
  { href: "/ops/incidents", label: "Safety incidents" },
  { href: "/ops/emergency", label: "Emergency operation" },
  { href: "/ops/coverage", label: "Countries & coverage" },
  { href: "/ops/emergency-contacts", label: "Emergency contacts" },
  { href: "/ops/settings", label: "Settings" },
  { href: "/ops/audit", label: "Audit log" },
];

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAccount("/ops", ["admin", "support"]);
  const nav = user.roles.includes("admin") ? NAV : NAV.slice(0, 2);
  return (
    <AreaShell title="Operations" roles={user.roles} nav={nav}>
      {children}
    </AreaShell>
  );
}
