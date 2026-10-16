"use client";

import { useActionState } from "react";
import { FormStatus } from "@/components/forms/form-status";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import type { FormState } from "@/lib/forms";
import { recallProduct, staffReply, updateIncident } from "./support-actions";

export function StaffReplyForm({ ticketId }: { ticketId: string }) {
  const [state, action, pending] = useActionState(staffReply, {} as FormState);
  return (
    <form action={action} className="space-y-3">
      <FormStatus state={state} />
      <input type="hidden" name="ticket_id" value={ticketId} />
      <Field id="staff-body" label="Message" error={state.fieldErrors?.body}><Textarea id="staff-body" name="body" rows={4} maxLength={4000} /></Field>
      <div className="flex flex-wrap items-end gap-3">
        <label className="inline-flex min-h-11 items-center gap-2"><input type="checkbox" name="internal" className="size-4 accent-[var(--color-primary)]" />Internal note (not shown to the customer)</label>
        <label className="text-sm">Then set status<Select name="status" defaultValue="" className="min-w-48"><option value="">Waiting on customer</option><option value="open">Open</option><option value="resolved">Resolved</option><option value="closed">Closed</option></Select></label>
        <Button type="submit" disabled={pending}>Send</Button>
      </div>
    </form>
  );
}

export function IncidentForm({ id, status, severity }: { id: string; status: string; severity: string }) {
  const [state, action, pending] = useActionState(updateIncident, {} as FormState);
  return (
    <form action={action} className="space-y-2">
      <FormStatus state={state} />
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">Status<Select name="status" defaultValue={status} className="min-w-36">{["reported", "investigating", "resolved"].map((s) => <option key={s} value={s}>{s}</option>)}</Select></label>
        <label className="text-sm">Severity<Select name="severity" defaultValue={severity} className="min-w-32">{["low", "moderate", "severe", "critical"].map((s) => <option key={s} value={s}>{s}</option>)}</Select></label>
      </div>
      <label className="block text-sm">Resolution / actions taken<Textarea name="resolution_note" rows={2} /></label>
      <Button type="submit" variant="secondary" disabled={pending}>Save</Button>
    </form>
  );
}

export function RecallForm({ productId }: { productId: string }) {
  const [state, action, pending] = useActionState(recallProduct, {} as FormState);
  if (state.ok) return <FormStatus state={state} />;
  return (
    <details className="rounded-xl border border-line px-3 py-2">
      <summary className="cursor-pointer text-sm font-semibold text-urgent">Recall</summary>
      <form action={action} className="mt-2 space-y-2">
        <FormStatus state={state} />
        <input type="hidden" name="id" value={productId} />
        <Field id={`recall-${productId}`} label="Recall details (batch, reason, source)"><Input id={`recall-${productId}`} name="note" maxLength={1000} /></Field>
        <label className="inline-flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="confirm" value="yes" className="size-4 accent-[var(--color-primary)]" />Remove from sale everywhere now</label>
        <Button type="submit" variant="secondary" disabled={pending}>Recall product</Button>
      </form>
    </details>
  );
}
