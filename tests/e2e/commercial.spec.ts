import { expect, test, type Browser, type Page } from "@playwright/test";
import { PHONES, signIn } from "./helpers";

test.describe.configure({ mode: "serial" });

async function as(browser: Browser, phone: string, path: string): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await signIn(page, phone, path);
  return page;
}

test("a pharmacy can apply to join; the licence number is required", async ({ page }) => {
  await page.goto("/join/pharmacy");
  await expect(page.getByText("cannot sell, until every check is complete")).toBeVisible();
  await page.getByLabel("Pharmacy name (as licensed)").fill("E2E Applicant Chemist");
  await page.getByLabel("Contact person").fill("Synthetic Applicant");
  await page.getByLabel("Phone").fill("0712 000 111");
  await page.getByRole("checkbox", { name: /storing these details/ }).check();
  await page.getByRole("button", { name: "Send application" }).click();
  await expect(page.getByText("Enter the pharmacy's Pharmacy and Poisons Board premises licence number.")).toBeVisible();
  await expect(page.getByLabel("Pharmacy name (as licensed)")).toHaveValue("E2E Applicant Chemist");
  await page.getByLabel("PPB premises licence number").fill("PPB/E2E/0001");
  await page.getByRole("checkbox", { name: /storing these details/ }).check();
  await page.getByRole("button", { name: "Send application" }).click();
  await expect(page.getByText(/Application received/)).toBeVisible();
});

test("an organisation can apply; with no confirmed plans, none are shown", async ({ page }) => {
  await page.goto("/partnerships");
  await expect(page.getByText("Partnership terms are agreed individually")).toBeVisible();
  await page.getByLabel("Organisation name").fill("E2E Employer Ltd");
  await page.getByLabel("Contact person").fill("Synthetic HR Lead");
  await page.getByLabel("Email").fill("hr-e2e@example.test");
  await page.getByRole("checkbox", { name: /storing these details/ }).check();
  await page.getByRole("button", { name: "Send application" }).click();
  await expect(page.getByText(/Application received/)).toBeVisible();
});

test("operations review applications", async ({ browser }) => {
  const admin = await as(browser, PHONES.admin, "/ops/applications");
  const item = admin.locator("li", { hasText: "E2E Applicant Chemist" }).first();
  await expect(item.getByText("PPB/E2E/0001")).toBeVisible();
  await item.getByLabel("Status").selectOption("in_review");
  await item.getByRole("button", { name: "Save" }).click();
  await expect(admin.locator("li", { hasText: "E2E Applicant Chemist" }).first().locator("span", { hasText: /^in review$/ })).toBeVisible();
  await admin.context().close();
});

test("an article cannot be published without a named clinical reviewer", async ({ browser }) => {
  const admin = await as(browser, PHONES.admin, "/ops/articles");
  const form = admin.locator("form", { has: admin.locator("#t-new") });
  await form.getByLabel("Title").fill("Storing medicines safely at home (E2E)");
  await form.getByLabel("Summary").fill("Where to keep medicines so they stay safe and effective.");
  await form.getByLabel(/Article text/).fill("Keep medicines in a cool, dry place out of children's reach.\n\nCheck expiry dates and return unused medicines to a pharmacy. Synthetic E2E text.");
  await form.getByRole("checkbox", { name: "Published" }).check();
  await form.getByRole("button", { name: "Save article" }).click();
  await expect(admin.getByText("To publish, record the reviewing clinician")).toBeVisible();

  await admin.goto("/resources");
  await expect(admin.getByText("Storing medicines safely at home (E2E)")).toHaveCount(0);

  await admin.goto("/ops/articles");
  const form2 = admin.locator("form", { has: admin.locator("#t-new") });
  await form2.getByLabel("Title").fill("Storing medicines safely at home (E2E)");
  await form2.getByLabel("Summary").fill("Where to keep medicines so they stay safe and effective.");
  await form2.getByLabel(/Article text/).fill("Keep medicines in a cool, dry place out of children's reach.\n\nCheck expiry dates and return unused medicines to a pharmacy. Synthetic E2E text.");
  await form2.getByLabel("Reviewer name").fill("Dr Synthetic Reviewer");
  await form2.getByLabel("Credentials").fill("MBChB (synthetic)");
  await form2.getByLabel("Review date").fill("2026-10-01");
  await form2.getByRole("checkbox", { name: "Published" }).check();
  await form2.getByRole("button", { name: "Save article" }).click();
  await expect(admin.getByRole("link", { name: "View" }).first()).toBeVisible();
  await admin.context().close();
});

test("published articles show their reviewer, and are in the sitemap", async ({ page, request }) => {
  await page.goto("/resources");
  await page.getByRole("link", { name: "Storing medicines safely at home (E2E)" }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Storing medicines safely at home (E2E)" })).toBeVisible();
  await expect(page.getByText("Dr Synthetic Reviewer")).toBeVisible();
  await expect(page.getByText("This is general information")).toBeVisible();
  const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(ld.some((t) => t.includes('"MedicalWebPage"'))).toBe(true);

  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/resources</loc>");
  expect(sitemap).toContain("/resources/storing-medicines-safely-at-home-e2e");
  expect(sitemap).toContain("/pharmacies/");
  expect(sitemap).not.toContain("/checkout");
});

test("a plan without a confirmed price cannot be shown publicly", async ({ browser }) => {
  const admin = await as(browser, PHONES.admin, "/ops/plans");
  await admin.getByLabel("Plan name").fill("E2E Pharmacy Starter");
  await admin.getByLabel("Summary").fill("Synthetic plan for testing only.");
  await admin.getByRole("button", { name: "Save plan (inactive)" }).click();
  const row = admin.locator("li", { hasText: "E2E Pharmacy Starter" }).first();
  await expect(row.getByText("Price not confirmed")).toBeVisible();
  await expect(row.getByRole("button", { name: "Show" })).toBeDisabled();
  await admin.context().close();
});

test("settlements refuse to run until commission rates are confirmed; analytics load", async ({ browser }) => {
  const admin = await as(browser, PHONES.admin, "/ops/settlements");
  await expect(admin.getByText("Commission rates are not confirmed")).toBeVisible();
  await admin.getByRole("button", { name: "Calculate draft settlements" }).click();
  await expect(admin.getByText(/commission rates have not been confirmed/)).toBeVisible();
  await admin.goto("/ops/analytics");
  await expect(admin.getByRole("heading", { name: "Analytics" })).toBeVisible();
  await expect(admin.getByRole("heading", { name: "Pharmacy" })).toBeVisible();
  await admin.context().close();
});

test("pharmacy staff and clinicians see their own settlements page", async ({ browser }) => {
  const ph = await as(browser, PHONES.pharmacyManager, "/portal/pharmacy/settlements");
  await expect(ph.getByRole("heading", { name: /Settlements/ })).toBeVisible();
  await ph.context().close();
  const doc = await as(browser, PHONES.doctor, "/portal/care/earnings");
  await expect(doc.getByRole("heading", { name: /Earnings|Settlements/ })).toBeVisible();
  await doc.context().close();
});

test("patients cannot open the commercial back office", async ({ browser }) => {
  const p = await as(browser, PHONES.patient2, "/account");
  for (const path of ["/ops/settlements", "/ops/applications", "/ops/articles", "/ops/analytics"]) {
    const res = await p.goto(path);
    expect(res?.status()).toBe(403);
  }
  await p.context().close();
});
