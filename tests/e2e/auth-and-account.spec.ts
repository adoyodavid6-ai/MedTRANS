import { expect, test } from "@playwright/test";
import { PHONES, signIn } from "./helpers";

test.describe.configure({ mode: "serial" });

test("signed-out visitors are sent to sign in, then back", async ({ page }) => {
  await page.goto("/account/addresses");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Faccount/);
});

test("a wrong code is rejected", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Mobile number or email").fill(PHONES.patient2);
  await page.getByRole("button", { name: "Send code" }).click();
  await page.getByLabel("6-digit code").fill("000000");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("That code is incorrect or has expired.")).toBeVisible();
});

test("an invalid number is explained", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Mobile number or email").fill("12345");
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByText(/Enter a mobile number/)).toBeVisible();
});

test("first sign-in requires accepting the policies, then opens the account", async ({ page }) => {
  await signIn(page, PHONES.newPatient);
  await expect(page).toHaveURL(/\/welcome/);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("You need to accept the terms of service to continue.")).toBeVisible();

  await page.getByLabel("Your name (optional)").fill("Amina E2E");
  await page.getByRole("checkbox", { name: /terms of service/ }).check();
  await page.getByRole("checkbox", { name: /privacy notice/ }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("heading", { name: "Hello, Amina E2E" })).toBeVisible();

  // Address book
  await page.getByRole("link", { name: "Addresses" }).first().click();
  await page.getByLabel("Name for this address").fill("Home");
  await page.getByLabel("Street, road or estate details").fill("E2E Private Lane 42");
  await page.getByLabel("Nearby landmark").fill("Blue gate");
  await page.getByRole("button", { name: "Save address" }).click();
  await expect(page.getByText("Address saved.")).toBeVisible();
  await expect(page.getByText("E2E Private Lane 42")).toBeVisible();

  // Household requires confirming authority
  await page.getByRole("link", { name: "Household" }).first().click();
  await page.getByLabel("Their full name").fill("Child E2E");
  await page.getByLabel("Relationship to you").selectOption("child");
  await page.getByRole("button", { name: "Add household member" }).click();
  await expect(page.getByText("Please confirm you're authorised to arrange care for this person.")).toBeVisible();
  await page.getByRole("checkbox", { name: /I confirm I am authorised/ }).check();
  await page.getByRole("button", { name: "Add household member" }).click();
  await expect(page.getByText("Household member added.")).toBeVisible();

  // Consent can be changed and is recorded
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, "account pages fit the phone screen").toBeLessThanOrEqual(0);
  await page.getByRole("link", { name: "Privacy & consent" }).first().click();
  await page.getByRole("button", { name: /^Allow Occasional service news/ }).click();
  await expect(page.getByRole("button", { name: /^Withdraw Occasional service news/ })).toBeVisible();
});

test("another patient cannot see the first patient's data", async ({ page }) => {
  await signIn(page, PHONES.patient2);
  await expect(page).toHaveURL(/\/account$/);
  await page.goto("/account/addresses");
  await expect(page.getByRole("heading", { name: "Saved addresses" })).toBeVisible();
  await expect(page.getByText("E2E Private Lane 42")).toHaveCount(0);
  await page.goto("/account/household");
  await expect(page.getByText("Child E2E")).toHaveCount(0);
});

test("patients cannot open operations or professional portals", async ({ page }) => {
  await signIn(page, PHONES.patient2);
  await expect(page).toHaveURL(/\/account$/);
  for (const path of ["/ops", "/ops/users", "/portal/care", "/portal/pharmacy", "/portal/courier"]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(403);
    await expect(page.getByRole("heading", { name: "You don't have access to this area" })).toBeVisible();
  }
});

test("open redirects after sign-in are ignored", async ({ page }) => {
  await signIn(page, PHONES.patient2, "https://evil.example/");
  await expect(page).toHaveURL(/localhost:\d+\/account$/);
});

test("sign out ends the session", async ({ page }) => {
  await signIn(page, PHONES.patient2);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/account");
  await expect(page).toHaveURL(/\/sign-in/);
});
