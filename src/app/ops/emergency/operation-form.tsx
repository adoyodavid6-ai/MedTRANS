"use client";

import { useActionState } from "react";
import { FormStatus } from "@/components/forms/form-status";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import type { FormState } from "@/lib/forms";
import { setOperation } from "./actions";

export function OperationForm({ staffed, hours, supervisor }: { staffed: boolean; hours: string; supervisor: string }) {
  const [state, action, pending] = useActionState(setOperation, {} as FormState);
  return (
    <form action={action} className="space-y-3">
      <FormStatus state={state} />
      <label className="flex min-h-11 items-center gap-3"><input type="checkbox" name="staffed" defaultChecked={staffed} className="size-5 accent-[var(--color-primary)]" />A staffed, supervised MedTRANS emergency coordination operation is live</label>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="hours" label="Staffed hours"><Input id="hours" name="hours" defaultValue={hours} placeholder="e.g. 24/7, or 07:00–23:00 EAT" /></Field>
        <Field id="supervisor" label="Responsible supervisor"><Input id="supervisor" name="supervisor" defaultValue={supervisor} /></Field>
      </div>
      <label className="flex min-h-11 items-start gap-3"><input type="checkbox" name="confirm" value="yes" className="mt-1 size-4 accent-[var(--color-primary)]" /><span>I confirm responders are trained, on shift, and an escalation and outage procedure is in place.</span></label>
      <Button type="submit" disabled={pending}>Save</Button>
    </form>
  );
}
