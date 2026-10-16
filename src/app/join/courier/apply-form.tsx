"use client";

import { useActionState } from "react";
import { FormStatus } from "@/components/forms/form-status";
import { Button } from "@/components/ui/button";
import { describedBy, Field, Input, Select } from "@/components/ui/field";
import { VEHICLES } from "@/lib/courier/vehicles";
import type { FormState } from "@/lib/forms";
import { applyAsCourier } from "./actions";

export function CourierApplyForm({ defaultName }: { defaultName?: string }) {
  const [state, action, pending] = useActionState(applyAsCourier, {} as FormState);
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};
  const err = (id: string, hint = false) => ({ "aria-invalid": Boolean(fe[id]), "aria-describedby": describedBy(id, { hint, error: fe[id] }) });
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormStatus state={state} />
      <Field id="full_name" label="Full name (as on your national ID)" error={fe.full_name}>
        <Input id="full_name" name="full_name" autoComplete="name" defaultValue={v.full_name ?? defaultName} maxLength={120} {...err("full_name")} />
      </Field>
      <Field id="vehicle_type" label="How will you deliver?" error={fe.vehicle_type}>
        <Select key={v.vehicle_type ?? ""} id="vehicle_type" name="vehicle_type" defaultValue={v.vehicle_type ?? ""} {...err("vehicle_type")}>
          <option value="" disabled>Choose…</option>
          {Object.entries(VEHICLES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </Select>
      </Field>
      <Field id="driving_licence_number" label="Driving licence number (motorbike or car only)" error={fe.driving_licence_number} hint="We check this, and your national ID, in person before you can take deliveries.">
        <Input id="driving_licence_number" name="driving_licence_number" defaultValue={v.driving_licence_number} maxLength={40} {...err("driving_licence_number", true)} />
      </Field>
      <Field id="operating_area" label="Area you can cover" error={fe.operating_area} hint="For example: Westlands and Parklands.">
        <Input id="operating_area" name="operating_area" defaultValue={v.operating_area} maxLength={120} {...err("operating_area", true)} />
      </Field>
      <div>
        <label className="flex min-h-11 items-start gap-3"><input type="checkbox" name="accuracy" className="mt-1 size-5 accent-[var(--color-primary)]" /><span>These details are accurate, and I agree to MedTRANS checking them.</span></label>
        {fe.accuracy ? <p className="ml-8 text-sm text-urgent">{fe.accuracy}</p> : null}
      </div>
      <Button type="submit" disabled={pending}>{pending ? "Sending…" : "Apply to deliver"}</Button>
    </form>
  );
}
