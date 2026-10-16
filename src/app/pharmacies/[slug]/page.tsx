import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { RxBadge } from "@/components/pharmacy/rx-badge";
import { Badge, VerificationBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";
import { stockLabel } from "@/lib/pharmacy/status";
import { createAnonClient } from "@/lib/supabase/server";

type Dir = {
  id: string; name: string; slug: string; address_line: string; verification_status: "verified" | "pending" | "suspended" | "unverified";
  can_sell: boolean; verified_hours: string | null; delivery_radius_m: number | null; delivery_fee_minor: number | null; currency: string;
  licence_number: string | null; licence_regulator: string | null; licence_valid_until: string | null; licence_status: "verified" | "pending" | "suspended" | "unverified" | null;
};

async function load(slug: string) {
  const db = createAnonClient();
  const { data } = await db.rpc("pharmacy_directory");
  const p = ((data ?? []) as Dir[]).find((x) => x.slug === slug);
  if (!p) return null;
  const { data: items } = await db
    .from("inventory_items")
    .select("id, price_minor, quantity_available, medicine_products(slug, name, strength, pack_size, requires_prescription, is_controlled)")
    .eq("pharmacy_id", p.id).eq("is_listed", true);
  return { p, items: (items ?? []) as unknown as { id: string; price_minor: number; quantity_available: number; medicine_products: { slug: string; name: string; strength: string; pack_size: string; requires_prescription: boolean; is_controlled: boolean } }[] };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const r = await load((await params).slug);
  return r ? { title: r.p.name, alternates: { canonical: `/pharmacies/${r.p.slug}` } } : { title: "Pharmacy not found" };
}

export default async function PharmacyProfile({ params }: { params: Promise<{ slug: string }> }) {
  const r = await load((await params).slug);
  if (!r) notFound();
  const { p, items } = r;
  const fmtDate = (d: string) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(d));
  return (
    <>
      <PageHeader title={p.name} intro={p.address_line}>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <VerificationBadge status={p.verification_status} />
          {p.can_sell ? <Badge tone="primary">Taking orders</Badge> : <Badge>Not taking orders</Badge>}
        </div>
      </PageHeader>
      <div className="container-page grid max-w-4xl gap-6 py-8">
        <Card>
          <h2 className="text-lg font-semibold">Licence and service</h2>
          <dl className="mt-3 grid gap-2 text-[0.95rem] sm:grid-cols-[12rem_1fr]">
            <dt className="text-muted">Licence</dt>
            <dd>
              {p.licence_number ? (
                <span className="flex flex-wrap items-center gap-2">
                  {p.licence_regulator} · {p.licence_number}
                  {p.licence_status ? <VerificationBadge status={p.licence_status} /> : null}
                  {p.licence_valid_until ? <span className="text-muted">valid until {fmtDate(p.licence_valid_until)}</span> : null}
                </span>
              ) : "No licence on record"}
            </dd>
            <dt className="text-muted">Opening hours</dt>
            <dd>{p.verified_hours ?? "Not confirmed"}</dd>
            <dt className="text-muted">Delivery</dt>
            <dd>{p.delivery_radius_m && p.delivery_fee_minor !== null ? `Within ${(p.delivery_radius_m / 1000).toFixed(1)} km · ${formatMoney(p.delivery_fee_minor, p.currency)}` : "Not configured"}</dd>
          </dl>
        </Card>
        <section aria-labelledby="catalogue-heading">
          <h2 id="catalogue-heading" className="text-xl font-semibold">Catalogue</h2>
          {items.length === 0 ? <p className="mt-2 text-muted">No medicines listed.</p> : (
            <ul className="mt-3 divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface">
              {items.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <Link href={`/pharmacy/medicines/${i.medicine_products.slug}`} className="font-semibold text-navy underline-offset-2 hover:underline">{i.medicine_products.name}</Link>
                    <p className="text-sm text-muted">{i.medicine_products.strength} · {i.medicine_products.pack_size}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <RxBadge rx={i.medicine_products.requires_prescription} controlled={i.medicine_products.is_controlled} />
                    <span className="font-semibold">{formatMoney(i.price_minor, p.currency)}</span>
                    <Badge>{stockLabel(i.quantity_available)}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
