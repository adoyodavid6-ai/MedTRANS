import { expect, test, type Browser, type Page } from "@playwright/test";
import { PHONES, signIn } from "./helpers";

test.describe.configure({ mode: "serial" });

async function as(browser: Browser, phone: string, path: string): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await signIn(page, phone, path);
  return page;
}

test("pages are served with a restrictive security policy", async ({ request }) => {
  const res = await request.get("/");
  const h = res.headers();
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["content-security-policy"]).toContain("object-src 'none'");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["x-powered-by"]).toBeUndefined();
});

test("the data export needs a signed-in account", async ({ request }) => {
  const res = await request.post("/account/privacy/export");
  expect(res.status()).toBe(401);
});

test("a staff member's export holds only their own records", async ({ browser }) => {
  const page = await as(browser, PHONES.pharmacist, "/account/privacy");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download my data" }).click()]);
  expect(download.suggestedFilename()).toMatch(/^medtrans-my-data-\d{4}-\d{2}-\d{2}\.json$/);
  const data = JSON.parse(await (await download.createReadStream()).toArray().then((c) => Buffer.concat(c).toString("utf8")));
  expect(data.profile.id).toBeTruthy();
  for (const o of data.pharmacy.orders) expect(o.patient_id).toBe(data.profile.id);
  for (const m of data.support.messages) expect(m.is_internal).toBeUndefined();
  await page.reload();
  await expect(page.getByText(/Last downloaded/)).toBeVisible();
  await page.context().close();
});

test("a patient can ask for deletion, operations see what would be kept, and the patient can withdraw", async ({ browser }) => {
  const patient = await as(browser, PHONES.patient2, "/account/privacy");
  await patient.getByRole("button", { name: "Ask us to delete my account" }).click();
  await expect(patient.getByText("Tick the box to confirm")).toBeVisible();
  await patient.getByRole("checkbox", { name: /records the law requires/ }).check();
  await patient.getByLabel(/Anything you'd like us to know/).fill("Synthetic E2E request");
  await patient.getByRole("button", { name: "Ask us to delete my account" }).click();
  await expect(patient.getByText("We have your deletion request")).toBeVisible();

  const admin = await as(browser, PHONES.admin, "/ops/data-requests");
  const item = admin.locator("li", { hasText: "Synthetic E2E request" }).first();
  await expect(item.getByText(/Will retain:/)).toBeVisible();
  await expect(item.getByRole("button", { name: "Complete erasure" })).toBeVisible();
  await admin.context().close();

  await patient.getByRole("button", { name: "Withdraw my request" }).click();
  await expect(patient.getByRole("button", { name: "Ask us to delete my account" })).toBeVisible();
  await expect(patient.getByText(/Your last request was declined/)).toBeVisible();
  await patient.context().close();
});
