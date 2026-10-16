"use client";

import { useActionState } from "react";
import { FormStatus } from "@/components/forms/form-status";
import { Button } from "@/components/ui/button";
import { describedBy, Field, Input } from "@/components/ui/field";
import type { FormState } from "@/lib/forms";
import { cancelOrder } from "./actions";

export function CancelForm({ orderId, paid }: { orderId: string; paid: boolean }) {
  const [state, action, pending] = useActionState(cancelOrder, {} as FormState);
  const fe = state.fieldErrors ?? {};
  if (state.ok) return <FormStatus state={state} />;
  return (
    <details className="rounded-xl border border-line p-4">
      <summary className="cursor-pointer font-semibold text-navy">Cancel this order</summary>
      <form action={action} className="mt-3 space-y-3">
        <FormStatus state={state} />
        <input type="hidden" name="order_id" value={orderId} />
        <Field id="cancel-reason" label="Reason" error={fe.reason}>
          <Input id="cancel-reason" name="reason" maxLength={300} aria-invalid={Boolean(fe.reason)} aria-describedby={describedBy("cancel-reason", { error: fe.reason })} />
        </Field>
        <p className="text-sm text-muted">{paid ? "You'll be refunded in full." : "You haven't been charged."}</p>
        <Button type="submit" variant="secondary" disabled={pending}>Cancel order</Button>
      </form>
    </details>
  );
}
