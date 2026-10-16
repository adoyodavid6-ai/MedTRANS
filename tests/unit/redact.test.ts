import { describe, expect, it } from "vitest";
import { redactMessage, redactPath } from "@/lib/monitoring/redact";

describe("monitoring redaction", () => {
  it("removes query strings, private tokens and record ids from paths", () => {
    expect(redactPath("/support/0123456789abcdef0123456789abcdef0123456789abcdef?new=1")).toBe("/support/:token");
    expect(redactPath("/orders/3f2b8c1e-1d2a-4c3b-9a8b-1234567890ab")).toBe("/orders/:id");
    expect(redactPath("/pharmacy/medicines?q=insulin")).toBe("/pharmacy/medicines");
  });
  it("masks phone numbers and email addresses in messages", () => {
    expect(redactMessage("failed for +254 712 345 678 and jane@example.com")).toBe("failed for [number] and [email]");
    expect(redactMessage("x".repeat(500))).toHaveLength(300);
  });
});
