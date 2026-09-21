import { test as setup } from "@playwright/test";
import { uniqueSuffix } from "./utils";

const suffix = uniqueSuffix();
export const TEST_USER = {
  email: `e2e+${suffix}@welldrilling.test`,
  password: "Test123456",
  fullName: "E2E Test User",
  phone: "0812345678",
  orgName: `E2E Org ${suffix}`,
};

setup("register test user", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("ชื่อบริษัท / องค์กร").fill(TEST_USER.orgName);
  await page.getByLabel("ชื่อ-นามสกุล").fill(TEST_USER.fullName);
  await page.getByLabel("อีเมล").fill(TEST_USER.email);
  await page.getByLabel("เบอร์โทรศัพท์ *").fill(TEST_USER.phone);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(TEST_USER.password);
  await page.getByLabel("ยืนยันรหัสผ่าน").fill(TEST_USER.password);
  await page.getByRole("button", { name: "ลงทะเบียน" }).click();
  await page.waitForURL("**/dashboard", { timeout: 15000 });
  // a fresh org with no LINE channel configured triggers the persistent
  // onboarding wizard dialog on first dashboard load — dismiss it so it
  // doesn't block later interactions (and isn't captured into storageState
  // in a half-open state).
  const skipOnboarding = page.getByRole("button", { name: "ข้าม" });
  const appeared = await skipOnboarding.waitFor({ state: "visible", timeout: 3000 }).then(() => true).catch(() => false);
  if (appeared) {
    await skipOnboarding.click();
  }
  await page.context().storageState({ path: "e2e/.auth/user.json" });
});
