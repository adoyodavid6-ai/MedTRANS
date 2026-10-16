import "server-only";
import { cache } from "react";
import { forbidden, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canAccess, isRole, type Role } from "./roles";

export type SessionUser = {
  id: string;
  email: string | null;
  phone: string | null;
  roles: Role[];
};

/**
 * The signed-in user, verified with the auth server (not just decoded from a cookie),
 * plus their active roles from the database. Deduplicated per request.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const { data: roleRows, error: rolesError } = await supabase.rpc("my_roles");
  if (rolesError) throw new Error("Could not load account roles.");

  const roles = ((roleRows as unknown[] | null) ?? []).filter(isRole);
  return {
    id: data.user.id,
    email: data.user.email ?? null,
    phone: data.user.phone ? `+${data.user.phone.replace(/^\+/, "")}` : null,
    roles,
  };
});

/** Require a signed-in user; otherwise send them to sign in and back. */
export async function requireUser(returnTo: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(returnTo)}`);
  return user;
}

/** Require one of `allowed`. Renders the 403 page otherwise. Use in pages, layouts AND server actions. */
export async function requireRole(allowed: readonly Role[], returnTo: string): Promise<SessionUser> {
  const user = await requireUser(returnTo);
  if (!canAccess(user.roles, allowed)) forbidden();
  return user;
}

/**
 * Signed-in area guard: requires a user who has accepted the required policies.
 * Use for every page under /account, /portal and /ops.
 */
export async function requireAccount(returnTo: string, allowed?: readonly Role[]): Promise<SessionUser> {
  const user = allowed ? await requireRole(allowed, returnTo) : await requireUser(returnTo);
  const { hasAcceptedRequiredPolicies } = await import("@/lib/consent/server");
  if (!(await hasAcceptedRequiredPolicies())) redirect(`/welcome?next=${encodeURIComponent(returnTo)}`);
  return user;
}
