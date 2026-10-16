import type { Metadata } from "next";
import Link from "next/link";
import { Store } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge, VerificationBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { createAnonClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Find a pharmacy",
  description: "Licensed pharmacies on MedTRANS, with their verification status.",
  alternates: { canonical: "/pharmacies" },
};
export const revalidate = 300;

type Row = { id: string; name: string; slug: string; address_line: string; verification_status: "verified" | "pending" | "suspended" | "unverified"; can_sell: boolean };

export default async function PharmaciesPage() {
  let rows: Row[] = [];
  let failed = false;
  try {
    const { data, error } = await createAnonClient().rpc("pharmacy_directory");
    if (error) failed = true;
    rows = (data ?? []) as Row[];
  } catch {
    failed = true;
  }
  return (
    <>
      <PageHeader title="Find a pharmacy" intro="Every pharmacy shows its real verification status. Only verified pharmacies with a checked licence can take orders." />
      <div className="container-page max-w-4xl py-8">
        {failed ? <p className="text-urgent">The directory couldn&apos;t load. Please try again.</p> : null}
        {!failed && rows.length === 0 ? <EmptyState icon={Store} title="No pharmacies are listed yet">Pharmacies appear here once they register and are reviewed.</EmptyState> : null}
        <ul className="space-y-3">
          {rows.map((p) => (
            <li key={p.id}>
              <Card className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
                <div>
                  <Link href={`/pharmacies/${p.slug}`} className="text-lg font-semibold text-navy underline-offset-2 hover:underline">{p.name}</Link>
                  <p className="text-sm text-muted">{p.address_line}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <VerificationBadge status={p.verification_status} />
                  {p.can_sell ? <Badge tone="primary">Taking orders</Badge> : <Badge>Not taking orders</Badge>}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
