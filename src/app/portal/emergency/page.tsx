import { Siren, Timer } from "lucide-react";
import { AreaShell } from "@/components/account/area-shell";
import { PortalPlaceholder } from "@/components/account/portal-placeholder";
import { requireAccount } from "@/lib/auth/session";

export const metadata = { title: "Emergency operations" };

export default async function Page() {
  const user = await requireAccount("/portal/emergency", ["emergency_responder"]);
  return (
    <AreaShell title="Emergency operations" roles={user.roles} nav={[{ href: "/portal/emergency", label: "Overview" }]}>
      <PortalPlaceholder
        intro="MedTRANS does not currently run a staffed emergency operation, so there is no request queue. This portal will only be activated if a staffed, authorised operation is set up (decided in build phase 4)."
        verificationNote="Responder accounts require verification and an authorised, staffed operation before any request can be routed to them."
        sections={[
          { icon: Siren, title: "Request queue", body: "Only with a staffed, authorised operation." },
          { icon: Timer, title: "Acknowledgement tracking", body: "Time-to-acknowledge and missed-request alerts." },
        ]}
      />
    </AreaShell>
  );
}
