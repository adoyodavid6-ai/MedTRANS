import type { Metadata } from "next";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { PrescriptionUpload } from "@/components/pharmacy/prescription-upload";
import { RxBadge } from "@/components/pharmacy/rx-badge";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAccount } from "@/lib/auth/session";
import { formatMoney } from "@/lib/money";
import { PRESCRIPTION_STATUS } from "@/lib/pharmacy/status";
import { loadCartContext } from "@/lib/pharmacy/cart";
import { emptyCart, setCartQuantity } from "./actions";

export const metadata: Metadata = { title: "Your cart", robots: { index: false, follow: false } };

export default async function CartPage() {
  await requireAccount("/cart");
  const { quote, rxs, covering } = await loadCartContext();

  if (quote.empty) {
    return (
      <div className="container-page max-w-3xl py-10">
        <h1 className="text-3xl font-bold">Your cart</h1>
        <div className="mt-6">
          <EmptyState icon={ShoppingCart} title="Your cart is empty" action={<ButtonLink href="/pharmacy/medicines">Find a medicine</ButtonLink>} />
        </div>
      </div>
    );
  }

  const cur = quote.currency ?? "KES";
  const rxLines = (quote.lines ?? []).filter((l) => l.requires_prescription);
  const pending = rxs.find((r) => r.status === "submitted");
  const question = rxs.find((r) => r.status === "clarification_needed");
  const canCheckout = (quote.issues ?? []).length === 0 && (!quote.needs_prescription || Boolean(covering));

  return (
    <div className="container-page max-w-3xl space-y-6 py-10">
      <div>
        <h1 className="text-3xl font-bold">Your cart</h1>
        <p className="mt-1 text-muted">From <Link href={`/pharmacies/${quote.pharmacy!.slug}`} className="font-semibold text-navy underline">{quote.pharmacy!.name}</Link></p>
      </div>

      {(quote.issues ?? []).map((i) => <Alert key={i} tone="warning" title={i} />)}

      <Card className="p-0 sm:p-0">
        <ul className="divide-y divide-line">
          {(quote.lines ?? []).map((l) => (
            <li key={l.inventory_id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <Link href={`/pharmacy/medicines/${l.slug}`} className="font-semibold text-navy underline-offset-2 hover:underline">{l.name}</Link>
                <p className="text-sm text-muted">{l.strength} · {l.pack_size} · {formatMoney(l.unit_price_minor, cur)} each</p>
                <div className="mt-1"><RxBadge rx={l.requires_prescription} /></div>
              </div>
              <div className="flex items-center gap-2">
                <form action={setCartQuantity} className="flex items-center gap-1">
                  <input type="hidden" name="inventory_id" value={l.inventory_id} />
                  <label htmlFor={`q-${l.inventory_id}`} className="sr-only">Quantity of {l.name}</label>
                  <select id={`q-${l.inventory_id}`} name="quantity" defaultValue={l.quantity} className="min-h-11 rounded-xl border border-line bg-surface px-2">
                    {Array.from({ length: 21 }, (_, n) => <option key={n} value={n}>{n === 0 ? "Remove" : n}</option>)}
                  </select>
                  <button className="min-h-11 rounded-lg px-2 text-sm font-semibold text-primary hover:bg-primary-soft">Update</button>
                </form>
                <span className="w-24 text-right font-semibold tabular-nums">{formatMoney(l.line_total_minor, cur)}</span>
              </div>
            </li>
          ))}
        </ul>
        <div className="flex justify-between border-t border-line p-4 font-semibold">
          <span>Items</span><span className="tabular-nums">{formatMoney(quote.subtotal_minor ?? 0, cur)}</span>
        </div>
      </Card>

      {quote.needs_prescription ? (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">Prescription</h2>
            {covering ? <Badge tone="success">Approved</Badge> : pending ? <Badge tone="warning">Waiting for review</Badge> : <Badge tone="urgent">Needed</Badge>}
          </div>
          {covering ? (
            <p className="text-[0.95rem]">A pharmacist approved your prescription for these items, valid until {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(covering.valid_until!))}.</p>
          ) : pending ? (
            <Alert tone="info" title={PRESCRIPTION_STATUS.submitted.label}>
              <p>Sent {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Nairobi" }).format(new Date(pending.created_at))}. You can check out once a pharmacist approves it. This page updates when you reload it.</p>
            </Alert>
          ) : (
            <>
              {question ? (
                <Alert tone="urgent" title="The pharmacist has a question">
                  <p>{question.prescription_reviews.at(-1)?.note_to_patient}</p>
                  <p className="text-sm">Upload a clearer or updated prescription below.</p>
                </Alert>
              ) : null}
              <p className="text-[0.95rem] text-muted">These items need a prescription: {rxLines.map((l) => l.name).join(", ")}. A licensed pharmacist will review it before you pay.</p>
              <PrescriptionUpload pharmacyId={quote.pharmacy!.id} items={rxLines.map((l) => ({ product_id: l.product_id, quantity: l.quantity }))} />
            </>
          )}
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <form action={emptyCart}><button className="min-h-11 text-sm font-semibold text-muted underline">Empty cart</button></form>
        {canCheckout ? <ButtonLink href="/checkout" size="lg">Continue to checkout</ButtonLink> : <span className="text-sm text-muted">Checkout opens once everything above is resolved.</span>}
      </div>
    </div>
  );
}
