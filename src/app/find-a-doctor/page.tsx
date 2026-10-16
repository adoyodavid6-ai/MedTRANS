import type { Metadata } from "next";
import { Stethoscope } from "lucide-react";
import { ProviderCard, type DirectoryProvider } from "@/components/doctorcare/provider-card";
import { PageHeader } from "@/components/page-header";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { createAnonClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Find a doctor",
  description: "Verified doctors and nurses who visit at home through MedTRANS.",
  alternates: { canonical: "/find-a-doctor" },
};
export const revalidate = 300;

export default async function FindADoctor() {
  let rows: DirectoryProvider[] = [];
  try {
    const { data } = await createAnonClient().rpc("provider_directory");
    rows = (data ?? []) as DirectoryProvider[];
  } catch {}
  return (
    <>
      <PageHeader title="Find a doctor or nurse" intro="Only professionals whose registration MedTRANS has checked are listed. Locations are never shown publicly.">
        <div className="mt-5 flex flex-wrap gap-3">
          <ButtonLink href="/smartcare/map">Who covers my area?</ButtonLink>
          <ButtonLink href="/doctorcare/book" variant="secondary">Request a home visit</ButtonLink>
        </div>
      </PageHeader>
      <div className="container-page max-w-4xl space-y-3 py-8">
        {rows.length === 0 ? <EmptyState icon={Stethoscope} title="No verified professionals are listed yet" /> : rows.map((p) => <ProviderCard key={p.provider_id} p={p} />)}
      </div>
    </>
  );
}
