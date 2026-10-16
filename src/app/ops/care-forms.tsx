"use client";

import { useActionState } from "react";
import { FormStatus } from "@/components/forms/form-status";
import { Button } from "@/components/ui/button";
import { describedBy, Field, Input, Select, Textarea } from "@/components/ui/field";
import type { FormState } from "@/lib/forms";
import { bookingOpsAction, createService, reviewScreening, setProviderStatus } from "./care-actions";

const Confirm = () => <label className="inline-flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="confirm" value="yes" className="size-4 accent-[var(--color-primary)]" />I confirm</label>;

export function ProviderStatusForm({ providerId, status }: { providerId: string; status: string }) {
  const [state, action, pending] = useActionState(setProviderStatus, {} as FormState);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <FormStatus state={state} />
      <input type="hidden" name="provider_id" value={providerId} />
      <label className="text-sm">Status<Select name="status" defaultValue={status} className="min-w-36">{["pending", "verified", "suspended", "unverified"].map((s) => <option key={s} value={s}>{s}</option>)}</Select></label>
      <label className="text-sm">How the registration was checked<Input name="check_method" className="w-72" placeholder="e.g. KMPDC online register, 18 Oct 2026" /></label>
      <Confirm />
      <Button type="submit" variant="secondary" disabled={pending}>Save</Button>
    </form>
  );
}

export function BookingOpsForm({ bookingId, status }: { bookingId: string; status: string }) {
  const [state, action, pending] = useActionState(bookingOpsAction, {} as FormState);
  return (
    <div className="space-y-2">
      <FormStatus state={state} />
      <div className="flex flex-wrap items-end gap-2">
        {status === "refund_processing" ? (
          <form action={action} className="flex flex-wrap items-end gap-2"><input type="hidden" name="booking_id" value={bookingId} /><input type="hidden" name="op" value="refunded" />
            <label className="text-sm">Provider refund reference<Input name="reference" className="w-56" /></label><Button type="submit" disabled={pending}>Mark refunded</Button></form>
        ) : null}
        {["confirmed", "en_route", "arrived", "in_progress"].includes(status) ? (
          <form action={action} className="flex flex-wrap items-end gap-2"><input type="hidden" name="booking_id" value={bookingId} /><input type="hidden" name="op" value="failed" />
            <label className="text-sm">Reason<Input name="note" className="w-56" /></label><Button type="submit" variant="ghost" className="text-urgent" disabled={pending}>Mark failed</Button></form>
        ) : null}
        {status === "failed" ? (
          <form action={action} className="flex flex-wrap items-end gap-2"><input type="hidden" name="booking_id" value={bookingId} /><input type="hidden" name="op" value="refund_processing" />
            <label className="text-sm">Reason<Input name="note" className="w-56" /></label><Button type="submit" variant="secondary" disabled={pending}>Start refund</Button></form>
        ) : null}
        {["awaiting_acceptance", "awaiting_payment"].includes(status) ? (
          <form action={action} className="flex flex-wrap items-end gap-2"><input type="hidden" name="booking_id" value={bookingId} /><input type="hidden" name="op" value="cancelled" />
            <label className="text-sm">Reason<Input name="note" className="w-56" /></label><Button type="submit" variant="ghost" disabled={pending}>Cancel</Button></form>
        ) : null}
      </div>
    </div>
  );
}

export function ServiceForm() {
  const [state, action, pending] = useActionState(createService, {} as FormState);
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};
  const f = (id: string, label: string, textarea = false, type?: string) => (
    <Field id={id} label={label} error={fe[id]}>
      {textarea ? <Textarea id={id} name={id} defaultValue={v[id]} rows={2} /> : <Input id={id} name={id} type={type} defaultValue={v[id]} aria-invalid={Boolean(fe[id])} aria-describedby={describedBy(id, { error: fe[id] })} />}
    </Field>
  );
  return (
    <form action={action} className="space-y-3" noValidate>
      <FormStatus state={state} />
      <div className="grid gap-3 sm:grid-cols-2">{f("name", "Service name")}{f("duration_minutes", "Typical duration (minutes)", false, "number")}</div>
      {f("summary", "One-line summary")}
      {f("description", "Description", true)}
      <Field id="required_profession" label="Provided by" error={fe.required_profession}>
        <Select key={v.required_profession ?? ""} id="required_profession" name="required_profession" defaultValue={v.required_profession ?? ""}><option value="" disabled>Choose…</option><option value="doctor">Doctor</option><option value="nurse">Nurse</option></Select>
      </Field>
      {f("eligibility_notes", "Eligibility (who it is and isn't for)", true)}
      {f("escalation_notes", "Escalation (when to stop and refer)", true)}
      <Button type="submit" disabled={pending}>Add service (inactive)</Button>
    </form>
  );
}

export function ScreeningReviewForm() {
  const [state, action, pending] = useActionState(reviewScreening, {} as FormState);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <FormStatus state={state} />
      <label className="text-sm">Reviewed by (named clinician or governance body)<Input name="reviewer" className="w-80" /></label>
      <Confirm />
      <Button type="submit" variant="secondary" disabled={pending}>Record clinical review</Button>
    </form>
  );
}
