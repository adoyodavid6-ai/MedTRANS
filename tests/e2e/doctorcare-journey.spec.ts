import { expect, test, type Browser, type Page } from "@playwright/test";
import { PHONES, signIn } from "./helpers";

/** Masterplan §22-B and §22-C in the browser: patient, doctor and admin as separate people. */
test.describe.configure({ mode: "serial" });

async function as(browser: Browser, phone: string, path: string, opts: { geo?: { latitude: number; longitude: number } } = {}): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...(opts.geo ? { geolocation: opts.geo, permissions: ["geolocation"] } : {}) });
  const page = await ctx.newPage();
  await signIn(page, phone, path);
  return page;
}

async function walkToSafety(page: Page) {
  await page.goto("/doctorcare/book");
  await expect(page.getByRole("heading", { name: "Which service do you need?" })).toBeVisible();
  await page.getByRole("radio", { name: /GP home visit/ }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Who is the visit for?" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "A few safety questions first" })).toBeVisible();
}

let bookingUrl = "";

test("a red-flag answer stops the booking and goes to emergency guidance", async ({ browser }) => {
  const page = await as(browser, PHONES.patient2, "/account");
  await walkToSafety(page);
  const groups = page.getByRole("group").filter({ has: page.getByRole("radio", { name: "Yes" }) });
  const n = await groups.count();
  for (let i = 0; i < n; i++) await groups.nth(i).getByRole("radio", { name: i === 1 ? "Yes" : "No" }).check();
  await expect(page.getByText("This may be an emergency", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Get emergency guidance" }).click();
  await page.waitForURL(/\/emergency/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("contact local emergency services now");
  await page.context().close();
});

test("patient: requests a GP home visit with a verified doctor", async ({ browser }) => {
  const page = await as(browser, PHONES.patient2, "/account");
  await walkToSafety(page);
  const groups = page.getByRole("group").filter({ has: page.getByRole("radio", { name: "No" }) });
  const n = await groups.count();
  expect(n).toBeGreaterThan(5);
  for (let i = 0; i < n; i++) await groups.nth(i).getByRole("radio", { name: "No" }).check();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "Where should the professional come?" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "When would you like the visit?" })).toBeVisible();
  await page.getByRole("button", { name: "Tomorrow" }).click();
  await page.getByRole("radio", { name: "10:00" }).check();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "Choose a professional" })).toBeVisible();
  const doctor = page.getByRole("radio", { name: /Dr Test Doctor/ });
  await expect(doctor).toBeChecked();
  await expect(page.getByText("Nearest suitable")).toBeVisible();
  await expect(page.getByText(/about [\d.]+ k?m away/)).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "Check and confirm" })).toBeVisible();
  await page.getByLabel(/what do you need help with/).fill("Persistent cough for a few days (synthetic test)");
  // 2,500.00 visit fee + 200.00 booking fee (synthetic seed values)
  await expect(page.getByText(/Ksh\s?2,700\.00/)).toBeVisible();
  await page.getByRole("button", { name: "Send request" }).click();
  await page.waitForURL(/\/bookings\//);
  bookingUrl = page.url().replace(/^https?:\/\/[^/]+/, "");
  await expect(page.getByText("Waiting for the professional to accept").first()).toBeVisible();
  await page.context().close();
});

test("admin sees an operational view without clinical details", async ({ browser }) => {
  const page = await as(browser, PHONES.admin, "/ops/bookings");
  await expect(page.getByText("screening escalation")).toBeVisible();
  await expect(page.getByRole("listitem").getByText("Waiting for the professional to accept")).toBeVisible();
  await expect(page.getByText(/Persistent cough/)).toHaveCount(0);
  await page.context().close();
});

test("doctor: sees the request (area only) and accepts", async ({ browser }) => {
  const page = await as(browser, PHONES.doctor, "/portal/care");
  await expect(page.getByText(/Persistent cough/)).toBeVisible();
  await expect(page.getByText("Kilimani")).toBeVisible();
  await expect(page.getByText(/Test Estate, Ngong Road/)).toHaveCount(0);
  await page.getByRole("button", { name: "Accept visit" }).click();
  await expect(page.getByText("No requests right now")).toBeVisible();
  await page.goto("/portal/care/visits");
  await expect(page.getByText("Accepted: pay to confirm")).toBeVisible();
  await expect(page.getByText("The address appears once the patient has paid to confirm.")).toBeVisible();
  await page.context().close();
});

test("patient: pays to confirm", async ({ browser }) => {
  const page = await as(browser, PHONES.patient2, bookingUrl);
  await expect(page.getByText("Accepted: pay to confirm").first()).toBeVisible();
  await expect(page.getByText(/KMPDC registration/)).toBeVisible();
  await page.getByRole("button", { name: /Pay Ksh\s?2,700\.00/ }).click();
  await page.getByRole("button", { name: "Simulate successful payment" }).click();
  await expect(page.getByText("Confirmed").first()).toBeVisible({ timeout: 15_000 });
  await page.context().close();
});

test("doctor: travels, arrives, treats and signs the visit record", async ({ browser }) => {
  const page = await as(browser, PHONES.doctor, "/portal/care/visits");
  await expect(page.getByText(/Test Estate, Ngong Road/)).toBeVisible();
  for (const label of ["I'm on my way", "I've arrived", "Start the visit"]) {
    await page.getByRole("button", { name: label }).first().click();
    await expect(page.getByRole("button", { name: label })).toHaveCount(0);
  }
  await page.getByLabel("Reason for the visit").fill("Cough for four days");
  await page.getByLabel("Temp °C").fill("37.9");
  await page.getByLabel("Care provided").fill("Examined chest; advised fluids and rest");
  await page.getByLabel("Advice to the patient").fill("Return if breathing becomes difficult");
  await page.getByRole("button", { name: "Sign and complete visit" }).click();
  await expect(page.getByText("Completed").first()).toBeVisible();
  await page.context().close();
});

test("patient: sees the signed visit summary; other people cannot", async ({ browser }) => {
  const page = await as(browser, PHONES.patient2, bookingUrl);
  await expect(page.getByRole("heading", { name: "Visit summary" })).toBeVisible();
  await expect(page.getByText("Examined chest; advised fluids and rest")).toBeVisible();
  await expect(page.getByText(/temperature c: 37\.9/)).toBeVisible();
  await page.context().close();

  const other = await as(browser, PHONES.courier, bookingUrl);
  await expect(other.getByRole("heading", { name: "We couldn't find that page" })).toBeVisible();
  await other.context().close();
});

test("SmartCare lists verified professionals covering a location, distance only", async ({ browser }) => {
  const ctx = await browser.newContext({ geolocation: { latitude: -1.295, longitude: 36.785 }, permissions: ["geolocation"] });
  const page = await ctx.newPage();
  await page.goto("/smartcare/map");
  await page.getByRole("button", { name: "Use my current location" }).click();
  await expect(page.getByRole("link", { name: /Dr Test Doctor/ })).toBeVisible();
  await expect(page.getByText(/about \d+ km away/)).toBeVisible();
  await expect(page.getByText(/-1\.29|36\.8/)).toHaveCount(0);
  await ctx.close();
});
