import { afterEach, describe, expect, it, vi } from "vitest";
import { isTestGatewayEnabled } from "@/lib/payments/test-gateway";

describe("test payment gateway guard", () => {
  afterEach(() => vi.unstubAllEnvs());
  const enable = (site: string) => {
    vi.stubEnv("PAYMENTS_TEST_MODE", "enabled");
    vi.stubEnv("PAYMENTS_TEST_WEBHOOK_SECRET", "s");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", site);
  };
  it("is available on a local site", () => {
    enable("http://localhost:3100");
    expect(isTestGatewayEnabled()).toBe(true);
  });
  it("is never available on a real domain, even if switched on by mistake", () => {
    enable("https://medtrans.example");
    expect(isTestGatewayEnabled()).toBe(false);
  });
  it("is never available in a Vercel production deployment", () => {
    enable("http://localhost:3000");
    vi.stubEnv("VERCEL_ENV", "production");
    expect(isTestGatewayEnabled()).toBe(false);
  });
});
