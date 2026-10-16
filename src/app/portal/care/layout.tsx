import { AreaShell } from "@/components/account/area-shell";
import { requireAccount } from "@/lib/auth/session";

export const metadata = { title: "Clinician portal" };

const NAV = [
  { href: "/portal/care", label: "Requests" },
  { href: "/portal/care/visits", label: "Visits" },
  { href: "/portal/care/profile", label: "Profile, services & fees" },
  { href: "/portal/care/availability", label: "Availability" },
];

export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await requireAccount("/portal/care", ["doctor", "nurse"]);
  return <AreaShell title="Clinician portal" roles={user.roles} nav={NAV}>{children}</AreaShell>;
}
