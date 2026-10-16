import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pill, Store } from "lucide-react";
import { AddToCart } from "@/components/pharmacy/add-to-cart";
import { RxBadge } from "@/components/pharmacy/rx-badge";
import { Alert } from "@/components/ui/alert";
import { Badge, VerificationBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMoney } from "@/lib/money";
import { stockLabel, timeAgo } from "@/lib/pharmacy/status";
import { createAnonClient } from "@/lib/supabase/server";

type Product = {
  id: string; slug: string; name: string; generic_name: string; brand: string | null; strength: string; dosage_form: string; pack_size: string;
  manufacturer: string | null; requires_prescription: boolean; is_controlled: boolean; approved_info: string | null; approved_info_source: string | null;
};
type Offer = {
  inventory_id: string; pharmacy_id: string; pharmacy_name: string; pharmacy_slug: string; verification_status: "verified" | "pending" | "suspended" | "unverified";
  can_sell: boolean; price_minor: number; currency: string; quantity_available: number; stock_confirmed_at: string; delivery_fee_minor: number | null;
};

async function load(slug: string) {
  const db = createAnonClient();
  const { data: product } = await db
    .from("medicine_products")
    .select("id, slug, name, generic_name, brand, strength, dosage_form, pack_size, manufacturer, requires_prescription, is_controlled, approved_info, approved_info_source")
    .eq("slug", slug).maybeSingle();
  if (!product) return null;
  const { data: offers } = await db.rpc("product_offers", { p_product: product.id });
  return { product: product as Product, offers: (offers ?? []) as Offer[] };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const r = await load((await params).slug);
  if (!r) return { title: "Medicine not found" };
  return {
    title: r.product.name,
    description: `${r.product.generic_name} ${r.product.strength} ${r.product.dosage_form}. ${r.product.requires_prescription ? "Prescription only." : "Over the counter."}`,
    alternates: { canonical: `/pharmacy/medicines/${r.product.slug}` },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const r = await load((await params).slug);
  if (!r) notFound();
  const { product: m, offers } = r;
  const path = `/pharmacy/medicines/${m.slug}`;

  return (
    <div className="container-page max-w-4xl py-8 sm:py-10">
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href="/pharmacy" className="underline">Pharmacy</Link> / <Link href="/pharmacy/medicines" className="underline">Medicines</Link> / {m.name}
      </nav>
      <div className="mt-4 flex flex-wrap items-start gap-5">
        <div aria-hidden className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <Pill className="size-9" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-bold">{m.name}</h1>
          <div className="mt-2"><RxBadge rx={m.requires_prescription} controlled={m.is_controlled} /></div>
          <dl className="mt-4 grid gap-x-6 gap-y-1 text-[0.95rem] sm:grid-cols-2">
            <div><dt className="inline text-muted">Generic name: </dt><dd className="inline">{m.generic_name}</dd></div>
            {m.brand ? <div><dt className="inline text-muted">Brand: </dt><dd className="inline">{m.brand}</dd></div> : null}
            <div><dt className="inline text-muted">Strength: </dt><dd className="inline">{m.strength}</dd></div>
            <div><dt className="inline text-muted">Form: </dt><dd className="inline">{m.dosage_form}</dd></div>
            <div><dt className="inline text-muted">Pack: </dt><dd className="inline">{m.pack_size}</dd></div>
            {m.manufacturer ? <div><dt className="inline text-muted">Manufacturer: </dt><dd className="inline">{m.manufacturer}</dd></div> : null}
          </dl>
        </div>
      </div>

      {m.requires_prescription && !m.is_controlled ? (
        <Alert tone="info" title="Prescription needed" className="mt-6">
          <p>After adding this to your cart, upload your prescription. A licensed pharmacist reviews it before you pay. Don&apos;t use this medicine as a substitute for professional advice.</p>
        </Alert>
      ) : null}
      {m.is_controlled ? (
        <Alert tone="warning" title="Not available through MedTRANS" className="mt-6">
          <p>This is a controlled medicine. MedTRANS does not sell controlled medicines. Speak to your doctor or a pharmacy in person.</p>
        </Alert>
      ) : null}

      <section aria-labelledby="info-heading" className="mt-8">
        <h2 id="info-heading" className="text-xl font-semibold">About this medicine</h2>
        {m.approved_info ? (
          <div className="mt-2 space-y-2">
            <p className="whitespace-pre-line text-[0.95rem]">{m.approved_info}</p>
            <p className="text-xs text-muted">Source: {m.approved_info_source}</p>
          </div>
        ) : (
          <p className="mt-2 text-[0.95rem] text-muted">Approved product information has not been added yet. Ask the pharmacist about how to take this medicine.</p>
        )}
      </section>

      {!m.is_controlled ? (
        <section aria-labelledby="offers-heading" className="mt-8">
          <h2 id="offers-heading" className="text-xl font-semibold">Available from</h2>
          {offers.length === 0 ? (
            <div className="mt-3"><EmptyState icon={Store} title="Not available from any listed pharmacy yet" /></div>
          ) : (
            <ul className="mt-3 space-y-3">
              {offers.map((o) => (
                <li key={o.inventory_id}>
                  <Card className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/pharmacies/${o.pharmacy_slug}`} className="font-semibold text-navy underline-offset-2 hover:underline">{o.pharmacy_name}</Link>
                        <VerificationBadge status={o.verification_status} />
                      </div>
                      <p className="mt-1 text-lg font-semibold">{formatMoney(o.price_minor, o.currency)}</p>
                      <p className="text-sm text-muted">
                        <Badge tone={o.quantity_available > 0 ? "primary" : "neutral"}>{stockLabel(o.quantity_available)}</Badge>{" "}
                        Stock confirmed by the pharmacy {timeAgo(o.stock_confirmed_at)}
                        {o.delivery_fee_minor !== null ? ` · Delivery ${formatMoney(o.delivery_fee_minor, o.currency)}` : ""}
                      </p>
                    </div>
                    {o.can_sell && o.quantity_available > 0 ? (
                      <AddToCart inventoryId={o.inventory_id} max={o.quantity_available} returnTo={path} label={o.pharmacy_name} />
                    ) : (
                      <p className="text-sm text-muted">{o.can_sell ? "Out of stock" : "Not taking orders right now"}</p>
                    )}
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
