"use client";

import { useActionState } from "react";
import { FormStatus } from "@/components/forms/form-status";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import type { FormState } from "@/lib/forms";
import { listProduct, moveOrder, reviewPrescription, updateStock } from "./actions";

export function ReviewForm({ id, items, defaultValidUntil }: { id: string; items: { product_id: string; name: string; requested: number }[]; defaultValidUntil: string }) {
  const [state, action, pending] = useActionState(reviewPrescription, {} as FormState);
  if (state.ok) return <FormStatus state={state} />;
  return (
    <form action={action} className="space-y-4">
      <FormStatus state={state} />
      <input type="hidden" name="prescription_id" value={id} />
      <fieldset className="space-y-2">
        <legend className="font-semibold text-navy">Quantities you approve</legend>
        {items.map((i) => (
          <label key={i.product_id} className="flex flex-wrap items-center gap-3">
            <span className="min-w-48">{i.name} (requested {i.requested})</span>
            <select name={`approve:${i.product_id}`} defaultValue={i.requested} className="min-h-11 rounded-xl border border-line bg-surface px-2">
              {Array.from({ length: i.requested + 1 }, (_, n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        ))}
      </fieldset>
      <Field id="valid_until" label="Approval valid until" hint="Only needed when approving.">
        <Input id="valid_until" name="valid_until" type="date" defaultValue={defaultValidUntil} className="sm:max-w-xs" aria-describedby="valid_until-hint" />
      </Field>
      <Field id="note" label="Note to the patient" hint="Required when asking a question or not approving.">
        <Textarea id="note" name="note" rows={2} maxLength={1000} aria-describedby="note-hint" />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="decision" value="approved" disabled={pending}>Approve</Button>
        <Button type="submit" name="decision" value="clarification_needed" variant="secondary" disabled={pending}>Ask a question</Button>
        <Button type="submit" name="decision" value="rejected" variant="ghost" className="text-urgent" disabled={pending}>Don&apos;t approve</Button>
      </div>
    </form>
  );
}

const NEXT: Record<string, { to: string; label: string } | undefined> = {
  awaiting_pharmacy_acceptance: { to: "confirmed", label: "Accept order" },
  confirmed: { to: "preparing", label: "Start preparing" },
  preparing: { to: "ready_for_dispatch", label: "Ready for dispatch" },
};

export function OrderActions({ orderId, status }: { orderId: string; status: string }) {
  const [state, action, pending] = useActionState(moveOrder, {} as FormState);
  const next = NEXT[status];
  const canDecline = ["awaiting_pharmacy_acceptance", "confirmed", "preparing", "ready_for_dispatch"].includes(status);
  return (
    <div className="space-y-2">
      <FormStatus state={state} />
      <div className="flex flex-wrap items-start gap-2">
        {next ? (
          <form action={action}><input type="hidden" name="order_id" value={orderId} /><input type="hidden" name="to" value={next.to} /><Button type="submit" disabled={pending}>{next.label}</Button></form>
        ) : null}
        {canDecline ? (
          <details className="rounded-xl border border-line px-3 py-2">
            <summary className="cursor-pointer text-sm font-semibold text-urgent">Can&apos;t fulfil</summary>
            <form action={action} className="mt-2 space-y-2">
              <input type="hidden" name="order_id" value={orderId} /><input type="hidden" name="to" value="refund_processing" />
              <label className="block text-sm">Reason shown to the patient<Input name="note" maxLength={500} /></label>
              <Button type="submit" variant="secondary" disabled={pending}>Decline and refund</Button>
            </form>
          </details>
        ) : null}
      </div>
    </div>
  );
}

export function StockRow({ id, name, price, quantity, listed }: { id: string; name: string; price: number; quantity: number; listed: boolean }) {
  const [state, action, pending] = useActionState(updateStock, {} as FormState);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <label className="text-sm">Price (KES)<Input name="price" type="number" step="0.01" min="0.01" defaultValue={(price / 100).toFixed(2)} className="w-32" aria-label={`Price of ${name}`} /></label>
      <label className="text-sm">In stock<Input name="quantity" type="number" min="0" defaultValue={quantity} className="w-24" aria-label={`Stock of ${name}`} /></label>
      <label className="inline-flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="listed" defaultChecked={listed} className="size-4 accent-[var(--color-primary)]" />Listed</label>
      <Button type="submit" variant="secondary" disabled={pending}>Save</Button>
      <span role="status" className={state.error ? "text-sm text-urgent" : "text-sm text-[#14583a]"}>{state.error ?? state.ok}</span>
    </form>
  );
}

export function ListProductForm({ pharmacyId, products }: { pharmacyId: string; products: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(listProduct, {} as FormState);
  return (
    <form action={action} className="space-y-3">
      <FormStatus state={state} />
      <input type="hidden" name="pharmacy_id" value={pharmacyId} />
      <Field id="product_id" label="Product from the MedTRANS catalogue">
        <Select id="product_id" name="product_id" defaultValue="">
          <option value="" disabled>Choose…</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      </Field>
      <div className="flex flex-wrap gap-3">
        <label className="text-sm">Price (KES)<Input name="price" type="number" step="0.01" min="0.01" className="w-32" /></label>
        <label className="text-sm">In stock<Input name="quantity" type="number" min="0" className="w-24" /></label>
      </div>
      <Button type="submit" disabled={pending}>List product</Button>
    </form>
  );
}
