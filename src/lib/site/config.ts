/**
 * Values MedTRANS does not have yet. Each is null with its checklist token, never a guess.
 * The UI renders an honest fallback (see <Pending />); in development the token is shown too.
 * Every token here is also listed in docs/SETUP-CHECKLIST.md.
 */
export type Confirmable<T> = { value: T | null; token: string };

const pending = <T,>(token: string): Confirmable<T> => ({ value: null, token });

export const site = {
  name: "MedTRANS",
  promise: "Healthcare, delivered with care.",
  tagline: "Your medicine. Your doctor. Your care, wherever you are.",
  pilot: { city: "Nairobi", country: "Kenya", countryCode: "KE" },
  business: {
    legalName: pending<string>("[[CONFIRM: registered business name]]"),
    address: pending<string>("[[CONFIRM: registered business address]]"),
    registrationNumber: pending<string>("[[CONFIRM: business registration number]]"),
  },
  support: {
    email: pending<string>("[[CONFIRM: support email]]"),
    phone: pending<string>("[[CONFIRM: support phone]]"),
    hours: pending<string>("[[CONFIRM: support hours]]"),
  },
  dataProtectionOfficer: pending<string>("[[CONFIRM: Data Protection Officer contact]]"),
  appLinks: {
    ios: pending<string>("[[CONFIRM: App Store link — only once a real app is published]]"),
    android: pending<string>("[[CONFIRM: Google Play link — only once a real app is published]]"),
  },
} as const;
