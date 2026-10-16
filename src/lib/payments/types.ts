export type PaymentProvider = "mpesa" | "test";

export type InitiateInput = {
  paymentId: string;
  orderNumber: string;
  amountMinor: number;
  currency: string;
  payerPhone: string | null;
};

export type InitiateResult =
  | { ok: true; providerReference: string; customerMessage: string }
  | { ok: false; reason: string };

export interface PaymentGateway {
  provider: PaymentProvider;
  /** Label shown to patients. */
  label: string;
  /** Whether a phone number is required to pay. */
  needsPhone: boolean;
  initiate(input: InitiateInput): Promise<InitiateResult>;
}

/** A provider outcome after the callback has been authenticated and, where possible, confirmed with the provider. */
export type VerifiedOutcome = {
  provider: PaymentProvider;
  eventKey: string;
  payloadSha256: string;
  providerReference: string;
  success: boolean;
  amountMinor: number | null;
  receipt: string | null;
  reason: string | null;
};
