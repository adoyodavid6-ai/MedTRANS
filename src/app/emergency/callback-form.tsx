"use client";

import { useActionState, useState } from "react";
import { LocateFixed } from "lucide-react";
import { FormStatus } from "@/components/forms/form-status";
import { Button } from "@/components/ui/button";
import { describedBy, Field, Input, Select } from "@/components/ui/field";
import type { FormState } from "@/lib/forms";
import { requestCallback } from "./actions";

/** Optional. Shown only while a staffed MedTRANS operation exists, and always after the guidance above it. */
export function CallbackForm() {
  const [state, action, pending] = useActionState(requestCallback, {} as FormState);
  const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(null);
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-3">
      <FormStatus state={state} />
      <Field id="er-phone" label="Number to call you on" error={fe.phone}>
        <Input id="er-phone" name="phone" inputMode="tel" autoComplete="tel" defaultValue={state.values?.phone} aria-invalid={Boolean(fe.phone)} aria-describedby={describedBy("er-phone", { error: fe.phone })} />
      </Field>
      <details>
        <summary className="cursor-pointer text-sm font-semibold text-primary">Add details (optional)</summary>
        <div className="mt-3 space-y-3">
          <Field id="er-name" label="Your name"><Input id="er-name" name="name" autoComplete="name" /></Field>
          <Field id="er-nature" label="What's happening?"><Input id="er-nature" name="nature" maxLength={500} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="er-conscious" label="Are they awake?"><Select id="er-conscious" name="conscious" defaultValue="unknown"><option value="unknown">Not sure</option><option value="yes">Yes</option><option value="no">No</option></Select></Field>
            <Field id="er-breathing" label="Are they breathing?"><Select id="er-breathing" name="breathing" defaultValue="unknown"><option value="unknown">Not sure</option><option value="yes">Yes</option><option value="no">No</option></Select></Field>
          </div>
          <Field id="er-loc" label="Where are you? (street, building, landmark)"><Input id="er-loc" name="location_text" maxLength={300} /></Field>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="secondary" onClick={() => navigator.geolocation?.getCurrentPosition((p) => setLoc({ lat: p.coords.latitude, lng: p.coords.longitude }))}>
              <LocateFixed aria-hidden className="size-4" />{loc ? "Location added" : "Add my location"}
            </Button>
            {loc ? (
              <label className="inline-flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" name="share" defaultChecked className="size-4 accent-[var(--color-primary)]" />Share it with the responder
                <input type="hidden" name="lat" value={loc.lat} /><input type="hidden" name="lng" value={loc.lng} />
              </label>
            ) : null}
          </div>
        </div>
      </details>
      <Button type="submit" variant="urgent" disabled={pending}>{pending ? "Sending…" : "Ask a responder to call me"}</Button>
    </form>
  );
}
