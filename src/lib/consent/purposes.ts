export const CONSENT_PURPOSES = {
  terms_of_service: { label: "Terms of service", required: true },
  privacy_notice: { label: "Privacy notice", required: true },
  health_data_processing: { label: "Processing of health information for the services I use", required: false },
  location_for_matching: { label: "Using my location to match me with nearby care", required: false },
  marketing_messages: { label: "Occasional service news by SMS or email", required: false },
  analytics: { label: "Anonymous usage analytics to improve MedTRANS", required: false },
} as const;

export type ConsentPurpose = keyof typeof CONSENT_PURPOSES;

export const OPTIONAL_PURPOSES = (Object.keys(CONSENT_PURPOSES) as ConsentPurpose[]).filter(
  (p) => !CONSENT_PURPOSES[p].required,
);

export function isConsentPurpose(v: unknown): v is ConsentPurpose {
  return typeof v === "string" && v in CONSENT_PURPOSES;
}
