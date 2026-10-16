import { expect, test, type Browser, type Page } from "@playwright/test";
import { PHONES, signIn } from "./helpers";

/**
 * Masterplan §22-A, end to end in the browser with four separate people:
 * search → verified pharmacy → prescription upload → pharmacist review → checkout (server totals)
 * → server-confirmed payment → pharmacy accepts & prepares → courier assigned → delivered with the handover code.
 */
test.describe.configure({ mode: "serial" });

async function as(browser: Browser, phone: string, path: string): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await signIn(page, phone, path);
  return page;
}

let orderUrl = "";

test("patient: search, add prescription and OTC items, upload a prescription", async ({ browser }) => {
  const page = await as(browser, PHONES.patient2, "/pharmacy/medicines");
  await page.goto("/pharmacy/medicines?q=amoxicillin");
  await expect(page.getByRole("heading", { name: "Prescription only" })).toBeVisible();
  await page.getByRole("link", { name: "Amoxicillin 500 mg capsules" }).click();
  await expect(page.getByText("Prescription needed")).toBeVisible();
  await expect(page.getByText("Verified", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Add to cart/ }).click();
  await expect(page.getByText("Added to your cart.")).toBeVisible();

  await page.goto("/pharmacy/medicines/paracetamol-500mg-tablets");
  await page.getByRole("button", { name: /Add to cart/ }).click();
  await expect(page.getByText("Added to your cart.")).toBeVisible();

  // Controlled medicines can't be bought at all
  await page.goto("/pharmacy/medicines/tramadol-50mg-capsules");
  await expect(page.getByText("Not available through MedTRANS", { exact: true }).last()).toBeVisible();
  await expect(page.getByRole("button", { name: /Add to cart/ })).toHaveCount(0);

  await page.goto("/cart");
  await expect(page.getByText("Checkout opens once everything above is resolved.")).toBeVisible();

  // A file that isn't really a PDF is refused by its contents
  await page.getByLabel("Photo or PDF of your prescription").setInputFiles("tests/e2e/fixtures/fake.pdf");
  await page.getByRole("checkbox", { name: /I consent to MedTRANS storing this prescription/ }).check();
  await page.getByRole("button", { name: "Send to pharmacist" }).click();
  await expect(page.getByText("Upload a JPG, PNG or WebP photo, or a PDF.")).toBeVisible();

  await page.getByLabel("Photo or PDF of your prescription").setInputFiles("tests/e2e/fixtures/synthetic-prescription.pdf");
  await page.getByRole("checkbox", { name: /I consent to MedTRANS storing this prescription/ }).check();
  await page.getByRole("button", { name: "Send to pharmacist" }).click();
  await expect(page.getByText("Waiting for pharmacist review")).toBeVisible();
  await page.context().close();
});

test("non-pharmacist staff and other patients cannot see the prescription", async ({ browser }) => {
  const manager = await as(browser, PHONES.pharmacyManager, "/portal/pharmacy/prescriptions");
  await expect(manager.getByText("Only verified pharmacists can review prescriptions")).toBeVisible();
  await manager.context().close();
  const other = await as(browser, PHONES.doctor, "/account/prescriptions");
  await other.goto("/account/prescriptions");
  await expect(other.getByText("No prescriptions yet")).toBeVisible();
  await other.context().close();
});

test("pharmacist: reviews the file and approves", async ({ browser }) => {
  const page = await as(browser, PHONES.pharmacist, "/portal/pharmacy/prescriptions");
  await page.getByRole("link", { name: /Prescription received/ }).first().click();
  const href = (await page.getByRole("link", { name: /Open the prescription file/ }).getAttribute("href"))!;
  const res = await page.request.get(href, { maxRedirects: 0 });
  expect(res.status(), "file route redirects to a signed link").toBe(307);
  const signed = res.headers()["location"];
  expect(signed).toContain("/storage/v1/object/sign/prescriptions/");
  const pdf = await page.request.get(signed);
  expect(pdf.status()).toBe(200);
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");

  // Someone else asking for the same file gets nothing.
  const other = await as(browser, PHONES.courier, "/portal/courier");
  expect((await other.request.get(href, { maxRedirects: 0 })).status()).toBe(404);
  await other.context().close();

  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByText("Approved by pharmacist").first()).toBeVisible();
  await expect(page.getByText("approved 1")).toBeVisible();
  await page.context().close();
});

