"use client";

import { useActionState } from "react";
import { FormStatus } from "@/components/forms/form-status";
import { Button } from "@/components/ui/button";
import { describedBy, Field, Input } from "@/components/ui/field";
import type { FormState } from "@/lib/forms";
import { courierAction } from "./actions";

export function AssignmentActions({ orderId, status, locked }: { orderId: string; status: string; locked: boolean }) {
  const [state, action, pending] = useActionState(courierAction, {} as FormState);
  const fe = state.fieldErrors ?? {};
  const codeId = `code-${orderId}`;
  return (
    <div className="space-y-3">
      <FormStatus state={state} />
      {status === "assigned_to_courier" ? (
        <form action={action}><input type="hidden" name="order_id" value={orderId} /><input type="hidden" name="op" value="pickup" />
          <Button type="submit" disabled={pending}>I&apos;ve collected it from the pharmacy</Button></form>
      ) : null}
      {status === "out_for_delivery" && !locked ? (
        <form action={action} className="space-y-2">
          <input type="hidden" name="order_id" value={orderId} /><input type="hidden" name="op" value="deliver" />
          <Field id={codeId} label="Recipient's handover code" error={fe.code}>
            <Input id={codeId} name="code" inputMode="numeric" maxLength={4} autoComplete="off" className="w-32 font-mono text-xl tracking-[0.3em]"
              aria-invalid={Boolean(fe.code)} aria-describedby={describedBy(codeId, { error: fe.code })} />
          </Field>
          <Button type="submit" disabled={pending}>Confirm delivery</Button>
        </form>
      ) : null}
      {status === "out_for_delivery" ? (
        <details className="rounded-xl border border-line px-3 py-2">
          <summary className="cursor-pointer text-sm font-semibold text-urgent">Couldn&apos;t deliver</summary>
          <form action={action} className="mt-2 space-y-2">
            <input type="hidden" name="order_id" value={orderId} /><input type="hidden" name="op" value="fail" />
            <Field id={`reason-${orderId}`} label="What happened?" error={fe.reason}><Input id={`reason-${orderId}`} name="reason" maxLength={300} /></Field>
            <Button type="submit" variant="secondary" disabled={pending}>Report failed delivery</Button>
          </form>
        </details>
      ) : null}
    </div>
  );
}
