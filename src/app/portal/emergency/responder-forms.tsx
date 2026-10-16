"use client";

import { useActionState } from "react";
import { FormStatus } from "@/components/forms/form-status";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { EMERGENCY_STATUS, SEVERITY } from "@/lib/emergency/status";
import type { FormState } from "@/lib/forms";
import { responderAction } from "./actions";

export function ResponderActions({ requestId, status, severity }: { requestId: string; status: string; severity: string | null }) {
  const [state, action, pending] = useActionState(responderAction, {} as FormState);
  return (
    <div className="space-y-2">
      <FormStatus state={state} />
      <div className="flex flex-wrap gap-2">
        {status === "received" ? <form action={action}><input type="hidden" name="request_id" value={requestId} /><input type="hidden" name="status" value="acknowledged" /><Button type="submit" disabled={pending}>Acknowledge</Button></form> : null}
        {["received", "acknowledged"].includes(status) ? <form action={action}><input type="hidden" name="request_id" value={requestId} /><input type="hidden" name="status" value="assigned" /><Button type="submit" variant="secondary" disabled={pending}>Take it</Button></form> : null}
      </div>
      <form action={action} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="request_id" value={requestId} />
        <label className="text-sm">Triage<Select name="severity" defaultValue={severity ?? ""} className="min-w-48"><option value="">Unchanged</option>{Object.entries(SEVERITY).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></label>
        <label className="text-sm">Status<Select name="status" defaultValue="" className="min-w-56"><option value="">Unchanged</option>{Object.entries(EMERGENCY_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select></label>
        <label className="text-sm">Note<Input name="note" className="w-64" /></label>
        <Button type="submit" variant="secondary" disabled={pending}>Update</Button>
      </form>
      <form action={action} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="request_id" value={requestId} /><input type="hidden" name="op" value="call" />
        <label className="text-sm">Call attempt<Select name="outcome" defaultValue="answered" className="min-w-40">{["answered", "no_answer", "busy", "wrong_number", "disconnected"].map((o) => <option key={o} value={o}>{o.replace("_", " ")}</option>)}</Select></label>
        <label className="text-sm">Note<Input name="note" className="w-64" /></label>
        <Button type="submit" variant="ghost" disabled={pending}>Log call</Button>
      </form>
    </div>
  );
}
