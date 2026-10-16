"use client";

import { useActionState, useState } from "react";
import { LocateFixed } from "lucide-react";
import { FormStatus } from "@/components/forms/form-status";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { LANGUAGES } from "@/lib/doctorcare/status";
import type { FormState } from "@/lib/forms";
import { addTimeOff, completeVisit, moveVisit, respondOffer, saveHours, saveProfile, saveServices } from "./actions";

export function OfferActions({ offerId }: { offerId: string }) {
  const [state, action, pending] = useActionState(respondOffer, {} as FormState);
  if (state.ok) return <FormStatus state={state} />;
  return (
    <div className="space-y-2">
      <FormStatus state={state} />
      <div className="flex flex-wrap items-start gap-2">
        <form action={action}><input type="hidden" name="offer_id" value={offerId} /><input type="hidden" name="op" value="accept" /><Button type="submit" disabled={pending}>Accept visit</Button></form>
        <details className="rounded-xl border border-line px-3 py-2">
          <summary className="cursor-pointer text-sm font-semibold">Decline</summary>
          <form action={action} className="mt-2 space-y-2"><input type="hidden" name="offer_id" value={offerId} /><input type="hidden" name="op" value="decline" />
            <label className="block text-sm">Reason (optional)<Input name="reason" maxLength={300} /></label>
            <Button type="submit" variant="secondary" disabled={pending}>Decline</Button></form>
        </details>
      </div>
    </div>
  );
}

const NEXT: Record<string, { to: string; label: string } | undefined> = {
  confirmed: { to: "en_route", label: "I'm on my way" },
  en_route: { to: "arrived", label: "I've arrived" },
  arrived: { to: "in_progress", label: "Start the visit" },
};

export function VisitActions({ bookingId, status }: { bookingId: string; status: string }) {
  const [state, action, pending] = useActionState(moveVisit, {} as FormState);
  const next = NEXT[status];
  return (
    <div className="space-y-2">
      <FormStatus state={state} />
      <div className="flex flex-wrap items-start gap-2">
        {next ? <form action={action}><input type="hidden" name="booking_id" value={bookingId} /><input type="hidden" name="to" value={next.to} /><Button type="submit" disabled={pending}>{next.label}</Button></form> : null}
        {["en_route", "arrived"].includes(status) ? (
          <details className="rounded-xl border border-line px-3 py-2"><summary className="cursor-pointer text-sm font-semibold text-urgent">Patient not there</summary>
            <form action={action} className="mt-2 space-y-2"><input type="hidden" name="booking_id" value={bookingId} /><input type="hidden" name="to" value="no_show" />
              <label className="block text-sm">What happened?<Input name="note" maxLength={500} /></label><Button type="submit" variant="secondary" disabled={pending}>Record no-show</Button></form></details>
        ) : null}
        {["confirmed", "en_route"].includes(status) ? (
          <details className="rounded-xl border border-line px-3 py-2"><summary className="cursor-pointer text-sm font-semibold text-urgent">I can&apos;t attend</summary>
            <form action={action} className="mt-2 space-y-2"><input type="hidden" name="booking_id" value={bookingId} /><input type="hidden" name="to" value="refund_processing" />
              <label className="block text-sm">Reason shown to the patient<Input name="note" maxLength={500} /></label><Button type="submit" variant="secondary" disabled={pending}>Cancel and refund the patient</Button></form></details>
        ) : null}
      </div>
    </div>
  );
}

export function VisitRecordForm({ bookingId }: { bookingId: string }) {
  const [state, action, pending] = useActionState(completeVisit, {} as FormState);
  if (state.ok) return <FormStatus state={state} />;
  return (
    <form action={action} className="space-y-3">
      <FormStatus state={state} />
      <input type="hidden" name="booking_id" value={bookingId} />
      <Field id={`pc-${bookingId}`} label="Reason for the visit"><Textarea id={`pc-${bookingId}`} name="presenting_concern" rows={2} required /></Field>
      <Field id={`ob-${bookingId}`} label="Observations / examination"><Textarea id={`ob-${bookingId}`} name="observations" rows={2} /></Field>
      <fieldset className="grid gap-2 sm:grid-cols-5">
        <legend className="mb-1 text-sm font-semibold text-navy">Vital signs (optional)</legend>
        {[["temperature_c", "Temp °C"], ["pulse_bpm", "Pulse /min"], ["blood_pressure", "BP mmHg"], ["respiratory_rate", "Resp /min"], ["oxygen_saturation_pct", "SpO₂ %"]].map(([k, l]) => (
          <label key={k} className="text-sm">{l}<Input name={k} maxLength={20} /></label>
        ))}
      </fieldset>
      <Field id={`cp-${bookingId}`} label="Care provided"><Textarea id={`cp-${bookingId}`} name="care_provided" rows={2} required /></Field>
      <Field id={`ad-${bookingId}`} label="Advice to the patient"><Textarea id={`ad-${bookingId}`} name="advice" rows={2} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id={`fu-${bookingId}`} label="Follow-up"><Textarea id={`fu-${bookingId}`} name="follow_up" rows={2} /></Field>
        <Field id={`rf-${bookingId}`} label="Referral"><Textarea id={`rf-${bookingId}`} name="referral" rows={2} /></Field>
      </div>
      <p className="text-sm text-muted">Signing completes the visit. The record is shared with the patient and can&apos;t be edited afterwards.</p>
      <Button type="submit" disabled={pending}>Sign and complete visit</Button>
    </form>
  );
}

