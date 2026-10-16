import { describe, expect, it } from "vitest";
import { maskIdentifier, normalisePhone, parseIdentifier } from "@/lib/auth/identifier";

describe("normalisePhone", () => {
  it.each([
    ["0712345678", "+254712345678"],
    ["0712 345 678", "+254712345678"],
    ["0112345678", "+254112345678"],
    ["+254 712 345 678", "+254712345678"],
    ["254712345678", "+254712345678"],
    ["00254712345678", "+254712345678"],
    ["+252 61 234 5678", "+252612345678"],
  ])("normalises %s", (input, out) => expect(normalisePhone(input)).toBe(out));

  it.each(["0812345678", "071234567", "+254812345678", "+2547123456789", "12345", "phone", "+0123456789"])("rejects %s", (input) =>
    expect(normalisePhone(input)).toBeNull(),
  );
});

describe("parseIdentifier", () => {
  it("parses email, lower-cased", () => expect(parseIdentifier(" Jane@Example.COM ")).toEqual({ kind: "email", email: "jane@example.com" }));
  it("parses phone", () => expect(parseIdentifier("0712345678")).toEqual({ kind: "phone", e164: "+254712345678" }));
  it("rejects junk", () => {
    expect(parseIdentifier("not-an-email@")).toBeNull();
    expect(parseIdentifier("")).toBeNull();
  });
  it("masks for display", () => {
    expect(maskIdentifier({ kind: "phone", e164: "+254712345678" })).toBe("+2547•••••678");
    expect(maskIdentifier({ kind: "email", email: "jane@example.com" })).toBe("j•••@example.com");
  });
});
