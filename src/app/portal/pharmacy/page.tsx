import { FileCheck2, Package, ShoppingBag, Wallet } from "lucide-react";
import { AreaShell } from "@/components/account/area-shell";
import { PortalPlaceholder } from "@/components/account/portal-placeholder";
import { requireAccount } from "@/lib/auth/session";

export const metadata = { title: "Pharmacy portal" };

export default async function Page() {
  const user = await requireAccount("/portal/pharmacy", ["pharmacist", "pharmacy_admin"]);
  return (
    <AreaShell title="Pharmacy portal" roles={user.roles} nav={[{ href: "/portal/pharmacy", label: "Overview" }]}>
      <PortalPlaceholder
        intro="Catalogue, inventory, prescription review and order management open with MedTRANS Pharmacy (build phase 2). No regulated order can reach your pharmacy until its licence has been verified."
        verificationNote="Your pharmacy licence has not been checked yet. Licence submission and verification with the Pharmacy and Poisons Board open in phase 2."
        sections={[
          { icon: Package, title: "Catalogue & inventory", body: "Products, verified prices and live stock." },
          { icon: FileCheck2, title: "Prescription review", body: "Approve, query or decline prescriptions, with notes and an audit trail." },
          { icon: ShoppingBag, title: "Orders", body: "Accept, prepare and hand over orders for delivery." },
          { icon: Wallet, title: "Settlements", body: "Payouts, commissions and refunds." },
        ]}
      />
    </AreaShell>
  );
}
