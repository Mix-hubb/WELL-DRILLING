import { test, expect, Page } from "@playwright/test";
import { uniqueSuffix } from "./utils";

async function dismissOnboardingIfShown(page: Page) {
  // DashboardView decides whether to show the (persistent, scrim-blocking)
  // onboarding wizard inside an async org-info fetch, so it can still pop
  // up shortly after the page looks settled — give it a brief window.
  const skip = page.getByRole("button", { name: "ข้าม" });
  const appeared = await skip.waitFor({ state: "visible", timeout: 3000 }).then(() => true).catch(() => false);
  if (appeared) {
    await skip.click();
  }
}

test.describe("auth", () => {
  test("unauthenticated user is redirected from /dashboard to /login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("register, login-guard, and logout round trip", async ({ page }) => {
    const suffix = uniqueSuffix();
    const user = {
      email: `e2e-auth+${suffix}@welldrilling.test`,
      password: "Test123456",
      fullName: "E2E Auth Spec User",
      phone: "0898765432",
      orgName: `E2E Auth Org ${suffix}`,
    };

    // register
    await page.goto("/register");
    await page.getByLabel("ชื่อบริษัท / องค์กร").fill(user.orgName);
    await page.getByLabel("ชื่อ-นามสกุล").fill(user.fullName);
    await page.getByLabel("อีเมล").fill(user.email);
    await page.getByLabel("เบอร์โทรศัพท์ *").fill(user.phone);
    await page.getByLabel("รหัสผ่าน", { exact: true }).fill(user.password);
    await page.getByLabel("ยืนยันรหัสผ่าน").fill(user.password);
    await page.getByRole("button", { name: "ลงทะเบียน" }).click();
    await page.waitForURL("**/dashboard", { timeout: 15000 });
    await dismissOnboardingIfShown(page);

    // authenticated user visiting /login is bounced back to /dashboard
    await page.goto("/login");
    await expect(page).toHaveURL(/\/dashboard/);
    await dismissOnboardingIfShown(page);

    // logout via the nav drawer
    await page.locator(".v-list-item:has(i.mdi-logout)").click();
    await page.waitForURL("**/login", { timeout: 10000 });

    // session is really gone: /dashboard guards again
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("wrong password shows an error and does not navigate away", async ({ page }) => {
    const suffix = uniqueSuffix();
    const email = `e2e-wrongpw+${suffix}@welldrilling.test`;

    // register a real account first so we have a valid email to fail against
    await page.goto("/register");
    await page.getByLabel("ชื่อบริษัท / องค์กร").fill(`E2E WrongPw Org ${suffix}`);
    await page.getByLabel("ชื่อ-นามสกุล").fill("E2E WrongPw User");
    await page.getByLabel("อีเมล").fill(email);
    await page.getByLabel("เบอร์โทรศัพท์ *").fill("0811112222");
    await page.getByLabel("รหัสผ่าน", { exact: true }).fill("Test123456");
    await page.getByLabel("ยืนยันรหัสผ่าน").fill("Test123456");
    await page.getByRole("button", { name: "ลงทะเบียน" }).click();
    await page.waitForURL("**/dashboard", { timeout: 15000 });
    await dismissOnboardingIfShown(page);
    await page.locator(".v-list-item:has(i.mdi-logout)").click();
    await page.waitForURL("**/login", { timeout: 10000 });

    // now try logging in with the wrong password
    await page.waitForLoadState("networkidle");
    const emailField = page.getByLabel("อีเมล");
    const pwField = page.getByLabel("รหัสผ่าน", { exact: true });
    await emailField.fill(email);
    await expect(emailField).toHaveValue(email);
    await pwField.fill("WrongPassword999");
    await expect(pwField).toHaveValue("WrongPassword999");

    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/auth/login")),
      page.getByRole("button", { name: "เข้าสู่ระบบ" }).click(),
    ]);
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toContain("ไม่ถูกต้อง");

    await expect(page).toHaveURL(/\/login/);
  });
});