export function ProfileForm({ p }: { p: { bio: string | null; languages: string[]; service_radius_m: number | null; travel_buffer_minutes: number; accepts_bookings: boolean; has_location: boolean } }) {
  const [state, action, pending] = useActionState(saveProfile, {} as FormState);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [geo, setGeo] = useState<string | null>(null);
  return (
    <form action={action} className="space-y-4">
      <FormStatus state={state} />
      <Field id="bio" label="About you (shown to patients)"><Textarea id="bio" name="bio" defaultValue={p.bio ?? ""} maxLength={1000} rows={3} /></Field>
      <fieldset><legend className="mb-1 text-sm font-semibold text-navy">Languages</legend>
        <div className="flex flex-wrap gap-4">{Object.entries(LANGUAGES).map(([k, l]) => <label key={k} className="inline-flex min-h-11 items-center gap-2"><input type="checkbox" name="languages" value={k} defaultChecked={p.languages.includes(k)} className="size-4 accent-[var(--color-primary)]" />{l}</label>)}</div>
      </fieldset>
      <div className="space-y-2 rounded-xl bg-background p-4">
        <p className="text-sm font-semibold text-navy">Base location (private)</p>
        <p className="text-sm text-muted">Used only to match you with nearby patients. Patients see an approximate distance, never this location.</p>
        <p className="text-sm">{pin ? `New pin set (${pin.lat.toFixed(4)}, ${pin.lng.toFixed(4)}) — save to apply.` : p.has_location ? "A base location is set." : "No base location yet: you can't be matched until you set one."}</p>
        <Button type="button" variant="secondary" onClick={() => {
          if (!("geolocation" in navigator)) return setGeo("This device can't share its location.");
          navigator.geolocation.getCurrentPosition((x) => setPin({ lat: x.coords.latitude, lng: x.coords.longitude }), () => setGeo("Location wasn't shared."), { enableHighAccuracy: true, timeout: 15000 });
        }}><LocateFixed aria-hidden className="size-4" />Use my current location as my base</Button>
        {geo ? <p role="status" className="text-sm text-urgent">{geo}</p> : null}
        {pin ? <><input type="hidden" name="lat" value={pin.lat} /><input type="hidden" name="lng" value={pin.lng} /></> : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="radius" label="How far you'll travel (km)"><Input id="radius" name="service_radius_km" type="number" step="0.5" min="0.5" max="50" defaultValue={p.service_radius_m ? p.service_radius_m / 1000 : 10} /></Field>
        <Field id="buffer" label="Travel time between visits (minutes)"><Input id="buffer" name="travel_buffer_minutes" type="number" min="0" max="180" defaultValue={p.travel_buffer_minutes} /></Field>
      </div>
      <label className="flex min-h-11 items-center gap-3"><input type="checkbox" name="accepts_bookings" defaultChecked={p.accepts_bookings} className="size-5 accent-[var(--color-primary)]" />Accept new visit requests</label>
      <Button type="submit" disabled={pending}>Save profile</Button>
    </form>
  );
}

export function ServicesForm({ services }: { services: { id: string; name: string; offered: boolean; fee_minor: number | null }[] }) {
  const [state, action, pending] = useActionState(saveServices, {} as FormState);
  return (
    <form action={action} className="space-y-3">
      <FormStatus state={state} />
      {services.length === 0 ? <p className="text-muted">No services for your profession are switched on yet.</p> : null}
      {services.map((s) => (
        <div key={s.id} className="flex flex-wrap items-end gap-3 rounded-xl border border-line p-3">
          <input type="hidden" name="service_id" value={s.id} />
          <label className="inline-flex min-h-11 flex-1 items-center gap-2"><input type="checkbox" name={`offered:${s.id}`} defaultChecked={s.offered} className="size-4 accent-[var(--color-primary)]" />{s.name}</label>
          <label className="text-sm">Your fee (KES)<Input name={`fee:${s.id}`} type="number" step="0.01" min="0.01" defaultValue={s.fee_minor ? (s.fee_minor / 100).toFixed(2) : ""} className="w-36" /></label>
        </div>
      ))}
      <Button type="submit" disabled={pending}>Save services and fees</Button>
    </form>
  );
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function HoursForm({ hours }: { hours: { weekday: number; start_time: string; end_time: string }[] }) {
  const [state, action, pending] = useActionState(saveHours, {} as FormState);
  return (
    <form action={action} className="space-y-3">
      <FormStatus state={state} />
      {DAYS.map((d, i) => {
        const h = hours.find((x) => x.weekday === i);
        return (
          <div key={d} className="flex flex-wrap items-end gap-3">
            <label className="inline-flex min-h-11 w-36 items-center gap-2"><input type="checkbox" name={`on:${i}`} defaultChecked={Boolean(h)} className="size-4 accent-[var(--color-primary)]" />{d}</label>
            <label className="text-sm">From<Input name={`start:${i}`} type="time" defaultValue={h?.start_time.slice(0, 5) ?? "08:00"} className="w-32" /></label>
            <label className="text-sm">To<Input name={`end:${i}`} type="time" defaultValue={h?.end_time.slice(0, 5) ?? "17:00"} className="w-32" /></label>
          </div>
        );
      })}
      <p className="text-sm text-muted">Times are East Africa Time. Patients can only book times inside these hours that don&apos;t clash with your other visits.</p>
      <Button type="submit" disabled={pending}>Save working hours</Button>
    </form>
  );
}

export function TimeOffForm() {
  const [state, action, pending] = useActionState(addTimeOff, {} as FormState);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <FormStatus state={state} />
      <label className="text-sm">From<Input name="from" type="date" className="w-44" /></label>
      <label className="text-sm">To<Input name="to" type="date" className="w-44" /></label>
      <label className="text-sm">Note<Input name="note" maxLength={200} className="w-48" /></label>
      <Button type="submit" variant="secondary" disabled={pending}>Add time off</Button>
    </form>
  );
}
