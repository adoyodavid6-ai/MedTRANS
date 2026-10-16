import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TrackView } from "@/components/analytics/track-view";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { requireAccount } from "@/lib/auth/session";
import { formatMoney } from "@/lib/money";
import { loadCartContext, type Quote } from "@/lib/pharmacy/cart";
import { createClient } from "@/lib/supabase/server";
import { CheckoutForm } from "./checkout-form";

export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: false } };

type Address = { id: string; label: string; line1: string; area: string | null; landmark: string | null; location: unknown; is_default: boolean };

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ address?: string; for?: string }> }) {
  await requireAccount("/checkout");
  const sp = await searchParams;
  const { quote: base, covering } = await loadCartContext();
  if (base.empty) redirect("/cart");
  if (base.needs_prescription && !covering) redirect("/cart");

  const supabase = await createClient();
  const [{ data: addrs }, { data: household }] = await Promise.all([
    supabase.from("addresses").select("id, label, line1, area, landmark, location, is_default").order("is_default", { ascending: false }),
    supabase.from("household_members").select("id, full_name"),
  ]);
  const addresses = (addrs ?? []) as Address[];
  const pinned = addresses.filter((a) => a.location);
  const chosen = pinned.find((a) => a.id === sp.address) ?? pinned[0];
  const forMember = (household ?? []).find((h) => h.id === sp.for);

  // The quote for the chosen address, from the same rules place_order() applies.
  const { data } = await supabase.rpc("quote_cart", { p_address: chosen?.id ?? null });
  const quote = (data ?? base) as Quote;
  const cur = quote.currency ?? "KES";
  const issues = quote.issues ?? [];
  const row = (label: string, minor: number | null | undefined) => (
    <div className="flex justify-between py-1.5"><dt>{label}</dt><dd className="tabular-nums">{minor === null || minor === undefined ? "—" : formatMoney(minor, cur)}</dd></div>
  );

  return (
    <div className="container-page max-w-3xl space-y-6 py-10">
      <TrackView event="checkout_started" path="/checkout" />
      <h1 className="text-3xl font-bold">Checkout</h1>

      <Card className="space-y-3">
        <h2 className="text-xl font-semibold">Deliver to</h2>
        {pinned.length === 0 ? (
          <Alert tone="warning" title="Add a pinned delivery address">
            <p>We need a map pin to confirm the pharmacy delivers to you. <Link href="/account/addresses" className="font-semibold underline">Add an address</Link> and use &ldquo;pin my current location&rdquo; while you are there.</p>
          </Alert>
        ) : (
          <form className="space-y-2">
            <fieldset className="space-y-2">
              <legend className="sr-only">Delivery address</legend>
              {pinned.map((a) => (
                <label key={a.id} className="flex min-h-11 items-start gap-3 rounded-xl border border-line p-3 has-[:checked]:border-primary">
                  <input type="radio" name="address" value={a.id} defaultChecked={a.id === chosen?.id} className="mt-1 size-4 accent-[var(--color-primary)]" />
                  <span><strong>{a.label}</strong><span className="block text-sm text-muted">{[a.line1, a.area, a.landmark && `near ${a.landmark}`].filter(Boolean).join(", ")}</span></span>
                </label>
              ))}
            </fieldset>
            {(household ?? []).length > 0 ? (
              <label className="block text-sm">
                <span className="font-semibold text-navy">Who is this for?</span>
                <select name="for" defaultValue={forMember?.id ?? ""} className="mt-1 block min-h-11 w-full rounded-xl border border-line bg-surface px-3">
                  <option value="">Me</option>
                  {(household ?? []).map((h) => <option key={h.id} value={h.id}>{h.full_name}</option>)}
                </select>
              </label>
            ) : null}
            <button className="min-h-11 text-sm font-semibold text-primary underline">Update delivery details</button>
          </form>
        )}
        {addresses.length > pinned.length ? <p className="text-sm text-muted">Addresses without a map pin can&apos;t be used for delivery yet.</p> : null}
      </Card>

      <Card>
        <h2 className="text-xl font-semibold">Order summary</h2>
        <p className="text-sm text-muted">From {quote.pharmacy?.name}</p>
        <ul className="mt-3 space-y-1 text-[0.95rem]">
          {(quote.lines ?? []).map((l) => (
            <li key={l.inventory_id} className="flex justify-between gap-3"><span>{l.quantity} × {l.name}</span><span className="tabular-nums">{formatMoney(l.line_total_minor, cur)}</span></li>
          ))}
        </ul>
        <dl className="mt-4 border-t border-line pt-3 text-[0.95rem]">
          {row("Items", quote.subtotal_minor)}
          {row("Delivery", quote.delivery_fee_minor)}
          {row("Service fee", quote.service_fee_minor)}
          {row("VAT", quote.tax_minor)}
          <div className="flex justify-between border-t border-line pt-2 text-lg font-semibold"><dt>Total</dt><dd className="tabular-nums">{quote.total_minor != null ? formatMoney(quote.total_minor, cur) : "—"}</dd></div>
        </dl>
        {covering ? <p className="mt-3 text-sm text-muted">Includes prescription items approved by the pharmacist.</p> : null}
      </Card>

      {issues.map((i) => <Alert key={i} tone="warning" title={i} />)}

      {chosen && issues.length === 0 && quote.total_minor != null ? (
        <CheckoutForm
          idempotencyKey={randomUUID()}
          addressId={chosen.id}
          prescriptionId={covering?.id ?? null}
          householdMemberId={forMember?.id ?? null}
          totalLabel={formatMoney(quote.total_minor, cur)}
        />
      ) : null}
      <p className="text-sm text-muted">
        Prices and stock are checked again on our servers when you place the order. See <Link href="/legal/cancellation-and-refunds" className="underline">cancellations and refunds</Link>.
      </p>
    </div>
  );
}
