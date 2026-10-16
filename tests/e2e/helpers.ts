import { expect, type Page } from "@playwright/test";

export const PHONES = {
  pharmacist: "0700000004",
  pharmacyManager: "0700000005",
  newPatient: "0700000001",
  patient2: "0700000010",
  doctor: "0700000002",
  courier: "0700000006",
  support: "0700000007",
  admin: "0700000008",
} as const;

/** Signs in with a local test number (fixed OTP 123456; never sends an SMS). */
export async function signIn(page: Page, phone: string, next?: string) {
  await page.goto(next ? `/sign-in?next=${encodeURIComponent(next)}` : "/sign-in");
  await page.getByLabel("Mobile number or email").fill(phone);
  const sent = page.getByText("We sent a 6-digit code by SMS.");
  for (let attempt = 0; attempt < 3; attempt++) {
    // Wait for the server action's response, so a stale message from a previous attempt is never misread.
    await Promise.all([
      page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/sign-in")),
      page.getByRole("button", { name: "Send code" }).click(),
    ]);
    // …and for React to finish rendering the result.
    await expect(page.getByRole("button", { name: "Sending code…" })).toHaveCount(0);
    if (await sent.isVisible()) break;
    // Supabase's per-number resend interval (correct behaviour): wait, then try again like a user would.
    await page.waitForTimeout(2000);
  }
  await expect(sent).toBeVisible();
  await page.getByLabel("6-digit code").fill("123456");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
}
