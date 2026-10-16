"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { LocateFixed } from "lucide-react";
import { FormStatus } from "@/components/forms/form-status";
import { Button } from "@/components/ui/button";
import { describedBy, Field, Input } from "@/components/ui/field";
import type { FormState } from "@/lib/forms";
import { addAddress } from "./actions";

export function AddressForm() {
  const [state, action, pending] = useActionState(addAddress, {} as FormState);
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [geoMsg, setGeoMsg] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  function pin() {
    setGeoMsg(null);
    if (!("geolocation" in navigator)) return setGeoMsg("This device can't share its location.");
    navigator.geolocation.getCurrentPosition(
      (p) => setCoords({ lat: Number(p.coords.latitude.toFixed(6)), lng: Number(p.coords.longitude.toFixed(6)), accuracy: Math.round(p.coords.accuracy) }),
      () => setGeoMsg("Location wasn't shared. That's fine — the written address and landmark are enough."),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  const f = (id: string, label: string, opts: { hint?: string; required?: boolean; autoComplete?: string; max?: number } = {}) => (
    <Field id={id} label={label} hint={opts.hint} error={fe[id]}>
      <Input
        id={id}
        name={id}
        defaultValue={v[id]}
        required={opts.required}
        autoComplete={opts.autoComplete}
        maxLength={opts.max}
        aria-invalid={Boolean(fe[id])}
        aria-describedby={describedBy(id, { hint: opts.hint, error: fe[id] })}
      />
    </Field>
  );

  return (
    <form ref={formRef} action={action} onReset={() => setCoords(null)} className="space-y-4" noValidate>
      <FormStatus state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        {f("label", "Name for this address", { required: true, hint: "For example Home, Work, Mum's house.", max: 40 })}
        {f("area", "Area or estate", { autoComplete: "address-level3", max: 120 })}
      </div>
      {f("line1", "Street, road or estate details", { required: true, autoComplete: "address-line1", max: 200 })}
      <div className="grid gap-4 sm:grid-cols-2">
        {f("building_details", "Building, floor, house or gate", { autoComplete: "address-line2", max: 200 })}
        {f("landmark", "Nearby landmark", { hint: "Helps couriers and clinicians find you.", max: 200 })}
      </div>
      <div className="space-y-2 rounded-xl bg-background p-4">
        <p className="text-sm font-semibold text-navy">Map pin (optional)</p>
        {coords ? (
          <p className="text-sm">
            Pinned at {coords.lat}, {coords.lng} (about ±{coords.accuracy} m).{" "}
            <button type="button" className="text-primary underline" onClick={() => setCoords(null)}>Remove pin</button>
          </p>
        ) : (
          <Button type="button" variant="secondary" onClick={pin}>
            <LocateFixed aria-hidden className="size-4" />
            I&apos;m here now — pin my current location
          </Button>
        )}
        {geoMsg ? <p className="text-sm text-muted" role="status">{geoMsg}</p> : null}
        {coords ? (
          <>
            <input type="hidden" name="lat" value={coords.lat} />
            <input type="hidden" name="lng" value={coords.lng} />
          </>
        ) : null}
      </div>
      <label className="flex min-h-11 items-center gap-3">
        <input type="checkbox" name="is_default" defaultChecked={v.is_default === "on"} className="size-5 accent-[var(--color-primary)]" />
        Use as my default address
      </label>
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save address"}</Button>
    </form>
  );
}
