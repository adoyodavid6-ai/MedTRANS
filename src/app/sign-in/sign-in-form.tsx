"use client";

import { useActionState, useEffect, useRef } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { describedBy, Field, Input } from "@/components/ui/field";
import { signInStep, type SignInState } from "./actions";

export function SignInForm({ next }: { next: string | null }) {
  const [state, action, pending] = useActionState(signInStep, { step: "identify" } as SignInState);
  const codeRef = useRef<HTMLInputElement>(null);
  const idRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.step === "verify") codeRef.current?.focus();
    else if (state.error) idRef.current?.focus();
  }, [state]);

  if (state.step === "verify") {
    const err = state.error;
    return (
      // Distinct keys: React resets a form after its action completes, and the verify step must not
      // inherit the identify form's reset (it could wipe a code the user or SMS autofill just entered).
      <form key="verify" action={action} className="space-y-4" noValidate>
        <input type="hidden" name="intent" value="verify" />
        {state.notice && !err ? (
          <Alert tone="info" role="status">
            <p>
              {state.notice} Sent to <strong>{state.masked}</strong>.
            </p>
          </Alert>
        ) : null}
        <input type="hidden" name="identifier" value={state.identifier} />
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <Field id="code" label="6-digit code" error={err}>
          <Input
            ref={codeRef}
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            aria-invalid={Boolean(err)}
            aria-describedby={describedBy("code", { error: err })}
            className="text-center font-mono text-2xl tracking-[0.4em]"
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Checking…" : "Continue"}
        </Button>
        <p className="text-center text-sm">
          <a href={next ? `/sign-in?next=${encodeURIComponent(next)}` : "/sign-in"} className="inline-flex min-h-11 items-center text-primary underline">
            Use a different number or email, or resend the code
          </a>
        </p>
      </form>
    );
  }

  const err = state.error;
  return (
    <form key="identify" action={action} className="space-y-4" noValidate>
      <input type="hidden" name="intent" value="request" />
      <Field
        id="identifier"
        label="Mobile number or email"
        hint="We'll send you a one-time code. No password needed."
        error={err}
      >
        <Input
          ref={idRef}
          id="identifier"
          name="identifier"
          defaultValue={state.value}
          autoComplete="username"
          inputMode="email"
          required
          aria-invalid={Boolean(err)}
          aria-describedby={describedBy("identifier", { hint: true, error: err })}
        />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Sending code…" : "Send code"}
      </Button>
    </form>
  );
}
