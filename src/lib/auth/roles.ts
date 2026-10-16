// Pure role logic, shared by server code and tests. The database (RLS) is the final authority;
// this module only decides which portal to show and which pages to guard.

export const ROLES = [
  "patient",
  "doctor",
  "nurse",
  "pharmacist",
  "pharmacy_admin",
  "courier",
  "support",
  "admin",
  "emergency_responder",
] as const;

export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export const ROLE_LABELS: Record<Role, string> = {
  patient: "Patient",
  doctor: "Doctor",
  nurse: "Nurse",
  pharmacist: "Pharmacist",
  pharmacy_admin: "Pharmacy administrator",
  courier: "Delivery partner",
  support: "Support",
  admin: "Administrator",
  emergency_responder: "Emergency responder",
};

export type PortalKey = "account" | "care" | "pharmacy" | "courier" | "emergency" | "ops";

export type Portal = { key: PortalKey; href: string; label: string; roles: readonly Role[] };

export const PORTALS: readonly Portal[] = [
  { key: "ops", href: "/ops", label: "Operations", roles: ["admin", "support"] },
  { key: "care", href: "/portal/care", label: "Clinician portal", roles: ["doctor", "nurse"] },
  { key: "pharmacy", href: "/portal/pharmacy", label: "Pharmacy portal", roles: ["pharmacist", "pharmacy_admin"] },
  { key: "courier", href: "/portal/courier", label: "Delivery portal", roles: ["courier"] },
  { key: "emergency", href: "/portal/emergency", label: "Emergency operations", roles: ["emergency_responder"] },
  { key: "account", href: "/account", label: "My account", roles: ["patient"] },
] as const;

/** Portals a user may open, most privileged first. */
export function portalsFor(roles: readonly Role[]): Portal[] {
  return PORTALS.filter((p) => p.roles.some((r) => roles.includes(r)));
}

/** Where to send someone right after sign-in. */
export function homeFor(roles: readonly Role[]): string {
  return portalsFor(roles)[0]?.href ?? "/account";
}

export function canAccess(roles: readonly Role[], allowed: readonly Role[]): boolean {
  return allowed.some((r) => roles.includes(r));
}

/** Only allow same-site relative redirects after sign-in (prevents open redirects). */
export function safeNextPath(next: unknown): string | null {
  if (typeof next !== "string") return null;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  if (/[\r\n]/.test(next)) return null;
  return next;
}
