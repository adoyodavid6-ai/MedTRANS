"use client";

import { useActionState } from "react";
import { Upload } from "lucide-react";
import { submitPrescription } from "@/app/account/prescriptions/actions";
import { FormStatus } from "@/components/forms/form-status";
import { Button } from "@/components/ui/button";
import { describedBy, Field, Input, Textarea } from "@/components/ui/field";
import type { FormState } from "@/lib/forms";

export function PrescriptionUpload({ pharmacyId, items }: { pharmacyId: string; items: { product_id: string; quantity: number }[] }) {
  const [state, action, pending] = useActionState(submitPrescription, {} as FormState);
  const fe = state.fieldErrors ?? {};
  if (state.ok) return <FormStatus state={state} />;
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormStatus state={state} />
      <input type="hidden" name="pharmacy_id" value={pharmacyId} />
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      <Field id="rx-file" label="Photo or PDF of your prescription" hint="JPG, PNG, WebP or PDF, up to 10 MB. Make sure the whole page is readable." error={fe.file}>
        <Input id="rx-file" name="file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" capture="environment" required
          aria-invalid={Boolean(fe.file)} aria-describedby={describedBy("rx-file", { hint: true, error: fe.file })} className="py-2" />
      </Field>
      <Field id="rx-note" label="Note for the pharmacist (optional)">
        <Textarea id="rx-note" name="note" maxLength={500} rows={2} />
      </Field>
      <div>
        <label className="flex min-h-11 items-start gap-3">
          <input type="checkbox" name="consent" className="mt-1 size-5 accent-[var(--color-primary)]" aria-describedby={fe.consent ? "consent-error" : undefined} />
          <span>I consent to MedTRANS storing this prescription securely and sharing it with the pharmacist at this pharmacy, only to review and fulfil my order.</span>
        </label>
        {fe.consent ? <p id="consent-error" className="ml-8 text-sm font-medium text-urgent">{fe.consent}</p> : null}
      </div>
      <Button type="submit" disabled={pending}>
        <Upload aria-hidden className="size-4" />
        {pending ? "Uploading…" : "Send to pharmacist"}
      </Button>
    </form>
  );
}
