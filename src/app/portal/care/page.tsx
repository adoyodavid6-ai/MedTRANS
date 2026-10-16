import { CalendarDays, ClipboardList, Inbox, MapPinned, Wallet } from "lucide-react";
import { AreaShell } from "@/components/account/area-shell";
import { PortalPlaceholder } from "@/components/account/portal-placeholder";
import { requireAccount } from "@/lib/auth/session";

export const metadata = { title: "Clinician portal" };

export default async function Page() {
  const user = await requireAccount("/portal/care", ["doctor", "nurse"]);
  return (
    <AreaShell title="Clinician portal" roles={user.roles} nav={[{ href: "/portal/care", label: "Overview" }]}>
      <PortalPlaceholder
        intro="Booking requests, availability and visit documentation open with DoctorCare (build phase 3). No patient can book you until your registration has been verified."
        verificationNote="Your professional registration has not been checked yet. Credential submission and verification with the Kenya Medical Practitioners and Dentists Council or the Nursing Council of Kenya open in phase 3."
        sections={[
          { icon: CalendarDays, title: "Availability", body: "Set working hours, breaks, leave and daily caps." },
          { icon: MapPinned, title: "Service area", body: "Choose where you’re willing to travel." },
          { icon: Inbox, title: "Booking requests", body: "Accept or decline requests that match your services." },
          { icon: ClipboardList, title: "Visit documentation", body: "Record observations, care given and follow-up, visible only to the patient and authorised clinicians." },
          { icon: Wallet, title: "Earnings", body: "Visit fees, commissions and settlements." },
        ]}
      />
    </AreaShell>
  );
}
