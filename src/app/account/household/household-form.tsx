"use client";

import { useActionState, useEffect, useRef } from "react";
import { FormStatus } from "@/components/forms/form-status";
import { Button } from "@/components/ui/button";
import { describedBy, Field, Input, Select } from "@/components/ui/field";
import type { FormState } from "@/lib/forms";
import { addHouseholdMember } from "./actions";

export function HouseholdForm({ relationships }: { relationships: Record<string, string> }) {
  const [state, action, pending] = useActionState(addHouseholdMember, {} as FormState);
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="space-y-4" noValidate>
      <FormStatus state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="full_name" label="Their full name" error={fe.full_name}>
          <Input id="full_name" name="full_name" defaultValue={v.full_name} maxLength={120} required aria-invalid={Boolean(fe.full_name)} aria-describedby={describedBy("full_name", { error: fe.full_name })} />
        </Field>
        <Field id="relationship" label="Relationship to you" error={fe.relationship}>
          <Select key={v.relationship ?? ""} id="relationship" name="relationship" defaultValue={v.relationship ?? ""} required aria-invalid={Boolean(fe.relationship)} aria-describedby={describedBy("relationship", { error: fe.relationship })}>
            <option value="" disabled>Choose…</option>
            {Object.entries(relationships).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </Select>
        </Field>
      </div>
      <Field id="date_of_birth" label="Date of birth (optional)" hint="Helps professionals give age-appropriate care." error={fe.date_of_birth}>
        <Input id="date_of_birth" name="date_of_birth" type="date" defaultValue={v.date_of_birth} className="sm:max-w-xs" aria-invalid={Boolean(fe.date_of_birth)} aria-describedby={describedBy("date_of_birth", { hint: true, error: fe.date_of_birth })} />
      </Field>
      <div>
        <label className="flex min-h-11 items-start gap-3">
          <input type="checkbox" name="authority" defaultChecked={v.authority === "on"} required aria-invalid={Boolean(fe.authority)} aria-describedby={fe.authority ? "authority-error" : undefined} className="mt-1 size-5 accent-[var(--color-primary)]" />
          <span>I confirm I am authorised to arrange care for this person (for example as their parent, guardian, or with their permission).</span>
        </label>
        {fe.authority ? <p id="authority-error" className="mt-1 ml-8 text-sm font-medium text-urgent">{fe.authority}</p> : null}
      </div>
      <Button type="submit" disabled={pending}>{pending ? "Adding…" : "Add household member"}</Button>
    </form>
  );
}
