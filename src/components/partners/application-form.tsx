"use client";

import { useActionState } from "react";
import { submitApplication } from "@/app/join/actions";
import { FormStatus } from "@/components/forms/form-status";
import { Button } from "@/components/ui/button";
import { describedBy, Field, Input, Textarea } from "@/components/ui/field";
import type { FormState } from "@/lib/forms";

export function PartnerApplicationForm({ kind }: { kind: "pharmacy" | "organisation" }) {
  const [state, action, pending] = useActionState(submitApplication, {} as FormState);
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};
  const err = (id: string, hint = false) => ({ "aria-invalid": Boolean(fe[id]), "aria-describedby": describedBy(id, { hint, error: fe[id] }) });
  if (state.ok) return <FormStatus state={state} />;
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormStatus state={state} />
      <input type="hidden" name="kind" value={kind} />
      <Field id="organisation_name" label={kind === "pharmacy" ? "Pharmacy name (as licensed)" : "Organisation name"} error={fe.organisation_name}>
        <Input id="organisation_name" name="organisation_name" defaultValue={v.organisation_name} maxLength={160} {...err("organisation_name")} />
      </Field>
      {kind === "pharmacy" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="licence_number" label="PPB premises licence number" error={fe.licence_number} hint="We check this with the Pharmacy and Poisons Board before listing.">
            <Input id="licence_number" name="licence_number" defaultValue={v.licence_number} maxLength={80} {...err("licence_number", true)} />
          </Field>
          <Field id="town" label="Town or area"><Input id="town" name="town" defaultValue={v.town} maxLength={120} /></Field>
        </div>
      ) : (
        <Field id="organisation_type" label="Type of organisation" hint="For example: employer, insurer, school, NGO, clinic.">
          <Input id="organisation_type" name="organisation_type" defaultValue={v.organisation_type} maxLength={80} aria-describedby={describedBy("organisation_type", { hint: true })} />
        </Field>
      )}
      <Field id="contact_name" label="Contact person" error={fe.contact_name}>
        <Input id="contact_name" name="contact_name" defaultValue={v.contact_name} autoComplete="name" maxLength={120} {...err("contact_name")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="contact_phone" label="Phone" error={fe.contact_phone}><Input id="contact_phone" name="contact_phone" type="tel" autoComplete="tel" defaultValue={v.contact_phone} {...err("contact_phone")} /></Field>
        <Field id="contact_email" label="Email" error={fe.contact_email}><Input id="contact_email" name="contact_email" type="email" autoComplete="email" defaultValue={v.contact_email} {...err("contact_email")} /></Field>
      </div>
      <Field id="message" label="Anything else we should know? (optional)">
        <Textarea id="message" name="message" rows={4} maxLength={2000} defaultValue={v.message} />
      </Field>
      <div>
        <label className="flex min-h-11 items-start gap-3"><input type="checkbox" name="consent" className="mt-1 size-5 accent-[var(--color-primary)]" /><span>I agree to MedTRANS storing these details to review this application and contact me.</span></label>
        {fe.consent ? <p className="ml-8 text-sm text-urgent">{fe.consent}</p> : null}
      </div>
      <Button type="submit" disabled={pending}>{pending ? "Sending…" : "Send application"}</Button>
    </form>
  );
}
