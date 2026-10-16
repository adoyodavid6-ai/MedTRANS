import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PAGES = ["/", "/emergency", "/coverage", "/sign-in", "/how-it-works", "/help", "/contact", "/pharmacy", "/legal/privacy", "/pharmacy/medicines", "/pharmacy/medicines/amoxicillin-500mg-capsules", "/pharmacies", "/doctorcare", "/doctorcare/services/gp-home-visit", "/find-a-doctor", "/smartcare/map", "/join/provider", "/join/pharmacy", "/join/courier", "/partnerships", "/resources"];

for (const path of PAGES) {
  test(`${path} has no WCAG 2.2 A/AA violations`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
  });
}
