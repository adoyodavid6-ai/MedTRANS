"use client";

import { useActionState } from "react";
import { reportIncident } from "@/lib/safety/actions";
import { FormStatus } from "@/components/forms/form-status";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/field";
import type { FormState } from "@/lib/forms";

const KINDS: Record<string, string> = {
  adverse_reaction: "A reaction or side effect",
  dispensing_error: "Wrong medicine, strength or quantity",
  suspected_counterfeit: "Medicine looks fake or tampered with",
  expired_or_damaged: "Expired or damaged medicine",
  delivery_incident: "A problem with the delivery",
  clinical_incident: "A problem during a home visit",
  safeguarding: "Someone may be at risk of harm",
  privacy: "My information was mishandled",
  other: "Something else",
};

/** Report a safety concern about an order or visit. Routed to MedTRANS operations, not to the public. */
export function ReportIncident({ orderId, bookingId, title = "Report a safety concern" }: { orderId?: string; bookingId?: string; title?: string }) {
  const [state, action, pending] = useActionState(reportIncident, {} as FormState);
  if (state.ok) return <FormStatus state={state} />;
  return (
    <details className="rounded-xl border border-line p-4">
      <summary className="cursor-pointer font-semibold text-navy">{title}</summary>
      <form action={action} className="mt-3 space-y-3">
        <FormStatus state={state} />
        <p className="text-sm text-muted">If someone is seriously unwell now, contact local emergency services first. <a href="/emergency" className="font-semibold text-urgent underline">Emergency Help</a></p>
        {orderId ? <input type="hidden" name="order_id" value={orderId} /> : null}
        {bookingId ? <input type="hidden" name="booking_id" value={bookingId} /> : null}
        <Field id={`kind-${orderId ?? bookingId}`} label="What happened?">
          <Select id={`kind-${orderId ?? bookingId}`} name="kind" defaultValue="">
            <option value="" disabled>Choose…</option>
            {Object.entries(KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Select>
        </Field>
        <Field id={`desc-${orderId ?? bookingId}`} label="Describe it" error={state.fieldErrors?.description}><Textarea id={`desc-${orderId ?? bookingId}`} name="description" rows={3} maxLength={4000} /></Field>
        <Button type="submit" variant="secondary" disabled={pending}>Send report</Button>
      </form>
    </details>
  );
}
