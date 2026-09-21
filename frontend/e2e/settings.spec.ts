import { test, expect } from "@playwright/test";

test.describe("settings", () => {
  test("shows the org invite code for an admin user", async ({ page }) => {
    await page.goto("/settings");
    const inviteField = page.getByLabel("Invite Code").first();
    await expect(inviteField).toBeVisible({ timeout: 10000 });
    await expect(inviteField).not.toHaveValue("");
  });
});
