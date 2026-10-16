"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { FormStatus } from "@/components/forms/form-status";
import type { FormState } from "@/lib/forms";
import { setAreaActive, setBoundary, setCountryActive } from "./actions";

function Confirm() {
  return (
    <label className="inline-flex min-h-11 items-center gap-2 text-sm">
      <input type="checkbox" name="confirm" value="yes" className="size-4 accent-[var(--color-primary)]" />
      I confirm this change
    </label>
  );
}

export function CountryForm({ code, active }: { code: string; active: boolean }) {
  const [state, action, pending] = useActionState(setCountryActive, {} as FormState);
  return (
    <form action={action} className="space-y-3">
      <FormStatus state={state} />
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="op" value={active ? "deactivate" : "activate"} />
      {!active ? (
        <Field id={`ref-${code}`} label="Regulatory review reference" hint="Required. E.g. the legal opinion or regulator approval reference.">
          <Input id={`ref-${code}`} name="review_ref" maxLength={200} aria-describedby={`ref-${code}-hint`} />
        </Field>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Confirm />
        <Button type="submit" variant={active ? "ghost" : "secondary"} disabled={pending}>
          {active ? "Deactivate country" : "Activate country"}
        </Button>
      </div>
    </form>
  );
}

export function BoundaryForm({ area, geojson }: { area: string; geojson: string | null }) {
  const [state, action, pending] = useActionState(setBoundary, {} as FormState);
  return (
    <form action={action} className="space-y-3">
      <FormStatus state={state} />
      <input type="hidden" name="area" value={area} />
      <Field id={`geo-${area}`} label="Boundary (GeoJSON Polygon or MultiPolygon, WGS84)" hint="Paste the confirmed service boundary. Leave empty to clear it (this also deactivates the area).">
        <Textarea id={`geo-${area}`} name="geojson" defaultValue={geojson ?? ""} rows={5} className="font-mono text-xs" aria-describedby={`geo-${area}-hint`} />
      </Field>
      <Button type="submit" variant="secondary" disabled={pending}>Save boundary</Button>
    </form>
  );
}

export function AreaActiveForm({ area, active }: { area: string; active: boolean }) {
  const [state, action, pending] = useActionState(setAreaActive, {} as FormState);
  return (
    <form action={action} className="space-y-2">
      <FormStatus state={state} />
      <input type="hidden" name="area" value={area} />
      <input type="hidden" name="active" value={active ? "false" : "true"} />
      <div className="flex flex-wrap items-center gap-3">
        <Confirm />
        <Button type="submit" variant={active ? "ghost" : "primary"} disabled={pending}>
          {active ? "Deactivate area" : "Activate area"}
        </Button>
      </div>
    </form>
  );
}
