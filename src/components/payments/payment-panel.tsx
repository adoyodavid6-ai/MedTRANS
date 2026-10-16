"use client";

import { useActionState } from "react";
import { FormStatus } from "@/components/forms/form-status";
import { Button } from "@/components/ui/button";
import { describedBy, Field, Input } from "@/components/ui/field";
import type { FormState } from "@/lib/forms";

/** Pay for an order or a booking. The server action decides the amount; this form never sends one. */
export function PaymentPanel({ action, hidden, idempotencyKey, methods, totalLabel }: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  hidden: Record<string, string>;
  idempotencyKey: string;
  methods: { provider: string; label: string; needsPhone: boolean }[];
  totalLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {} as FormState);
  const fe = state.fieldErrors ?? {};
  return (
    <div className="space-y-4">
      <FormStatus state={state} />
      {methods.map((m) => (
        <form key={m.provider} action={formAction} className="space-y-3 rounded-xl border border-line p-4">
          {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
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
