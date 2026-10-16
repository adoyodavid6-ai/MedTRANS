import { expect, test } from "@playwright/test";
import { PUBLIC_ROUTES, type PublicRoute } from "../../src/lib/site/routes";

test("the three core actions are visible without scrolling", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Healthcare that comes to you." })).toBeVisible();
  const viewport = page.viewportSize()!;
  for (const name of ["Order Medicines", "Request Home Care", "Get Urgent Medical Help"]) {
    const link = page.getByRole("main").getByRole("link", { name });
    await expect(link).toBeVisible();
    const box = (await link.boundingBox())!;
    expect(box.y + box.height, `${name} is above the fold`).toBeLessThanOrEqual(viewport.height);
    expect(box.height, `${name} is a large touch target`).toBeGreaterThanOrEqual(44);
  }
  await expect(page.getByRole("banner").getByRole("link", { name: "Emergency Help" })).toBeVisible();
});

test("every main nav item reaches a real page", async ({ page }) => {
  for (const href of ["/pharmacy", "/doctorcare", "/find-a-doctor", "/pharmacies", "/how-it-works", "/emergency", "/help"]) {
    const res = await page.goto(href);
    expect(res?.status(), href).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
});

test("planned services say plainly that they are not yet activated", async ({ page }) => {
  const planned = (PUBLIC_ROUTES as readonly PublicRoute[]).find((r) => r.status === "planned");
  test.skip(!planned, "every route is live");
  await page.goto(planned!.href);
  await expect(page.getByText("Not yet activated")).toBeVisible();
  await expect(page.getByText("This service is not available yet")).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("location can be set by typing when location access is unavailable", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("main").getByRole("button", { name: "Set your location" }).click();
  const dialog = page.locator("dialog[open]");
  await dialog.getByLabel("Or type your area").fill("Westlands, near Sarit");
  await dialog.getByRole("button", { name: "Use this location" }).click();
  await expect(page.getByRole("main").getByRole("button", { name: "Westlands, near Sarit" })).toBeVisible();
});

test("unknown pages return a helpful 404", async ({ page }) => {
  const res = await page.goto("/no-such-page");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "We couldn't find that page" })).toBeVisible();
});

test("public pages never scroll sideways on a phone", async ({ page }) => {
  for (const path of ["/", "/emergency", "/coverage", "/sign-in", "/pharmacy", "/how-it-works", "/help", "/contact"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
