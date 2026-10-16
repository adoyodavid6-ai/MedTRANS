import { expect, test, type Browser, type Page } from "@playwright/test";
import { PHONES, signIn } from "./helpers";

test.describe.configure({ mode: "serial" });

async function as(browser: Browser, phone: string, path: string): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await signIn(page, phone, path);
  return page;
}

let guestTicketUrl = "";

test("a guest can send a support message and gets a private link", async ({ page }) => {
  await page.goto("/contact");
  await expect(page.getByText("This form is not for emergencies")).toBeVisible();
  await page.getByLabel("What is this about?").selectOption("delivery");
  await page.getByLabel("Subject").fill("Where is my parcel? (E2E)");
  await page.getByLabel("Your message").fill("It has been two days. Synthetic E2E message.");
  await page.getByLabel("Email or phone for our reply").fill("guest-e2e@example.test");
  await page.getByRole("checkbox", { name: /storing this message/ }).check();
  await page.getByRole("button", { name: "Send message" }).click();
  await page.waitForURL(/\/support\/[0-9a-f]{48}/);
  guestTicketUrl = page.url().replace(/^https?:\/\/[^/]+/, "");
  await expect(page.getByText(/Message received: ST-/)).toBeVisible();
});

test("support staff reply; internal notes never reach the customer", async ({ browser }) => {
  const staff = await as(browser, PHONES.support, "/ops/support");
  await staff.getByRole("link", { name: "Where is my parcel? (E2E)" }).click();
  await staff.getByLabel("Message").fill("INTERNAL: check courier assignment");
  await staff.getByRole("checkbox", { name: /Internal note/ }).check();
  await staff.getByRole("button", { name: "Send" }).click();
  await expect(staff.getByText("Internal note added.")).toBeVisible();
  await staff.getByLabel("Message").fill("Thanks: it's on its way today.");
  await staff.getByRole("button", { name: "Send" }).click();
  await expect(staff.getByText("Reply sent.")).toBeVisible();
  await staff.context().close();

  const guest = await browser.newPage();
  await guest.goto(guestTicketUrl);
  await expect(guest.getByText("Thanks: it's on its way today.")).toBeVisible();
  await expect(guest.getByText(/INTERNAL/)).toHaveCount(0);
  await guest.close();
});

test("patients get neutral in-app notifications", async ({ browser }) => {
  const page = await as(browser, PHONES.patient2, "/account/notifications");
  await expect(page.getByRole("link", { name: /Order MT-\d+ updated/ }).first()).toBeVisible();
  await expect(page.getByText(/Amoxicillin|Paracetamol|cough/i)).toHaveCount(0);
  await page.context().close();
});

test("a patient can report a safety concern about their order; operations see it", async ({ browser }) => {
  const page = await as(browser, PHONES.patient2, "/account/orders");
  await page.getByRole("link", { name: /Order MT-/ }).first().click();
  await page.getByText("Report a problem with this order or medicine").click();
  await page.getByLabel("What happened?").selectOption("adverse_reaction");
  await page.getByLabel("Describe it").fill("Mild rash after the second dose (synthetic E2E).");
  await page.getByRole("button", { name: "Send report" }).click();
  await expect(page.getByText(/Report SI-\d+ sent to MedTRANS safety/)).toBeVisible();
  await page.context().close();

  const admin = await as(browser, PHONES.admin, "/ops/incidents");
  await expect(admin.getByText("Mild rash after the second dose (synthetic E2E).")).toBeVisible();
  await admin.context().close();
});

test("a recall takes a medicine off sale immediately", async ({ browser }) => {
  const admin = await as(browser, PHONES.admin, "/ops/catalogue");
  const row = admin.locator("li", { hasText: "Oral rehydration salts" });
  await row.locator("summary", { hasText: "Recall" }).click();
  await row.getByLabel(/Recall details/).fill("Batch ORS-TEST-1 recalled by manufacturer (synthetic E2E).");
  await row.getByRole("checkbox", { name: /Remove from sale/ }).check();
  await row.getByRole("button", { name: "Recall product" }).click();
  await expect(row.locator("span", { hasText: /^Recalled$/ })).toBeVisible();
  await admin.context().close();

  const visitor = await browser.newPage();
  await visitor.goto("/pharmacy/medicines/oral-rehydration-salts");
  await expect(visitor.getByText("This medicine has been recalled")).toBeVisible();
  await expect(visitor.getByRole("button", { name: /Add to cart/ })).toHaveCount(0);
  await visitor.close();
});

test("emergency callback requests exist only while a staffed operation is switched on", async ({ browser }) => {
  const visitor = await browser.newPage();
  await visitor.goto("/emergency");
  await expect(visitor.getByRole("button", { name: "Ask a responder to call me" })).toHaveCount(0);

  const admin = await as(browser, PHONES.admin, "/ops/emergency");
  await admin.getByRole("checkbox", { name: /staffed, supervised/ }).check();
  await admin.getByLabel("Staffed hours").fill("24/7 (synthetic E2E)");
  await admin.getByLabel("Responsible supervisor").fill("Test Supervisor");
  await admin.getByRole("checkbox", { name: /responders are trained/ }).check();
  await admin.getByRole("button", { name: "Save" }).click();
  await expect(admin.getByText(/Operation switched on/)).toBeVisible();

  await visitor.goto("/emergency");
  // Guidance still comes first; the form is below it.
  await expect(visitor.getByRole("heading", { name: "When you call, say:" })).toBeVisible();
  await visitor.getByLabel("Number to call you on").fill("0711000222");
  await visitor.getByRole("button", { name: "Ask a responder to call me" }).click();
  await visitor.waitForURL(/\/emergency\/requests\/[0-9a-f]{48}/);
  await expect(visitor.getByText("Received: not yet seen by a responder").first()).toBeVisible();
  await expect(visitor.getByText(/dispatched|on the way|ambulance is coming/i)).toHaveCount(0);

  const responder = await as(browser, PHONES.responder, "/portal/emergency");
  await expect(responder.getByText("NOT YET ACKNOWLEDGED", { exact: false })).toBeVisible();
  await responder.getByRole("button", { name: "Acknowledge" }).first().click();
  await expect(responder.getByText("Recorded.").first()).toBeVisible();
  await responder.context().close();

  await visitor.reload();
  await expect(visitor.getByText("Seen by a responder").first()).toBeVisible();
  await visitor.close();

  // Switch it off again so other tests see the default state.
  await admin.getByRole("checkbox", { name: /staffed, supervised/ }).uncheck();
  await admin.getByRole("checkbox", { name: /responders are trained/ }).check();
  await admin.getByRole("button", { name: "Save" }).click();
  await expect(admin.getByText("Operation switched off.")).toBeVisible();
  await admin.context().close();
});
