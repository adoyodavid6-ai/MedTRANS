import { AreaShell } from "@/components/account/area-shell";
import { requireAccount } from "@/lib/auth/session";

export const metadata = { title: "Pharmacy portal" };

const NAV = [
  { href: "/portal/pharmacy", label: "Overview" },
  { href: "/portal/pharmacy/prescriptions", label: "Prescriptions" },
  { href: "/portal/pharmacy/orders", label: "Orders" },
  { href: "/portal/pharmacy/inventory", label: "Inventory" },
  { href: "/portal/pharmacy/settlements", label: "Settlements" },
];

export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await requireAccount("/portal/pharmacy", ["pharmacist", "pharmacy_admin"]);
  return <AreaShell title="Pharmacy portal" roles={user.roles} nav={NAV}>{children}</AreaShell>;
}
