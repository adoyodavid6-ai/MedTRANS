import { expect, test } from "@playwright/test";

test("emergency guidance is immediate and honest", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("banner").getByRole("link", { name: "Emergency Help" }).click();
  await expect(page).toHaveURL(/\/emergency$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("contact local emergency services now");
  // No verified number is configured in the seed, so none is shown or invented.
  await expect(page.getByText("No verified number is listed yet")).toBeVisible();
  await expect(page.locator('a[href^="tel:"]')).toHaveCount(0);
  await expect(page.getByRole("main").getByText("MedTRANS is not an emergency service")).toBeVisible();
  // Nothing gates the guidance: no form fields on the page.
  await expect(page.locator("main input, main textarea, main select")).toHaveCount(0);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("guidance still renders", async ({ page }) => {
    await page.goto("/emergency");
    await expect(page.getByRole("heading", { name: "When you call, say:" })).toBeVisible();
  });
});

test("location is shown locally for reading out, not sent anywhere", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: -1.28333, longitude: 36.81667, accuracy: 25 });
  const leaks: string[] = [];
  page.on("request", (r) => {
    const payload = `${r.url()} ${r.postData() ?? ""}`;
    if (/-?1\.2833|36\.8166/.test(payload)) leaks.push(r.url());
  });
  await page.goto("/emergency");
  await page.getByRole("button", { name: "Show my location to read out" }).click();
  await expect(page.getByText("-1.28333, 36.81667")).toBeVisible();
  await page.waitForTimeout(500);
  expect(leaks, "no request carries the coordinates").toEqual([]);
});
