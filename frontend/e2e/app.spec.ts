import { test, expect } from "@playwright/test";

test("application shell loads", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Well-Drilling/);
  await expect(page.locator("#app")).toBeVisible();
});

test("login form is reachable", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading")).toBeVisible();
  await expect(page.locator("input").first()).toBeVisible();
});
