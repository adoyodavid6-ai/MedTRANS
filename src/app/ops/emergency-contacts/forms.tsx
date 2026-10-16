"use client";

import { useActionState, useEffect, useRef } from "react";
import { FormStatus } from "@/components/forms/form-status";
import { Button } from "@/components/ui/button";
import { describedBy, Field, Input, Select, Textarea } from "@/components/ui/field";
import type { FormState } from "@/lib/forms";
import { addContact, changeContact } from "./actions";

export function AddContactForm({ countries }: { countries: { code: string; name: string }[] }) {
  const [state, action, pending] = useActionState(addContact, {} as FormState);
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  const err = (id: string) => ({ "aria-invalid": Boolean(fe[id]), "aria-describedby": describedBy(id, { error: fe[id] }) });
  return (
    <form ref={ref} action={action} className="space-y-4" noValidate>
      <FormStatus state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="country_code" label="Country">
          <Select key={v.country_code ?? ""} id="country_code" name="country_code" defaultValue={v.country_code}>
            {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </Select>
        </Field>
        <Field id="phone_number" label="Number" error={fe.phone_number}>
          <Input id="phone_number" name="phone_number" defaultValue={v.phone_number} inputMode="tel" maxLength={20} {...err("phone_number")} />
        </Field>
      </div>
      <Field id="label" label="Label" error={fe.label}>
        <Input id="label" name="label" defaultValue={v.label} maxLength={80} {...err("label")} />
      </Field>
      <Field id="description" label="Short description (optional)">
        <Input id="description" name="description" defaultValue={v.description} maxLength={280} />
      </Field>
      <Field id="source" label="Verification source" error={fe.source}>
        <Textarea id="source" name="source" defaultValue={v.source} rows={2} maxLength={500} {...err("source")} />
      </Field>
      <div>
        <label className="flex min-h-11 items-start gap-3">
          <input type="checkbox" name="verified" className="mt-1 size-5 accent-[var(--color-primary)]" aria-describedby={fe.verified ? "verified-error" : undefined} />
          <span>I have personally verified this number against the source above, and it works for the whole country.</span>
        </label>
        {fe.verified ? <p id="verified-error" className="ml-8 text-sm font-medium text-urgent">{fe.verified}</p> : null}
      </div>
      <Button type="submit" disabled={pending}>Save verified number</Button>
    </form>
  );
}

export function ContactActions({ id, active }: { id: string; active: boolean }) {
  const [state, action, pending] = useActionState(changeContact, {} as FormState);
  return (
    <form action={action} className="space-y-2">
      <FormStatus state={state} />
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="confirm" value="yes" className="size-4 accent-[var(--color-primary)]" />
          Confirm
        </label>
        <Button type="submit" name="op" value={active ? "unpublish" : "publish"} variant={active ? "ghost" : "primary"} disabled={pending}>
          {active ? "Unpublish" : "Publish"}
        </Button>
        <Button type="submit" name="op" value="delete" variant="ghost" className="text-urgent" disabled={pending}>Delete</Button>
      </div>
    </form>
  );
}
