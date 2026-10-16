"use client";

import { useActionState } from "react";
import { FormStatus } from "@/components/forms/form-status";
import { Button } from "@/components/ui/button";
import { describedBy, Field, Input } from "@/components/ui/field";
import type { FormState } from "@/lib/forms";
import { cancelBooking } from "./actions";

export function CancelBooking({ bookingId, paid }: { bookingId: string; paid: boolean }) {
  const [state, action, pending] = useActionState(cancelBooking, {} as FormState);
  const fe = state.fieldErrors ?? {};
  if (state.ok) return <FormStatus state={state} />;
  return (
    <details className="rounded-xl border border-line p-4">
      <summary className="cursor-pointer font-semibold text-navy">Cancel this booking</summary>
      <form action={action} className="mt-3 space-y-3">
        <FormStatus state={state} />
        <input type="hidden" name="booking_id" value={bookingId} />
        <Field id="b-reason" label="Reason" error={fe.reason}>
          <Input id="b-reason" name="reason" maxLength={300} aria-invalid={Boolean(fe.reason)} aria-describedby={describedBy("b-reason", { error: fe.reason })} />
        </Field>
        <p className="text-sm text-muted">{paid ? "You'll be refunded in full." : "You haven't been charged."}</p>
        <Button type="submit" variant="secondary" disabled={pending}>Cancel booking</Button>
      </form>
    </details>
  );
}
