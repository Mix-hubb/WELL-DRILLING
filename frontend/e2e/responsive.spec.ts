import { test, expect } from "@playwright/test";

test.describe("mobile responsive nav", () => {
  test("bottom nav shows on mobile with the more menu exposing settings and repair requests", async ({ page }) => {
    await page.goto("/dashboard");

    // primary bottom-nav tabs (scoped to links — the app bar title can
    // also read "แดชบอร์ด" on mobile, which would otherwise be ambiguous)
    await expect(page.getByRole("link", { name: "แดชบอร์ด" })).toBeVisible();
    await expect(page.getByRole("link", { name: "คิวงาน" })).toBeVisible();
    await expect(page.getByRole("link", { name: "คำร้องเจาะ" })).toBeVisible();
    await expect(page.getByRole("link", { name: "ประวัติบ่อ" })).toBeVisible();

    // open the overflow "more" menu — regression: it must contain both
    // "รายการแจ้งซ่อม" and "ตั้งค่าระบบ" (settings was missing before the fix)
    await page.getByText("เพิ่มเติม").click();
    await expect(page.getByRole("listitem").filter({ hasText: "รายการแจ้งซ่อม" })).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: "ตั้งค่าระบบ" })).toBeVisible();
  });
});