test("patient: checks out with server-computed totals and pays", async ({ browser }) => {
  const page = await as(browser, PHONES.patient2, "/cart");
  await expect(page.getByText("A pharmacist approved your prescription")).toBeVisible();
  await page.getByRole("link", { name: "Continue to checkout" }).click();
  // 450.00 + 120.00 items, 150.00 delivery, 50.00 service fee, 0 VAT (synthetic seed values)
  await expect(page.getByRole("button", { name: /Place order · Ksh\s?770\.00/ })).toBeVisible();
  await page.getByRole("button", { name: /Place order/ }).click();
  await page.waitForURL(/\/orders\//);
  orderUrl = page.url();
  await expect(page.getByText("Awaiting payment").first()).toBeVisible();

  await page.getByRole("button", { name: /Pay Ksh\s?770\.00/ }).click();
  await expect(page.getByText("Waiting for payment confirmation")).toBeVisible();
  await page.getByRole("button", { name: "Simulate successful payment" }).click();
  await expect(page.getByText("Awaiting pharmacy acceptance").first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/Payment receipt: TESTRCPT-/)).toBeVisible();
  await page.context().close();
});

test("pharmacy: accepts, prepares and marks ready", async ({ browser }) => {
  const page = await as(browser, PHONES.pharmacist, "/portal/pharmacy/orders");
  for (const label of ["Accept order", "Start preparing", "Ready for dispatch"]) {
    await page.getByRole("button", { name: label }).first().click();
    await expect(page.getByText("Updated.").first()).toBeVisible();
    await page.reload();
  }
  await page.context().close();
});

test("admin: assigns a verified delivery partner", async ({ browser }) => {
  const page = await as(browser, PHONES.admin, "/ops/orders?status=ready_for_dispatch");
  await page.getByLabel("Delivery partner").first().selectOption({ label: "Test Courier" });
  await page.getByRole("button", { name: "Assign" }).first().click();
  await expect(page.getByText("No orders.")).toBeVisible();
  await page.goto("/ops/orders?status=assigned_to_courier");
  await expect(page.getByRole("listitem").getByText("Assigned to a delivery partner")).toBeVisible();
  // Operations never links to prescription files
  await expect(page.locator('a[href*="/prescriptions/"]')).toHaveCount(0);
  await page.context().close();
});

test("courier: sees no medicine names, collects, and needs the right code to deliver", async ({ browser }) => {
  const patient = await as(browser, PHONES.patient2, orderUrl.replace(/^https?:\/\/[^/]+/, ""));
  const code = (await patient.locator("p.font-mono").first().innerText()).trim();
  expect(code).toMatch(/^\d{4}$/);

  const page = await as(browser, PHONES.courier, "/portal/courier");
  await expect(page.getByText(/item/).first()).toBeVisible();
  await expect(page.getByText(/Amoxicillin|Paracetamol/)).toHaveCount(0);
  await page.getByRole("button", { name: /collected it from the pharmacy/ }).click();
  await expect(page.getByLabel("Recipient's handover code")).toBeVisible();

  const wrong = code === "0000" ? "1111" : "0000";
  await page.getByLabel("Recipient's handover code").fill(wrong);
  await page.getByRole("button", { name: "Confirm delivery" }).click();
  await expect(page.getByText("That code doesn't match.")).toBeVisible();
  await page.getByLabel("Recipient's handover code").fill(code);
  await page.getByRole("button", { name: "Confirm delivery" }).click();
  await expect(page.getByText("Updated.")).toBeVisible();

  await patient.reload();
  await expect(patient.getByText("Delivered").first()).toBeVisible();
  await expect(patient.getByText("Handover code confirmed.")).toBeAttached();
  await page.context().close();
  await patient.context().close();
});
