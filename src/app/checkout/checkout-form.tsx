"use client";

import { useActionState } from "react";
import { FormStatus } from "@/components/forms/form-status";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/forms";
import { placeOrder } from "./actions";

export function CheckoutForm({ idempotencyKey, addressId, prescriptionId, householdMemberId, totalLabel }: {
  idempotencyKey: string; addressId: string; prescriptionId: string | null; householdMemberId: string | null; totalLabel: string;
}) {
  const [state, action, pending] = useActionState(placeOrder, {} as FormState);
  return (
    <form action={action} className="space-y-3">
      <FormStatus state={state} />
      <input type="hidden" name="idempotency_key" value={idempotencyKey} />
      <input type="hidden" name="address_id" value={addressId} />
      {prescriptionId ? <input type="hidden" name="prescription_id" value={prescriptionId} /> : null}
      {householdMemberId ? <input type="hidden" name="household_member_id" value={householdMemberId} /> : null}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Placing order…" : `Place order · ${totalLabel}`}
      </Button>
      <p className="text-center text-sm text-muted">You&apos;ll pay on the next screen. Stock is held for 30 minutes.</p>
    </form>
  );
}
