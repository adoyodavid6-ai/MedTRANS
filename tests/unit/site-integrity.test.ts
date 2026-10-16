import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FOOTER_NAV, MAIN_NAV, NAV_GROUPS, PUBLIC_ROUTES, UTILITY_NAV, type PublicRoute } from "@/lib/site/routes";

const ROUTES: readonly PublicRoute[] = PUBLIC_ROUTES;

const APP = join(process.cwd(), "src/app");
const pageFile = (href: string) => join(APP, href === "/" ? "" : href, "page.tsx");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe("route registry (§21: every nav item reaches a page)", () => {
  it("has no duplicate routes", () => {
    const hrefs = PUBLIC_ROUTES.map((r) => r.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it.each(PUBLIC_ROUTES.map((r) => [r.href, r] as const))("%s has a page file", (href) => {
    expect(() => readFileSync(pageFile(href))).not.toThrow();
  });

  it("planned pages show the not-yet-activated state", () => {
    for (const r of ROUTES.filter((x) => x.status === "planned")) {
      expect(readFileSync(pageFile(r.href), "utf8")).toContain(`<NotYetActivated href="${r.href}" />`);
    }
  });

  it("nav only links to registered routes", () => {
    const known = new Set<string>(PUBLIC_ROUTES.map((r) => r.href));
    for (const item of [...MAIN_NAV, ...UTILITY_NAV, ...NAV_GROUPS.flatMap((g) => g.links), ...FOOTER_NAV.flatMap((g) => g.links)]) expect(known.has(item.href)).toBe(true);
  });
});

describe("honesty guards (§3)", () => {
  const sources = walk(join(process.cwd(), "src")).filter((f) => /\.(tsx?|css)$/.test(f));

  it("hardcodes no emergency numbers — they come only from verified database rows", () => {
    for (const f of sources) {
      const text = readFileSync(f, "utf8");
      expect(text, f).not.toMatch(/tel:\s*["'`]?\+?\d/);
      expect(text, f).not.toMatch(/["'`>\s](999|112|911|1199|0800 ?723 ?253)["'`<\s.]/);
    }
  });

  it("contains no star ratings, review counts or testimonials", () => {
    for (const f of sources) {
      const text = readFileSync(f, "utf8");
      expect(text, f).not.toMatch(/★|\b\d(\.\d)? ?\/ ?5\b|\b\d[\d,]* (happy )?(patients|customers|reviews)\b/i);
    }
  });
});
