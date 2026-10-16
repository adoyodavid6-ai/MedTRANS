"use client";

import { useActionState } from "react";
import { FormStatus } from "@/components/forms/form-status";
import { Button } from "@/components/ui/button";
import { describedBy, Field, Input, Select, Textarea } from "@/components/ui/field";
import type { FormState } from "@/lib/forms";
import { createPlan, generateSettlements, reviewApplication, saveArticle, settlementAction } from "./commercial-actions";

export function GenerateForm({ defaultStart, defaultEnd }: { defaultStart: string; defaultEnd: string }) {
  const [state, action, pending] = useActionState(generateSettlements, {} as FormState);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <FormStatus state={state} />
      <label className="text-sm">From<Input name="start" type="date" defaultValue={defaultStart} className="w-44" /></label>
      <label className="text-sm">To (inclusive)<Input name="end" type="date" defaultValue={defaultEnd} className="w-44" /></label>
      <Button type="submit" disabled={pending}>Calculate draft settlements</Button>
    </form>
  );
}

export function SettlementActions({ id, status }: { id: string; status: string }) {
  const [state, action, pending] = useActionState(settlementAction, {} as FormState);
  return (
    <div className="space-y-2">
      <FormStatus state={state} />
      <div className="flex flex-wrap items-end gap-2">
        {status === "draft" ? <form action={action}><input type="hidden" name="id" value={id} /><input type="hidden" name="action" value="approve" /><Button type="submit" variant="secondary" disabled={pending}>Approve</Button></form> : null}
        {status === "approved" ? (
          <form action={action} className="flex flex-wrap items-end gap-2"><input type="hidden" name="id" value={id} /><input type="hidden" name="action" value="paid" />
            <label className="text-sm">Payout reference<Input name="reference" className="w-56" /></label><Button type="submit" disabled={pending}>Record payout</Button></form>
        ) : null}
        {["draft", "approved"].includes(status) ? <form action={action}><input type="hidden" name="id" value={id} /><input type="hidden" name="action" value="void" /><Button type="submit" variant="ghost" className="text-urgent" disabled={pending}>Void</Button></form> : null}
      </div>
    </div>
  );
}

export function ApplicationForm({ id, status }: { id: string; status: string }) {
  const [state, action, pending] = useActionState(reviewApplication, {} as FormState);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <FormStatus state={state} />
      <input type="hidden" name="id" value={id} />
      <label className="text-sm">Status<Select name="status" defaultValue={status} className="min-w-36">{["received", "in_review", "approved", "declined"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</Select></label>
      <label className="text-sm">Note<Input name="note" className="w-64" /></label>
      <Button type="submit" variant="secondary" disabled={pending}>Save</Button>
    </form>
  );
}

export function ArticleForm({ a }: { a?: { id: string; title: string; summary: string; body: string; reviewed_by_name: string | null; reviewed_by_credentials: string | null; reviewed_at: string | null; is_published: boolean } }) {
  const [state, action, pending] = useActionState(saveArticle, {} as FormState);
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};
  const val = (k: string, d?: string | null) => v[k] ?? d ?? "";
  return (
    <form action={action} className="space-y-3" noValidate>
      <FormStatus state={state} />
      {a ? <input type="hidden" name="id" value={a.id} /> : null}
      <Field id={`t-${a?.id ?? "new"}`} label="Title" error={fe.title}><Input id={`t-${a?.id ?? "new"}`} name="title" defaultValue={val("title", a?.title)} /></Field>
      <Field id={`s-${a?.id ?? "new"}`} label="Summary" error={fe.summary}><Input id={`s-${a?.id ?? "new"}`} name="summary" defaultValue={val("summary", a?.summary)} /></Field>
      <Field id={`b-${a?.id ?? "new"}`} label="Article text (paragraphs separated by a blank line)" error={fe.body}><Textarea id={`b-${a?.id ?? "new"}`} name="body" rows={8} defaultValue={val("body", a?.body)} aria-describedby={describedBy(`b-${a?.id ?? "new"}`, { error: fe.body })} /></Field>
      <fieldset className="grid gap-3 rounded-xl bg-background p-3 sm:grid-cols-3">
        <legend className="px-1 text-sm font-semibold text-navy">Clinical review (required to publish)</legend>
        <label className="text-sm">Reviewer name<Input name="reviewed_by_name" defaultValue={val("reviewed_by_name", a?.reviewed_by_name)} /></label>
        <label className="text-sm">Credentials<Input name="reviewed_by_credentials" defaultValue={val("reviewed_by_credentials", a?.reviewed_by_credentials)} placeholder="e.g. MBChB, KMPDC reg. …" /></label>
        <label className="text-sm">Review date<Input name="reviewed_at" type="date" defaultValue={val("reviewed_at", a?.reviewed_at)} /></label>
      </fieldset>
      <label className="flex min-h-11 items-center gap-3"><input type="checkbox" name="publish" defaultChecked={a?.is_published} className="size-5 accent-[var(--color-primary)]" />Published</label>
      <p className="text-xs text-muted">Editing the title or text of a reviewed article withdraws it until it is reviewed again.</p>
      <Button type="submit" disabled={pending}>Save article</Button>
    </form>
  );
}

export function PlanForm() {
  const [state, action, pending] = useActionState(createPlan, {} as FormState);
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-3" noValidate>
      <FormStatus state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="audience" label="For"><Select id="audience" name="audience" defaultValue="pharmacy"><option value="pharmacy">Pharmacies</option><option value="provider">Doctors &amp; nurses</option><option value="organisation">Organisations</option></Select></Field>
        <Field id="pname" label="Plan name" error={fe.name}><Input id="pname" name="name" /></Field>
      </div>
      <Field id="psummary" label="Summary" error={fe.summary}><Input id="psummary" name="summary" /></Field>
      <Field id="features" label="Features (one per line)"><Textarea id="features" name="features" rows={3} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="price" label="Price (KES) — leave empty until confirmed"><Input id="price" name="price" type="number" step="0.01" /></Field>
        <Field id="billing_period" label="Billing period"><Select id="billing_period" name="billing_period" defaultValue=""><option value="">Not set</option><option value="month">Monthly</option><option value="year">Yearly</option></Select></Field>
      </div>
      <Button type="submit" disabled={pending}>Save plan (inactive)</Button>
    </form>
  );
}
