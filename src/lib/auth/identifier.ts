// Parses what someone types into the sign-in box: a mobile number or an email address.

export type Identifier = { kind: "phone"; e164: string } | { kind: "email"; email: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Normalises a phone number to E.164. Kenyan local formats (07…, 01…) are accepted
 * because Nairobi is the pilot; other countries must use the +country form.
 */
export function normalisePhone(raw: string): string | null {
  const compact = raw.replace(/[\s().-]/g, "");
  let digits: string;
  if (/^\+\d+$/.test(compact)) digits = compact.slice(1);
  else if (/^00\d+$/.test(compact)) digits = compact.slice(2);
  else if (/^0[17]\d{8}$/.test(compact)) digits = `254${compact.slice(1)}`;
  else if (/^254[17]\d{8}$/.test(compact)) digits = compact;
  else return null;

  if (digits.startsWith("254") && !/^254[17]\d{8}$/.test(digits)) return null;
  if (digits.length < 8 || digits.length > 15 || digits.startsWith("0")) return null;
  return `+${digits}`;
}

export function parseIdentifier(raw: string): Identifier | null {
  const value = raw.trim();
  if (value.includes("@")) {
    const email = value.toLowerCase();
    return EMAIL.test(email) && email.length <= 254 ? { kind: "email", email } : null;
  }
  const e164 = normalisePhone(value);
  return e164 ? { kind: "phone", e164 } : null;
}

/** Partially hides an identifier for display ("+2547•••••001", "a•••@example.com"). */
export function maskIdentifier(id: Identifier): string {
  if (id.kind === "email") {
    const [local, domain] = id.email.split("@");
    return `${local.slice(0, 1)}•••@${domain}`;
  }
  return `${id.e164.slice(0, 5)}•••••${id.e164.slice(-3)}`;
}
