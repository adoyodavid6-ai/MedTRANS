"use client";

import { useActionState } from "react";
import { sendInquiry } from "@/app/contact/actions";
import { FormStatus } from "@/components/forms/form-status";
import { Button } from "@/components/ui/button";
import { describedBy, Field, Input, Select, Textarea } from "@/components/ui/field";
import { CATEGORIES } from "@/lib/support/labels";
import type { FormState } from "@/lib/forms";

export function InquiryForm({ signedIn }: { signedIn: boolean }) {
  const [state, action, pending] = useActionState(sendInquiry, {} as FormState);
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};
  const err = (id: string) => ({ "aria-invalid": Boolean(fe[id]), "aria-describedby": describedBy(id, { error: fe[id] }) });
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormStatus state={state} />
      <Field id="category" label="What is this about?" error={fe.category}>
        <Select key={v.category ?? ""} id="category" name="category" defaultValue={v.category ?? ""} {...err("category")}>
          <option value="" disabled>Choose…</option>
          {Object.entries(CATEGORIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </Select>
      </Field>
      <Field id="subject" label="Subject" error={fe.subject}><Input id="subject" name="subject" defaultValue={v.subject} maxLength={160} {...err("subject")} /></Field>
      <Field id="body" label="Your message" error={fe.body} hint="Please don't include detailed medical information. If it's about an order or visit, give its number.">
        <Textarea id="body" name="body" defaultValue={v.body} rows={5} maxLength={4000} aria-invalid={Boolean(fe.body)} aria-describedby={describedBy("body", { hint: true, error: fe.body })} />
      </Field>
      {!signedIn ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="guest_name" label="Your name"><Input id="guest_name" name="guest_name" defaultValue={v.guest_name} autoComplete="name" /></Field>
          <Field id="guest_contact" label="Email or phone for our reply" error={fe.guest_contact}><Input id="guest_contact" name="guest_contact" defaultValue={v.guest_contact} {...err("guest_contact")} /></Field>
        </div>
      ) : null}
      <Field id="preferred_contact" label="How should we reply?">
        <Select key={v.preferred_contact ?? ""} id="preferred_contact" name="preferred_contact" defaultValue={v.preferred_contact ?? (signedIn ? "in_app" : "email")}>
          {signedIn ? <option value="in_app">In my MedTRANS account</option> : null}
          <option value="email">Email</option>
          <option value="phone">Phone call</option>
        </Select>
      </Field>
      <div>
        <label className="flex min-h-11 items-start gap-3"><input type="checkbox" name="consent" className="mt-1 size-5 accent-[var(--color-primary)]" /><span>I agree to MedTRANS storing this message to reply to me.</span></label>
        {fe.consent ? <p className="ml-8 text-sm text-urgent">{fe.consent}</p> : null}
      </div>
      <Button type="submit" disabled={pending}>{pending ? "Sending…" : "Send message"}</Button>
    </form>
  );
}
