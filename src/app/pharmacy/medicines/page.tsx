import type { Metadata } from "next";
import Link from "next/link";
import { PackageSearch, Search } from "lucide-react";
import { TrackView } from "@/components/analytics/track-view";
import { RxBadge } from "@/components/pharmacy/rx-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/field";
import { formatMoney } from "@/lib/money";
import { createAnonClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Find a medicine",
  description: "Search medicines available from verified pharmacies.",
  alternates: { canonical: "/pharmacy/medicines" },
};

type Row = {
  id: string; slug: string; name: string; generic_name: string; brand: string | null; strength: string; dosage_form: string;
  pack_size: string; requires_prescription: boolean; is_controlled: boolean; sellable_offers: number; min_price_minor: number | null; currency: string | null;
};

export default async function MedicinesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").trim().slice(0, 80);
  const { data, error } = await createAnonClient().rpc("search_medicines", { q: q || null, max_rows: 60 });
  const rows = (data ?? []) as Row[];
  const rx = rows.filter((r) => r.requires_prescription);
  const otc = rows.filter((r) => !r.requires_prescription);

  return (
    <div className="container-page py-8 sm:py-10">
      {q ? <TrackView event="pharmacy_search" path="/pharmacy/medicines" /> : null}
      <h1 className="text-3xl font-medium">Find a medicine</h1>
      <form role="search" className="mt-4 flex max-w-xl gap-2">
        <label htmlFor="q" className="sr-only">Search medicines</label>
        <Input id="q" name="q" defaultValue={q} placeholder="Name, generic name or brand" />
        <Button type="submit"><Search aria-hidden className="size-4" />Search</Button>
      </form>
      <p className="mt-3 text-sm text-muted">
        Similar names, strengths and forms are not interchangeable. If you are unsure which medicine you need, ask a pharmacist or your doctor.
      </p>
      {error ? <p className="mt-6 text-urgent">Search is unavailable right now. Please try again.</p> : null}
      {!error && rows.length === 0 ? (
        <div className="mt-6"><EmptyState icon={PackageSearch} title={q ? `No medicines match “${q}”` : "No medicines are listed yet"}>Try the generic name, or check the spelling.</EmptyState></div>
      ) : null}
      {[{ title: "Over the counter", items: otc }, { title: "Prescription only", items: rx }].map((group) =>
        group.items.length ? (
          <section key={group.title} aria-labelledby={`h-${group.title}`} className="mt-8">
            <h2 id={`h-${group.title}`} className="text-xl font-semibold">{group.title}</h2>
            {group.title === "Prescription only" ? (
              <p className="mt-1 text-sm text-muted">You will need to upload a prescription, which a pharmacist reviews before you pay.</p>
            ) : null}
            <ul className="mt-3 grid gap-3 md:grid-cols-2">
              {group.items.map((m) => (
                <li key={m.id}>
                  <Card className="h-full p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <Link href={`/pharmacy/medicines/${m.slug}`} className="text-lg font-semibold text-navy underline-offset-2 hover:underline">{m.name}</Link>
                      <RxBadge rx={m.requires_prescription} controlled={m.is_controlled} />
                    </div>
                    <p className="mt-1 text-sm text-muted">{m.generic_name}{m.brand ? ` · ${m.brand}` : ""} · {m.strength} · {m.dosage_form} · {m.pack_size}</p>
                    <p className="mt-3 text-[0.95rem]">
                      {m.is_controlled
                        ? "Controlled medicine: not available through MedTRANS."
                        : m.sellable_offers > 0 && m.min_price_minor !== null
                          ? <>From <strong>{formatMoney(m.min_price_minor, m.currency ?? "KES")}</strong> at {m.sellable_offers} verified {m.sellable_offers === 1 ? "pharmacy" : "pharmacies"}</>
                          : "Not currently available from a verified pharmacy."}
                    </p>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        ) : null,
      )}
    </div>
  );
}
