"use client";

import Link from "next/link";
import { useActionState } from "react";
import { addToCart } from "@/app/cart/actions";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import type { FormState } from "@/lib/forms";

export function AddToCart({ inventoryId, max, returnTo, label }: { inventoryId: string; max: number; returnTo: string; label: string }) {
  const [state, action, pending] = useActionState(addToCart, {} as FormState);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="inventory_id" value={inventoryId} />
      <input type="hidden" name="return_to" value={returnTo} />
      <label className="sr-only" htmlFor={`qty-${inventoryId}`}>Quantity</label>
      <Select id={`qty-${inventoryId}`} name="quantity" defaultValue="1" className="w-20 py-2">
        {Array.from({ length: Math.max(1, Math.min(max, 10)) }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
      </Select>
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add to cart"}<span className="sr-only"> from {label}</span>
      </Button>
      <span role="status" className={state.error ? "w-full text-sm text-urgent" : "text-sm text-[#14583a]"}>
        {state.error ?? (state.ok ? <>{state.ok} <Link href="/cart" className="font-semibold underline">View cart</Link></> : null)}
      </span>
    </form>
  );
}
