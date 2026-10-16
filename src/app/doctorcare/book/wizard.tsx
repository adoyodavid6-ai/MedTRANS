"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge, VerificationBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Select, Textarea } from "@/components/ui/field";
import { fmtSlot, formatDistance, LANGUAGES, NEED_DURATION } from "@/lib/doctorcare/status";
import { formatMoney } from "@/lib/money";
import { escalate, getCandidates, getSlots, submitBooking, type Candidate, type Slot } from "./actions";

type Service = { id: string; slug: string; name: string; summary: string; duration_minutes: number };
type Address = { id: string; label: string; line1: string; area: string | null };
type Question = { id: string; question: string };

const STEPS = ["Service", "Who", "Safety", "Where", "When", "Professional", "Review"] as const;

export function BookingWizard(props: {
  services: Service[]; addresses: Address[]; household: { id: string; full_name: string }[]; questions: Question[];
  bookingFeeMinor: number | null; initialService: string | null; days: { value: string; label: string }[]; idempotencyKey: string; escalationKey: string;
}) {
  const [step, setStep] = useState(0);
  const [serviceId, setServiceId] = useState(props.services.find((s) => s.slug === props.initialService)?.id ?? (props.services.length === 1 ? props.services[0].id : ""));
  const [forWhom, setForWhom] = useState("");
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [addressId, setAddressId] = useState(props.addresses[0]?.id ?? "");
  const [day, setDay] = useState(props.days[0]?.value ?? "");
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [start, setStart] = useState("");
  const [language, setLanguage] = useState("");
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [providerId, setProviderId] = useState("");
  const [need, setNeed] = useState("");
  const [duration, setDuration] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => { heading.current?.focus(); }, [step]);

  const service = props.services.find((s) => s.id === serviceId);
  const chosen = candidates?.find((c) => c.provider_id === providerId);
  const allAnswered = props.questions.every((q) => typeof answers[q.id] === "boolean");
  const anyYes = props.questions.some((q) => answers[q.id] === true);

  function loadSlots(d: string) {
    setDay(d); setStart(""); setSlots(null);
    startTransition(async () => setSlots(await getSlots(serviceId, addressId, d)));
  }
  function loadCandidates(s: string, lang = language) {
    setStart(s); setProviderId(""); setCandidates(null);
    startTransition(async () => {
      const c = await getCandidates(serviceId, addressId, s, lang || null);
      setCandidates(c);
      setProviderId(c[0]?.provider_id ?? "");
    });
  }

  const canNext = [
    Boolean(serviceId), true, allAnswered, Boolean(addressId), Boolean(start), Boolean(providerId), true,
  ][step];

  function next() {
    setError(null);
    if (step === 2 && anyYes) {
      startTransition(() => escalate(serviceId, answers, props.escalationKey));
      return;
    }
    if (step === 3) loadSlots(day);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const r = await submitBooking({
        idempotency_key: props.idempotencyKey, service_id: serviceId, address_id: addressId, start, provider_id: providerId,
        screening: answers, need_description: need || undefined, need_duration: duration || undefined,
        household_member_id: forWhom || undefined, language: language || undefined,
      });
      if (r?.error) setError(r.error);
    });
  }

  return (
    <div className="space-y-5">
      <ol className="flex flex-wrap gap-1.5 text-xs" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined}
            className={i === step ? "rounded-full bg-primary px-2.5 py-1 font-semibold text-white" : i < step ? "rounded-full bg-primary-soft px-2.5 py-1 text-primary-hover" : "rounded-full bg-[#eef2f1] px-2.5 py-1 text-muted"}>
            {i + 1}. {s}
          </li>
        ))}
      </ol>

      <Card className="space-y-4">
        <h2 ref={heading} tabIndex={-1} className="text-xl font-semibold outline-none">
          {["Which service do you need?", "Who is the visit for?", "A few safety questions first", "Where should the professional come?", "When would you like the visit?", "Choose a professional", "Check and confirm"][step]}
        </h2>

        {step === 0 ? (
          <fieldset className="space-y-2">
            <legend className="sr-only">Service</legend>
            {props.services.map((s) => (
              <label key={s.id} className="flex min-h-11 items-start gap-3 rounded-xl border border-line p-3 has-[:checked]:border-primary">
                <input type="radio" name="service" checked={serviceId === s.id} onChange={() => setServiceId(s.id)} className="mt-1 size-4 accent-[var(--color-primary)]" />
                <span><strong>{s.name}</strong><span className="block text-sm text-muted">{s.summary}</span></span>
              </label>
            ))}
          </fieldset>
        ) : null}

        {step === 1 ? (
          <fieldset className="space-y-2">
            <legend className="sr-only">Who the visit is for</legend>
            <label className="flex min-h-11 items-center gap-3 rounded-xl border border-line p-3 has-[:checked]:border-primary">
              <input type="radio" name="who" checked={forWhom === ""} onChange={() => setForWhom("")} className="size-4 accent-[var(--color-primary)]" />Me
            </label>
            {props.household.map((h) => (
              <label key={h.id} className="flex min-h-11 items-center gap-3 rounded-xl border border-line p-3 has-[:checked]:border-primary">
                <input type="radio" name="who" checked={forWhom === h.id} onChange={() => setForWhom(h.id)} className="size-4 accent-[var(--color-primary)]" />{h.full_name}
              </label>
            ))}
            <p className="text-sm text-muted">Booking for someone else? <Link href="/account/household" className="underline">Add them to your household</Link> first.</p>
          </fieldset>
        ) : null}

        {step === 2 ? (
          <div className="space-y-3">
            <p className="text-[0.95rem]">Answer for the person who needs care. If any answer is yes, this may be an emergency and a home visit is not the right choice.</p>
            {props.questions.map((q) => (
              <fieldset key={q.id} className="rounded-xl border border-line p-3">
                <legend className="px-1 font-medium">{q.question}</legend>
                <div className="mt-1 flex gap-4">
                  {[["Yes", true], ["No", false]].map(([label, val]) => (
                    <label key={String(label)} className="inline-flex min-h-11 items-center gap-2">
                      <input type="radio" name={`q-${q.id}`} checked={answers[q.id] === val} onChange={() => setAnswers((a) => ({ ...a, [q.id]: val as boolean }))} className="size-4 accent-[var(--color-primary)]" />
                      {label as string}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
            {anyYes ? <Alert tone="urgent" title="This may be an emergency"><p>Continuing will take you to emergency guidance. Don&apos;t wait for a home visit.</p></Alert> : null}
          </div>
        ) : null}

        {step === 3 ? (
          props.addresses.length === 0 ? (
            <Alert tone="warning" title="Add a pinned address first"><p>A professional needs to know exactly where to come. <Link href="/account/addresses" className="font-semibold underline">Add an address</Link> and pin your location while you are there.</p></Alert>
          ) : (
            <fieldset className="space-y-2">
              <legend className="sr-only">Address</legend>
              {props.addresses.map((a) => (
                <label key={a.id} className="flex min-h-11 items-start gap-3 rounded-xl border border-line p-3 has-[:checked]:border-primary">
                  <input type="radio" name="address" checked={addressId === a.id} onChange={() => setAddressId(a.id)} className="mt-1 size-4 accent-[var(--color-primary)]" />
                  <span><strong>{a.label}</strong><span className="block text-sm text-muted">{[a.line1, a.area].filter(Boolean).join(", ")}</span></span>
                </label>
              ))}
            </fieldset>
          )
        ) : null}

        {step === 4 ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Day">
              {props.days.map((d) => (
                <button key={d.value} type="button" aria-pressed={day === d.value} onClick={() => loadSlots(d.value)}
                  className={day === d.value ? "min-h-11 rounded-xl bg-primary px-3 font-semibold text-white" : "min-h-11 rounded-xl border border-line px-3"}>{d.label}</button>
              ))}
            </div>
            <div aria-live="polite">
              {pending && slots === null ? <p className="text-muted">Checking who is free…</p> : null}
              {slots && slots.length === 0 ? <Alert tone="info" title="No professional is free that day"><p>Try another day. Times shown are only those when a verified professional who covers your address is genuinely free.</p></Alert> : null}
              {slots && slots.length > 0 ? (
                <fieldset>
                  <legend className="mb-2 text-sm text-muted">Times with at least one suitable professional free</legend>
                  <div className="flex flex-wrap gap-2">
                    {slots.map((s) => (
                      <label key={s.slot_start} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-3 has-[:checked]:border-primary has-[:checked]:bg-primary-soft">
                        <input type="radio" name="slot" checked={start === s.slot_start} onChange={() => loadCandidates(s.slot_start)} className="size-4 accent-[var(--color-primary)]" />
                        {new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Nairobi" }).format(new Date(s.slot_start))}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : null}
            </div>
          </div>
        ) : null}

        {step === 5 ? (
          <div className="space-y-3">
            <Field id="lang" label="Preferred language (optional)">
              <Select id="lang" value={language} onChange={(e) => { setLanguage(e.target.value); loadCandidates(start, e.target.value); }}>
                <option value="">No preference</option>
                {Object.entries(LANGUAGES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            <p className="text-sm text-muted">Only verified professionals who offer this service, cover your address and are free at {start ? fmtSlot(start) : "this time"} are shown, nearest first. Distances are straight-line, not travel time.</p>
            <div aria-live="polite">
              {candidates === null ? <p className="text-muted">Finding suitable professionals…</p> : null}
              {candidates && candidates.length === 0 ? <Alert tone="info" title="Nobody is free at this time any more"><p>Go back and choose another time.</p></Alert> : null}
              <fieldset className="space-y-2">
                <legend className="sr-only">Professional</legend>
                {(candidates ?? []).map((c, i) => (
                  <label key={c.provider_id} className="flex min-h-11 items-start gap-3 rounded-xl border border-line p-3 has-[:checked]:border-primary">
                    <input type="radio" name="provider" checked={providerId === c.provider_id} onChange={() => setProviderId(c.provider_id)} className="mt-1 size-4 accent-[var(--color-primary)]" />
                    <span className="flex-1">
                      <span className="flex flex-wrap items-center gap-2"><strong>{c.display_name}</strong><VerificationBadge status="verified" />{i === 0 ? <Badge tone="primary">Nearest suitable</Badge> : null}{c.language_match ? <Badge>Speaks {LANGUAGES[language]}</Badge> : null}</span>
                      <span className="block text-sm text-muted">{c.profession === "doctor" ? "Doctor" : "Nurse"}{c.years_experience ? ` · ${c.years_experience} years` : ""} · {formatDistance(c.distance_m)} away · speaks {c.languages.map((l) => LANGUAGES[l] ?? l).join(", ")}</span>
                      <span className="block font-semibold">{formatMoney(c.fee_minor)} visit fee</span>
                    </span>
                  </label>
                ))}
              </fieldset>
            </div>
          </div>
        ) : null}

        {step === 6 && service && chosen ? (
          <div className="space-y-4">
            <Field id="need" label="Briefly, what do you need help with? (optional)" hint="Shared only with the professional you are matched with.">
              <Textarea id="need" value={need} onChange={(e) => setNeed(e.target.value)} maxLength={1000} rows={3} aria-describedby="need-hint" />
            </Field>
            <Field id="duration" label="How long has this been going on?">
              <Select id="duration" value={duration} onChange={(e) => setDuration(e.target.value)}>
                <option value="">Prefer not to say</option>
                {Object.entries(NEED_DURATION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            <dl className="rounded-xl bg-background p-4 text-[0.95rem]">
              <div className="flex justify-between py-1"><dt>{service.name} with {chosen.display_name}</dt><dd className="tabular-nums">{formatMoney(chosen.fee_minor)}</dd></div>
              <div className="flex justify-between py-1"><dt>Booking fee</dt><dd className="tabular-nums">{props.bookingFeeMinor !== null ? formatMoney(props.bookingFeeMinor) : "—"}</dd></div>
              <div className="flex justify-between border-t border-line pt-2 font-semibold"><dt>Total</dt><dd className="tabular-nums">{props.bookingFeeMinor !== null ? formatMoney(chosen.fee_minor + props.bookingFeeMinor) : "—"}</dd></div>
            </dl>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
              <li>{fmtSlot(start)}, about {service.duration_minutes} minutes.</li>
              <li>You pay only after the professional accepts. If they can&apos;t, we ask the next suitable professional at the same or lower fee.</li>
              <li>You can cancel free of charge until you pay. After paying, cancelling before the visit starts gives a full refund.</li>
            </ul>
          </div>
        ) : null}

        {error ? <Alert tone="warning" role="alert" title={error} /> : null}
        <div className="flex flex-wrap justify-between gap-3 pt-2">
          <Button type="button" variant="ghost" disabled={step === 0 || pending} onClick={() => setStep((s) => s - 1)}>Back</Button>
          {step < STEPS.length - 1 ? (
            <Button type="button" disabled={!canNext || pending} onClick={next}>{step === 2 && anyYes ? "Get emergency guidance" : "Continue"}</Button>
          ) : (
            <Button type="button" size="lg" disabled={pending || !chosen || props.bookingFeeMinor === null} onClick={submit}>{pending ? "Sending…" : "Send request"}</Button>
          )}
        </div>
      </Card>
    </div>
  );
}
