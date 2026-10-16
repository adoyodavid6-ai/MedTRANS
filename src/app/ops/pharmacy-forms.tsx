"use client";

import { useActionState } from "react";
import { FormStatus } from "@/components/forms/form-status";
import { Button } from "@/components/ui/button";
import { describedBy, Field, Input, Select, Textarea } from "@/components/ui/field";
import type { FormState } from "@/lib/forms";
import { addLicence, addStaff, createPharmacy, createProduct, dispatchAction, setCourierStatus, updatePharmacy } from "./pharmacy-actions";

function useForm(fn: (s: FormState, f: FormData) => Promise<FormState>) {
  const [state, action, pending] = useActionState(fn, {} as FormState);
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};
  const text = (id: string, label: string, opts: { hint?: string; type?: string; def?: string; step?: string } = {}) => (
    <Field id={id} label={label} hint={opts.hint} error={fe[id]}>
      <Input id={id} name={id} type={opts.type} step={opts.step} defaultValue={v[id] ?? opts.def} aria-invalid={Boolean(fe[id])} aria-describedby={describedBy(id, { hint: opts.hint, error: fe[id] })} />
    </Field>
  );
  return { state, action, pending, fe, v, text };
}

const Confirm = () => (
  <label className="inline-flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="confirm" value="yes" className="size-4 accent-[var(--color-primary)]" />I confirm this change</label>
);

