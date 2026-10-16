import { describe, expect, it } from "vitest";
import { canAccess, homeFor, isRole, portalsFor, safeNextPath } from "@/lib/auth/roles";

describe("roles", () => {
  it("recognises only known roles", () => {
    expect(isRole("admin")).toBe(true);
    expect(isRole("superuser")).toBe(false);
    expect(isRole(null)).toBe(false);
  });

  it("sends each role to its own portal", () => {
    expect(homeFor(["patient"])).toBe("/account");
    expect(homeFor(["patient", "doctor"])).toBe("/portal/care");
    expect(homeFor(["patient", "pharmacist"])).toBe("/portal/pharmacy");
    expect(homeFor(["patient", "courier"])).toBe("/portal/courier");
    expect(homeFor(["patient", "admin"])).toBe("/ops");
    expect(homeFor([])).toBe("/account");
  });

  it("never offers a portal a role doesn't hold", () => {
    const keys = portalsFor(["patient", "courier"]).map((p) => p.key);
    expect(keys).toEqual(["courier", "account"]);
    expect(keys).not.toContain("ops");
    expect(keys).not.toContain("care");
  });

  it("checks access by intersection", () => {
    expect(canAccess(["patient"], ["admin"])).toBe(false);
    expect(canAccess(["patient", "support"], ["admin", "support"])).toBe(true);
  });
});

describe("safeNextPath (open-redirect protection)", () => {
  it.each([
    ["/account", "/account"],
    ["/ops/users?q=x", "/ops/users?q=x"],
  ])("allows same-site path %s", (input, out) => expect(safeNextPath(input)).toBe(out));

  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "", "/a\r\nSet-Cookie: x", null, 42])(
    "rejects %s",
    (input) => expect(safeNextPath(input)).toBeNull(),
  );
});
