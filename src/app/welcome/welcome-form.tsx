"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { completeWelcome, type WelcomeState } from "./actions";

export function WelcomeForm({ next }: { next: string | null }) {
  const [state, action, pending] = useActionState(completeWelcome, {} as WelcomeState);
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};
  return (
    <form action={action} className="space-y-5" noValidate>
      {state.error ? <Alert tone="warning" role="alert" title={state.error} /> : null}
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Field id="full_name" label="Your name (optional)" hint="Used so professionals know who they're helping.">
        <Input id="full_name" name="full_name" defaultValue={v.full_name} autoComplete="name" maxLength={120} aria-describedby="full_name-hint" />
      </Field>
      <Field id="preferred_language" label="Preferred language">
        <Select id="preferred_language" name="preferred_language" defaultValue="en">
          <option value="en">English</option>
          <option value="sw" disabled>Kiswahili (coming later)</option>
          <option value="so" disabled>Somali (coming later)</option>
        </Select>
      </Field>
      <fieldset className="space-y-3">
        <legend className="mb-1 text-sm font-semibold text-navy">Before you continue</legend>
        <Check name="accept_terms" checked={v.accept_terms === "on"} error={fe.accept_terms}>
          I accept the <Link href="/legal/terms" target="_blank" className="text-primary underline">terms of service</Link>.
        </Check>
        <Check name="accept_privacy" checked={v.accept_privacy === "on"} error={fe.accept_privacy}>
          I have read the <Link href="/legal/privacy" target="_blank" className="text-primary underline">privacy notice</Link>.
        </Check>
      </fieldset>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Continue"}
      </Button>
    </form>
  );
}

function Check({ name, checked, error, children }: { name: string; checked: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="flex min-h-11 items-start gap-3">
        <input
          type="checkbox"
          name={name}
          defaultChecked={checked}
          required
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${name}-error` : undefined}
          className="mt-1 size-5 accent-[var(--color-primary)]"
        />
        <span>{children}</span>
      </label>
      {error ? (
        <p id={`${name}-error`} className="mt-1 ml-8 text-sm font-medium text-urgent">
          {error}
        </p>
      ) : null}
    </div>
  );
}
