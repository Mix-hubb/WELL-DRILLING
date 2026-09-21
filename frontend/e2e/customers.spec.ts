import { test, expect } from "@playwright/test";
import { uniqueSuffix } from "./utils";

test.describe("customers CRUD", () => {
  test("create, edit, and delete a customer", async ({ page }) => {
    const suffix = uniqueSuffix();
    const name = `E2E Customer ${suffix}`;
    const nameEdited = `${name} (แก้ไขแล้ว)`;

    await page.goto("/wells");

    // create
    await page.getByRole("button", { name: "เพิ่มลูกค้า" }).click();
    const addDialog = page.getByRole("dialog");
    await addDialog.getByLabel("ชื่อ-นามสกุล ลูกค้า *").fill(name);
    await addDialog.getByLabel("เบอร์โทรศัพท์ *", { exact: true }).fill("0891234567");
    await addDialog.getByRole("button", { name: "เพิ่มลูกค้า" }).click();
    await expect(page.getByText(name, { exact: true })).toBeVisible({ timeout: 10000 });

    // edit
    const card = page.locator(".v-card", { hasText: name });
    await card.locator('button:has(i.mdi-pencil-outline)').click();
    const editDialog = page.getByRole("dialog");
    const nameField = editDialog.getByLabel("ชื่อ-นามสกุล ลูกค้า *");
    await nameField.fill("");
    await nameField.fill(nameEdited);
    await editDialog.getByRole("button", { name: "บันทึกการแก้ไข" }).click();
    await expect(page.getByText(nameEdited, { exact: true })).toBeVisible({ timeout: 10000 });

    // delete
    const editedCard = page.locator(".v-card", { hasText: nameEdited });
    await editedCard.locator('button:has(i.mdi-delete-outline)').click();
    await page.getByRole("button", { name: "ลบข้อมูล" }).click();
    await expect(page.getByText(nameEdited, { exact: true })).toHaveCount(0, { timeout: 10000 });
  });

  test("search filters the customer list", async ({ page }) => {
    const suffix = uniqueSuffix();
    const name = `E2E Searchable ${suffix}`;

    await page.goto("/wells");
    await page.getByRole("button", { name: "เพิ่มลูกค้า" }).click();
    const addDialog = page.getByRole("dialog");
    await addDialog.getByLabel("ชื่อ-นามสกุล ลูกค้า *").fill(name);
    await addDialog.getByLabel("เบอร์โทรศัพท์ *", { exact: true }).fill("0899998888");
    await addDialog.getByRole("button", { name: "เพิ่มลูกค้า" }).click();
    await expect(page.getByText(name, { exact: true })).toBeVisible({ timeout: 10000 });

    await page.getByPlaceholder("ค้นหาจากชื่อลูกค้า หรือเบอร์โทร...").fill(`no-such-customer-${suffix}`);
    await expect(page.getByText(name, { exact: true })).toHaveCount(0);

    await page.getByPlaceholder("ค้นหาจากชื่อลูกค้า หรือเบอร์โทร...").fill(suffix);
    await expect(page.getByText(name, { exact: true })).toBeVisible();
  });
});
