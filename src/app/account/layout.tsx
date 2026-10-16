import type { Metadata } from "next";
import { AreaShell } from "@/components/account/area-shell";
import { requireAccount } from "@/lib/auth/session";

export const metadata: Metadata = { title: "My account", robots: { index: false, follow: false } };

const NAV = [
  { href: "/account", label: "Overview" },
  { href: "/account/orders", label: "Orders" },
  { href: "/account/prescriptions", label: "Prescriptions" },
  { href: "/account/bookings", label: "Home visits" },
  { href: "/account/profile", label: "Profile" },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/account/household", label: "Household" },
  { href: "/account/privacy", label: "Privacy & consent" },
];

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAccount("/account");
  return (
    <AreaShell title="My account" roles={user.roles} nav={NAV}>
      {children}
    </AreaShell>
  );
}
