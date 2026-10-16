"use client";

import { useActionState } from "react";
import { FormStatus } from "@/components/forms/form-status";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import type { FormState } from "@/lib/forms";
import { requestErasure } from "./actions";

export function ErasureForm() {
  const [state, action, pending] = useActionState(requestErasure, {} as FormState);
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-3">
      <FormStatus state={state} />
      <Field id="reason" label="Anything you'd like us to know? (optional)">
        <Textarea id="reason" name="reason" rows={2} maxLength={1000} />
      </Field>
      <div>
        <label className="flex min-h-11 items-start gap-3"><input type="checkbox" name="confirm" className="mt-1 size-5 accent-[var(--color-primary)]" />
          <span>I understand my account will be closed, and that records the law requires MedTRANS to keep will be retained for their retention period.</span></label>
        {fe.confirm ? <p className="ml-8 text-sm text-urgent">{fe.confirm}</p> : null}
      </div>
      <Button type="submit" variant="secondary" disabled={pending}>Ask us to delete my account</Button>
    </form>
  );
}
