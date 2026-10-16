import { PackageCheck, Route, TriangleAlert } from "lucide-react";
import { AreaShell } from "@/components/account/area-shell";
import { PortalPlaceholder } from "@/components/account/portal-placeholder";
import { requireAccount } from "@/lib/auth/session";

export const metadata = { title: "Delivery portal" };

export default async function Page() {
  const user = await requireAccount("/portal/courier", ["courier"]);
  return (
    <AreaShell title="Delivery portal" roles={user.roles} nav={[{ href: "/portal/courier", label: "Overview" }]}>
      <PortalPlaceholder
        intro="Assignments, pickup and drop-off confirmation open with pharmacy delivery (build phase 2). Delivery partners never see prescriptions or clinical records."
        verificationNote="Your identity has not been verified yet. Delivery-partner onboarding opens in phase 2."
        sections={[
          { icon: Route, title: "Assignments", body: "Pickups and drop-offs assigned to you." },
          { icon: PackageCheck, title: "Proof of delivery", body: "Confirm safe handover." },
          { icon: TriangleAlert, title: "Incidents", body: "Report problems during a delivery." },
        ]}
      />
    </AreaShell>
  );
}
