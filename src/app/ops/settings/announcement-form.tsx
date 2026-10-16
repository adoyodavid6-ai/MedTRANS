"use client";

import { useActionState } from "react";
import { FormStatus } from "@/components/forms/form-status";
import { Button } from "@/components/ui/button";
import { describedBy, Field, Input } from "@/components/ui/field";
import type { FormState } from "@/lib/forms";
import { saveAnnouncement } from "./actions";

export function AnnouncementForm({ enabled, message, href }: { enabled: boolean; message: string; href: string }) {
  const [state, action, pending] = useActionState(saveAnnouncement, {} as FormState);
  const fe = state.fieldErrors ?? {};
  const v = state.values;
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormStatus state={state} />
      <label className="flex min-h-11 items-center gap-3">
        <input type="checkbox" name="enabled" defaultChecked={v ? v.enabled === "on" : enabled} className="size-5 accent-[var(--color-primary)]" />
        Show the announcement strip
      </label>
      <Field id="message" label="Message" hint="Service updates only. No unverified claims about hours, delivery times or coverage." error={fe.message}>
        <Input id="message" name="message" defaultValue={v?.message ?? message} maxLength={200} aria-invalid={Boolean(fe.message)} aria-describedby={describedBy("message", { hint: true, error: fe.message })} />
      </Field>
      <Field id="href" label="Link (optional)" hint="A MedTRANS page, e.g. /coverage" error={fe.href}>
        <Input id="href" name="href" defaultValue={v?.href ?? href} aria-invalid={Boolean(fe.href)} aria-describedby={describedBy("href", { hint: true, error: fe.href })} />
      </Field>
      <Button type="submit" disabled={pending}>Save announcement</Button>
    </form>
  );
}
