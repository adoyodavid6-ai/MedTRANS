import "server-only";
import { mpesaConfig, mpesaGateway } from "./mpesa";
import { isTestGatewayEnabled, testGateway } from "./test-gateway";
import type { PaymentGateway, PaymentProvider } from "./types";

/** Gateways that are genuinely configured right now. Empty means payments are not activated. */
export function availableGateways(): PaymentGateway[] {
  const out: PaymentGateway[] = [];
  if (mpesaConfig()) out.push(mpesaGateway);
  if (isTestGatewayEnabled()) out.push(testGateway);
  return out;
}

export function gatewayFor(provider: PaymentProvider): PaymentGateway | null {
  return availableGateways().find((g) => g.provider === provider) ?? null;
}
