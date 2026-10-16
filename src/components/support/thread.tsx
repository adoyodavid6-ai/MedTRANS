"use client";

import { useActionState } from "react";
import { rateTicket, replyAsCustomer } from "@/app/contact/actions";
import { FormStatus } from "@/components/forms/form-status";
import { Button } from "@/components/ui/button";
import { describedBy, Field, Input, Textarea } from "@/components/ui/field";
import type { FormState } from "@/lib/forms";

export function CustomerReplyForm({ ticketId, token }: { ticketId: string; token?: string }) {
  const [state, action, pending] = useActionState(replyAsCustomer, {} as FormState);
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-3">
      <FormStatus state={state} />
      <input type="hidden" name="ticket_id" value={ticketId} />
      {token ? <input type="hidden" name="token" value={token} /> : null}
      <Field id="reply" label="Your reply" error={fe.body}>
        <Textarea id="reply" name="body" rows={3} maxLength={4000} aria-invalid={Boolean(fe.body)} aria-describedby={describedBy("reply", { error: fe.body })} />
      </Field>
      <Button type="submit" disabled={pending}>Send reply</Button>
    </form>
  );
}

export function RateForm({ ticketId, token }: { ticketId: string; token?: string }) {
  const [state, action, pending] = useActionState(rateTicket, {} as FormState);
  if (state.ok) return <FormStatus state={state} />;
  return (
    <form action={action} className="space-y-3">
      <FormStatus state={state} />
      <input type="hidden" name="ticket_id" value={ticketId} />
      {token ? <input type="hidden" name="token" value={token} /> : null}
      <fieldset>
        <legend className="font-semibold text-navy">How did we do?</legend>
        <div className="mt-1 flex flex-wrap gap-3">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="inline-flex min-h-11 items-center gap-1"><input type="radio" name="rating" value={n} className="size-4 accent-[var(--color-primary)]" />{n}</label>
          ))}
        </div>
      </fieldset>
      <label className="block text-sm">Comment (optional)<Input name="comment" maxLength={500} /></label>
      <Button type="submit" variant="secondary" disabled={pending}>Send feedback</Button>
    </form>
  );
}

export function Messages({ messages }: { messages: { author_kind: string; body: string; created_at: string }[] }) {
  const fmt = (iso: string) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Nairobi" }).format(new Date(iso));
  return (
    <ol className="space-y-3">
      {messages.map((m, i) => (
        <li key={i} className={m.author_kind === "staff" ? "rounded-xl bg-primary-soft p-4" : "rounded-xl border border-line bg-surface p-4"}>
          <p className="text-sm font-semibold text-navy">{m.author_kind === "staff" ? "MedTRANS support" : "You"} · <span className="font-normal text-muted">{fmt(m.created_at)}</span></p>
          <p className="mt-1 whitespace-pre-line text-[0.95rem]">{m.body}</p>
        </li>
      ))}
    </ol>
  );
}
