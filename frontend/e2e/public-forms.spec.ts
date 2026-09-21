import { test, expect } from "@playwright/test";

// Smoke-only: confirms the public LIFF-facing pages render without crashing
// or being redirected to /login. Real submission needs a live LINE/LIFF
// context and is explicitly out of scope for this local E2E suite.
test.describe("public LIFF forms (render only)", () => {
  test("/request-drill renders without redirecting to login", async ({ page }) => {
    await page.goto("/request-drill");
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator("input, textarea").first()).toBeVisible({ timeout: 10000 });
  });

  test("/repair-form renders without redirecting to login", async ({ page }) => {
    await page.goto("/repair-form");
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator("input, textarea").first()).toBeVisible({ timeout: 10000 });
  });
});
