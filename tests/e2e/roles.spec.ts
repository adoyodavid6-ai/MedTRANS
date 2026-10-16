import { expect, test } from "@playwright/test";
import { PHONES, signIn } from "./helpers";

test.describe.configure({ mode: "serial" });

test("a doctor lands in the clinician portal, showing their real verification state", async ({ page }) => {
  await signIn(page, PHONES.doctor);
  await expect(page).toHaveURL(/\/portal\/care$/);
  await expect(page.getByText("Verified", { exact: true })).toBeVisible();
  expect((await page.goto("/ops"))?.status()).toBe(403);
  expect((await page.goto("/portal/pharmacy"))?.status()).toBe(403);
});

test("a nurse without a verified profile cannot reach the clinician tools' data", async ({ page }) => {
  await signIn(page, PHONES.nurse);
  await expect(page).toHaveURL(/\/portal\/care$/);
  await expect(page.getByText("Set your base location and services to start receiving requests")).toBeVisible();
});

test("a courier has no access to clinical or pharmacy portals", async ({ page }) => {
  await signIn(page, PHONES.courier);
  await expect(page).toHaveURL(/\/portal\/courier$/);
  for (const path of ["/portal/care", "/portal/pharmacy", "/ops"]) {
    expect((await page.goto(path))?.status(), path).toBe(403);
  }
});

test("support staff see the operations overview but not admin tools", async ({ page }) => {
  await signIn(page, PHONES.support);
  await expect(page).toHaveURL(/\/ops$/);
  await expect(page.getByRole("link", { name: "Open the support ticket queue" })).toBeVisible();
  expect((await page.goto("/ops/support"))?.status()).toBe(200);
  expect((await page.goto("/ops/users"))?.status()).toBe(403);
  expect((await page.goto("/ops/audit"))?.status()).toBe(403);
});

test("an admin sees live metrics, can manage roles, and every change is audited", async ({ page }) => {
  await signIn(page, PHONES.admin);
  await expect(page).toHaveURL(/\/ops$/);
  await expect(page.getByText("Live from the database")).toBeVisible();

  await page.goto("/ops/users?q=Second%20Patient");
  const card = page.locator("li").filter({ hasText: "Second Patient" });
  await card.getByLabel("Role").selectOption("nurse");
  await card.getByRole("button", { name: "Grant" }).click();
  await expect(card.getByText("Choose a role and tick the confirmation box.")).toBeVisible();
  await card.getByLabel("Role").selectOption("nurse");
  await card.getByRole("checkbox", { name: "Confirm" }).check();
  await card.getByRole("button", { name: "Grant" }).click();
  await expect(card.getByText("Role granted.")).toBeVisible();

  await page.reload();
  const refreshed = page.locator("li").filter({ hasText: "Second Patient" });
  await refreshed.getByLabel("Role").selectOption("nurse");
  await refreshed.getByRole("checkbox", { name: "Confirm" }).check();
  await refreshed.getByRole("button", { name: "Revoke" }).click();
  await expect(refreshed.getByText("Role revoked.")).toBeVisible();

  await page.goto("/ops/audit");
  await expect(page.getByRole("cell", { name: "role.grant" }).first()).toBeVisible();
  await expect(page.getByRole("cell", { name: "role.revoke" }).first()).toBeVisible();
});

test("an admin cannot activate a coverage area that has no boundary", async ({ page }) => {
  await signIn(page, PHONES.admin);
  await page.goto("/ops/coverage");
  const form = page.getByRole("region", { name: "Nairobi (pilot)" }).locator("form").filter({ has: page.getByRole("button", { name: "Activate area" }) });
  await form.getByRole("checkbox", { name: "I confirm this change" }).check();
  await form.getByRole("button", { name: "Activate area" }).click();
  await expect(page.getByText("An area needs a boundary before it can be activated.")).toBeVisible();
});