export function CreatePharmacyForm({ areas }: { areas: { id: string; name: string }[] }) {
  const f = useForm(createPharmacy);
  return (
    <form action={f.action} className="space-y-4" noValidate>
      <FormStatus state={f.state} />
      <div className="grid gap-4 sm:grid-cols-2">{f.text("name", "Pharmacy name")}{f.text("slug", "Web address name", { hint: "e.g. westlands-chemist" })}</div>
      {f.text("address_line", "Address")}
      <div className="grid gap-4 sm:grid-cols-3">{f.text("lat", "Latitude", { type: "number", step: "any" })}{f.text("lng", "Longitude", { type: "number", step: "any" })}{f.text("phone", "Phone")}</div>
      <Field id="area_id" label="Coverage area"><Select id="area_id" name="area_id" defaultValue=""><option value="">None yet</option>{areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
      <Button type="submit" disabled={f.pending}>Create pharmacy (unverified)</Button>
    </form>
  );
}

export function PharmacySettingsForm({ p, areas }: { p: { id: string; verification_status: string; is_listed: boolean; is_accepting_orders: boolean; delivery_radius_m: number | null; delivery_fee_minor: number | null; verified_hours: string | null; area_id: string | null }; areas: { id: string; name: string }[] }) {
  const f = useForm(updatePharmacy);
  return (
    <form action={f.action} className="space-y-4">
      <FormStatus state={f.state} />
      <input type="hidden" name="id" value={p.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="verification_status" label="Pharmacy verification status" hint="Set to verified only after checking the premises licence and ownership.">
          <Select id="verification_status" name="verification_status" defaultValue={p.verification_status} aria-describedby="verification_status-hint">
            {["unverified", "pending", "verified", "suspended"].map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Field>
        <Field id="area_id_s" label="Coverage area"><Select id="area_id_s" name="area_id" defaultValue={p.area_id ?? ""}><option value="">None</option>{areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
        {f.text("delivery_radius_km", "Delivery radius (km)", { type: "number", step: "0.1", def: p.delivery_radius_m ? String(p.delivery_radius_m / 1000) : "" })}
        {f.text("delivery_fee", "Delivery fee (KES)", { type: "number", step: "0.01", def: p.delivery_fee_minor !== null ? (p.delivery_fee_minor / 100).toFixed(2) : "", hint: "[[CONFIRM: delivery fee model]]" })}
      </div>
      <Field id="verified_hours" label="Verified opening hours"><Textarea id="verified_hours" name="verified_hours" rows={2} defaultValue={p.verified_hours ?? ""} /></Field>
      <div className="flex flex-wrap gap-4">
        <label className="inline-flex min-h-11 items-center gap-2"><input type="checkbox" name="is_listed" defaultChecked={p.is_listed} className="size-4 accent-[var(--color-primary)]" />Listed in the public directory</label>
        <label className="inline-flex min-h-11 items-center gap-2"><input type="checkbox" name="is_accepting_orders" defaultChecked={p.is_accepting_orders} className="size-4 accent-[var(--color-primary)]" />Accepting orders</label>
      </div>
      <div className="flex flex-wrap items-center gap-3"><Confirm /><Button type="submit" disabled={f.pending}>Save</Button></div>
    </form>
  );
}

export function LicenceForm({ pharmacyId }: { pharmacyId: string }) {
  const f = useForm(addLicence);
  return (
    <form action={f.action} className="space-y-3" noValidate>
      <FormStatus state={f.state} />
      <input type="hidden" name="pharmacy_id" value={pharmacyId} />
      <div className="grid gap-4 sm:grid-cols-2">{f.text("licence_number", "Licence number")}{f.text("valid_until", "Valid until", { type: "date" })}</div>
      {f.text("check_method", "How you verified it", { hint: "e.g. Pharmacy and Poisons Board register search on 17 Oct 2026" })}
      <div>
        <label className="flex min-h-11 items-start gap-3"><input type="checkbox" name="verified" className="mt-1 size-4 accent-[var(--color-primary)]" /><span>I checked this licence with the regulator myself.</span></label>
        {f.fe.verified ? <p className="ml-7 text-sm text-urgent">{f.fe.verified}</p> : null}
      </div>
      <Button type="submit" variant="secondary" disabled={f.pending}>Record verified licence</Button>
    </form>
  );
}

export function StaffForm({ pharmacyId }: { pharmacyId: string }) {
  const f = useForm(addStaff);
  return (
    <form action={f.action} className="space-y-3" noValidate>
      <FormStatus state={f.state} />
      <input type="hidden" name="pharmacy_id" value={pharmacyId} />
      <div className="grid gap-4 sm:grid-cols-2">
        {f.text("phone", "Their sign-in mobile number")}
        <Field id="staff_role" label="Role"><Select id="staff_role" name="staff_role" defaultValue={f.v.staff_role ?? "pharmacist"}><option value="pharmacist">Pharmacist</option><option value="manager">Manager</option><option value="dispatcher">Dispatcher</option></Select></Field>
      </div>
      {f.text("registration_number", "Pharmacist registration number (pharmacists only)")}
      <label className="flex min-h-11 items-start gap-3"><input type="checkbox" name="registration_verified" className="mt-1 size-4 accent-[var(--color-primary)]" /><span>I checked this pharmacist&apos;s registration with the regulator.</span></label>
      <Button type="submit" variant="secondary" disabled={f.pending}>Add staff member</Button>
    </form>
  );
}

export function ProductForm() {
  const f = useForm(createProduct);
  return (
    <form action={f.action} className="space-y-4" noValidate>
      <FormStatus state={f.state} />
      <div className="grid gap-4 sm:grid-cols-2">
        {f.text("name", "Product name")}{f.text("generic_name", "Generic name")}{f.text("brand", "Brand (optional)")}{f.text("manufacturer", "Manufacturer (optional)")}
        {f.text("strength", "Strength", { hint: "e.g. 500 mg" })}{f.text("dosage_form", "Dosage form", { hint: "e.g. Tablet" })}{f.text("pack_size", "Pack size", { hint: "e.g. Pack of 24" })}
        {f.text("vat_rate_percent", "VAT rate (%)", { type: "number", step: "0.01", hint: "Leave empty until confirmed: the product can't be ordered until it's set." })}
      </div>
      <Field id="requires_prescription" label="Prescription required?" error={f.fe.requires_prescription}>
        <Select id="requires_prescription" name="requires_prescription" defaultValue={f.v.requires_prescription ?? ""}><option value="" disabled>Choose…</option><option value="yes">Yes, prescription only</option><option value="no">No, over the counter</option></Select>
      </Field>
      <label className="flex min-h-11 items-center gap-3"><input type="checkbox" name="is_controlled" className="size-4 accent-[var(--color-primary)]" />Controlled medicine (never sold through MedTRANS)</label>
      <Button type="submit" disabled={f.pending}>Add to catalogue</Button>
    </form>
  );
}

export function DispatchForm({ orderId, status, couriers }: { orderId: string; status: string; couriers: { id: string; name: string }[] }) {
  const f = useForm(dispatchAction);
  return (
    <div className="space-y-2">
      <FormStatus state={f.state} />
      <div className="flex flex-wrap items-end gap-2">
        {status === "ready_for_dispatch" ? (
          <form action={f.action} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="order_id" value={orderId} /><input type="hidden" name="op" value="assign" />
            <label className="text-sm">Delivery partner
              <Select name="courier_id" defaultValue="" className="min-w-48"><option value="" disabled>Choose…</option>{couriers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
            </label>
            <Button type="submit" disabled={f.pending || couriers.length === 0}>Assign</Button>
          </form>
        ) : null}
        {status === "assigned_to_courier" ? <form action={f.action}><input type="hidden" name="order_id" value={orderId} /><input type="hidden" name="op" value="unassign" /><Button type="submit" variant="secondary" disabled={f.pending}>Unassign</Button></form> : null}
        {status === "failed_delivery" ? <form action={f.action}><input type="hidden" name="order_id" value={orderId} /><input type="hidden" name="op" value="reattempt" /><Button type="submit" variant="secondary" disabled={f.pending}>Re-attempt delivery</Button></form> : null}
        {["failed_delivery", "ready_for_dispatch", "confirmed", "preparing", "awaiting_pharmacy_acceptance"].includes(status) ? (
          <form action={f.action} className="flex flex-wrap items-end gap-2"><input type="hidden" name="order_id" value={orderId} /><input type="hidden" name="op" value="refund_needed" />
            <label className="text-sm">Reason<Input name="note" className="w-56" /></label><Button type="submit" variant="ghost" className="text-urgent" disabled={f.pending}>Cancel &amp; refund</Button></form>
        ) : null}
        {status === "refund_processing" ? (
          <form action={f.action} className="flex flex-wrap items-end gap-2"><input type="hidden" name="order_id" value={orderId} /><input type="hidden" name="op" value="refunded" />
            <label className="text-sm">Provider refund reference<Input name="reference" className="w-56" /></label><Button type="submit" disabled={f.pending}>Mark refunded</Button></form>
        ) : null}
      </div>
    </div>
  );
}

export function CourierForm({ userId, status }: { userId: string; status: string }) {
  const f = useForm(setCourierStatus);
  return (
    <form action={f.action} className="flex flex-wrap items-end gap-2">
      <FormStatus state={f.state} />
      <input type="hidden" name="user_id" value={userId} />
      <label className="text-sm">Status<Select name="status" defaultValue={status} className="min-w-36"><option value="unverified">unverified</option><option value="verified">verified</option><option value="suspended">suspended</option></Select></label>
      <label className="text-sm">How identity was checked<Input name="check_method" className="w-64" /></label>
      <Confirm />
      <Button type="submit" variant="secondary" disabled={f.pending}>Save</Button>
    </form>
  );
}
