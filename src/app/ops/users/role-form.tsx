"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { ROLE_LABELS, ROLES, type Role } from "@/lib/auth/roles";
import { changeRole, type RoleChangeResult } from "./actions";

export function RoleForm({ userId, current }: { userId: string; current: Role[] }) {
  const [state, action, pending] = useActionState(changeRole, {} as RoleChangeResult);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="user_id" value={userId} />
      <label className="sr-only" htmlFor={`role-${userId}`}>Role</label>
      <Select id={`role-${userId}`} name="role" defaultValue="" className="w-auto min-w-44 py-2" required>
        <option value="" disabled>Choose role…</option>
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}{current.includes(r) ? " (held)" : ""}
          </option>
        ))}
      </Select>
      <label className="inline-flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="confirm" value="yes" className="size-4 accent-[var(--color-primary)]" />
        Confirm
      </label>
      <Button type="submit" name="op" value="grant" variant="secondary" disabled={pending}>Grant</Button>
      <Button type="submit" name="op" value="revoke" variant="ghost" className="text-urgent" disabled={pending}>Revoke</Button>
      <span role="status" className={state.error ? "text-sm text-urgent" : "text-sm text-[#14583a]"}>
        {state.error ?? state.ok}
      </span>
    </form>
  );
}
