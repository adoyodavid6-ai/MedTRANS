"use client";

import { useActionState } from "react";
import { FormStatus } from "@/components/forms/form-status";
import { Button } from "@/components/ui/button";
import { describedBy, Field, Input, Select } from "@/components/ui/field";
import { LANGUAGES } from "@/lib/doctorcare/status";
import type { FormState } from "@/lib/forms";
import { applyAsProvider } from "./actions";

export function ApplyForm() {
  const [state, action, pending] = useActionState(applyAsProvider, {} as FormState);
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};
  const text = (id: string, label: string, hint?: string) => (
    <Field id={id} label={label} hint={hint} error={fe[id]}>
      <Input id={id} name={id} defaultValue={v[id]} aria-invalid={Boolean(fe[id])} aria-describedby={describedBy(id, { hint, error: fe[id] })} />
    </Field>
  );
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormStatus state={state} />
      <Field id="profession" label="Profession" error={fe.profession}>
        <Select key={v.profession ?? ""} id="profession" name="profession" defaultValue={v.profession ?? ""}><option value="" disabled>Choose…</option><option value="doctor">Doctor</option><option value="nurse">Nurse</option></Select>
      </Field>
      {text("display_name", "Your name as patients will see it", "e.g. Dr Amina Otieno")}
      <div className="grid gap-4 sm:grid-cols-2">
        {text("regulator", "Regulator", "e.g. KMPDC for doctors, Nursing Council of Kenya for nurses")}
        {text("registration_number", "Registration number")}
      </div>
      {text("years_experience", "Years in practice (optional)")}
      <fieldset>
        <legend className="mb-1 text-sm font-semibold text-navy">Languages you consult in</legend>
        <div className="flex flex-wrap gap-4">
          {Object.entries(LANGUAGES).map(([k, l]) => (
            <label key={k} className="inline-flex min-h-11 items-center gap-2"><input type="checkbox" name="languages" value={k} defaultChecked={k === "en"} className="size-4 accent-[var(--color-primary)]" />{l}</label>
          ))}
        </div>
      </fieldset>
      <div>
        <label className="flex min-h-11 items-start gap-3"><input type="checkbox" name="accuracy" className="mt-1 size-5 accent-[var(--color-primary)]" /><span>These details are accurate. I understand MedTRANS will check my registration with my regulator before I can see any patients.</span></label>
        {fe.accuracy ? <p className="ml-8 text-sm text-urgent">{fe.accuracy}</p> : null}
      </div>
      <Button type="submit" disabled={pending}>Submit for verification</Button>
    </form>
  );
}
