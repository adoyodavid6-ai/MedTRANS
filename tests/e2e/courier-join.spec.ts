import { expect, test, type Browser, type Page } from "@playwright/test";
import { PHONES, signIn } from "./helpers";

test.describe.configure({ mode: "serial" });

async function as(browser: Browser, phone: string, path: string): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await signIn(page, phone, path);
  return page;
}

test("the delivery partner page asks visitors to sign in first", async ({ page }) => {
  await page.goto("/join/courier");
  await expect(page.getByRole("heading", { level: 1, name: "Deliver with MedTRANS" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in or create an account" })).toBeVisible();
});

test("a person applies, operations verify them, and they get the delivery portal", async ({ browser }) => {
  const applicant = await as(browser, PHONES.nurse, "/join/courier");
  await applicant.getByLabel("How will you deliver?").selectOption("motorbike");
  await applicant.getByLabel("Area you can cover").fill("Westlands (E2E)");
  await applicant.getByRole("checkbox", { name: /details are accurate/ }).check();
  await applicant.getByRole("button", { name: "Apply to deliver" }).click();
  await expect(applicant.getByText("A driving licence number is needed for motorbike or car deliveries.")).toBeVisible();
  await expect(applicant.getByLabel("Area you can cover")).toHaveValue("Westlands (E2E)");
  await applicant.getByLabel(/Driving licence number/).fill("DL-E2E-0001");
  await applicant.getByRole("checkbox", { name: /details are accurate/ }).check();
  await applicant.getByRole("button", { name: "Apply to deliver" }).click();
  await expect(applicant.getByText("Application received")).toBeVisible();
  expect((await applicant.goto("/portal/courier"))?.status()).toBe(403);

  const admin = await as(browser, PHONES.admin, "/ops/couriers");
  const row = admin.locator("li", { hasText: "DL-E2E-0001" });
  await expect(row.getByText(/Motorbike · licence DL-E2E-0001 · covers Westlands \(E2E\)/)).toBeVisible();
  await row.getByLabel("Status").selectOption("verified");
  await row.getByLabel("How identity was checked").fill("National ID and licence seen in person (synthetic)");
  await row.getByRole("checkbox").check();
  await row.getByRole("button", { name: "Save" }).click();
  await expect(admin.locator("li", { hasText: "DL-E2E-0001" }).getByText("Checked: National ID")).toBeVisible();
  await admin.context().close();

  await applicant.goto("/join/courier");
  await expect(applicant.getByRole("link", { name: "Open your delivery portal" })).toBeVisible();
  expect((await applicant.goto("/portal/courier"))?.status()).toBe(200);
  await applicant.context().close();
});
