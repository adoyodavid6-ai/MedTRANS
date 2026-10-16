"use client";

import { useActionState } from "react";
import { FormStatus } from "@/components/forms/form-status";
import { Button } from "@/components/ui/button";
import { describedBy, Field, Input } from "@/components/ui/field";
import type { FormState } from "@/lib/forms";
import { startPayment } from "./actions";

export function PaymentPanel({ orderId, idempotencyKey, methods, totalLabel }: {
  orderId: string; idempotencyKey: string; methods: { provider: string; label: string; needsPhone: boolean }[]; totalLabel: string;
}) {
  const [state, action, pending] = useActionState(startPayment, {} as FormState);
  const fe = state.fieldErrors ?? {};
  return (
    <div className="space-y-4">
      <FormStatus state={state} />
      {methods.map((m) => (
        <form key={m.provider} action={action} className="space-y-3 rounded-xl border border-line p-4">
          <input type="hidden" name="order_id" value={orderId} />
          <input type="hidden" name="provider" value={m.provider} />
          <input type="hidden" name="idempotency_key" value={idempotencyKey} />
          <p className="font-semibold text-navy">{m.label}</p>
          {m.needsPhone ? (
            <Field id={`phone-${m.provider}`} label="M-Pesa number" error={fe.phone}>
              <Input id={`phone-${m.provider}`} name="phone" inputMode="tel" autoComplete="tel" defaultValue={state.values?.phone}
                aria-invalid={Boolean(fe.phone)} aria-describedby={describedBy(`phone-${m.provider}`, { error: fe.phone })} />
            </Field>
          ) : null}
          <Button type="submit" disabled={pending} className="w-full sm:w-auto">{pending ? "Sending…" : `Pay ${totalLabel}`}</Button>
        </form>
      ))}
    </div>
  );
}
