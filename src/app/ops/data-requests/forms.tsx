"use client";

import { useActionState } from "react";
import { FormStatus } from "@/components/forms/form-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import type { FormState } from "@/lib/forms";
import { completeErasure, declineErasure } from "./actions";

export function ErasureDecision({ id }: { id: string }) {
  const [done, complete, p1] = useActionState(completeErasure, {} as FormState);
  const [declined, decline, p2] = useActionState(declineErasure, {} as FormState);
  return (
    <div className="space-y-2">
      <FormStatus state={done} />
      <FormStatus state={declined} />
      <form action={complete} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="id" value={id} />
        <label className="text-sm">Outcome (shown to the person)<Input name="note" className="w-80" defaultValue="Removed profile name, addresses, household and notifications. Orders, prescriptions and visit records retained for the legal retention period." /></label>
        <Button type="submit" disabled={p1}>Complete erasure</Button>
      </form>
      <form action={decline} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="id" value={id} />
        <label className="text-sm">Reason for declining<Input name="note" className="w-80" /></label>
        <Button type="submit" variant="ghost" disabled={p2}>Decline</Button>
      </form>
    </div>
  );
}
