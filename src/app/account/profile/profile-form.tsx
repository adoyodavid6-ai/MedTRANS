"use client";

import { useActionState } from "react";
import { FormStatus } from "@/components/forms/form-status";
import { Button } from "@/components/ui/button";
import { describedBy, Field, Input, Select } from "@/components/ui/field";
import type { FormState } from "@/lib/forms";
import { updateProfile } from "./actions";

export function ProfileForm({ fullName, language }: { fullName: string; language: string }) {
  const [state, action, pending] = useActionState(updateProfile, {} as FormState);
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};
  return (
    <form action={action} className="space-y-5" noValidate>
      <FormStatus state={state} />
      <Field id="full_name" label="Full name" error={fe.full_name}>
        <Input id="full_name" name="full_name" defaultValue={v.full_name ?? fullName} autoComplete="name" maxLength={120} aria-invalid={Boolean(fe.full_name)} aria-describedby={describedBy("full_name", { error: fe.full_name })} />
      </Field>
      <Field id="preferred_language" label="Preferred language" hint="Kiswahili and Somali will be added once translations are professionally reviewed.">
        <Select key={v.preferred_language ?? language} id="preferred_language" name="preferred_language" defaultValue={v.preferred_language ?? language} aria-describedby="preferred_language-hint">
          <option value="en">English</option>
          <option value="sw" disabled>Kiswahili (coming later)</option>
          <option value="so" disabled>Somali (coming later)</option>
        </Select>
      </Field>
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save profile"}</Button>
    </form>
  );
}
