import { test, expect, Page } from "@playwright/test";
import { uniqueSuffix } from "./utils";

async function seedCustomerWithWell(page: Page, customerName: string, wellName: string): Promise<string> {
  return page.evaluate(
    async ({ customerName, wellName }) => {
      const token = localStorage.getItem("welldrill-token");
      const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
      const custRes = await fetch("http://localhost:4001/api/customers", {
        method: "POST",
        headers,
        body: JSON.stringify({ customer_name: customerName, phone: "0855556666" }),
      });
      const customer = await custRes.json();
      const wellRes = await fetch("http://localhost:4001/api/wells", {
        method: "POST",
        headers,
        body: JSON.stringify({ customer_id: customer.customer_id, well_name: wellName }),
      });
      const well = await wellRes.json();
      return JSON.stringify({ customerId: customer.customer_id, wellId: well.well_id });
    },
    { customerName, wellName }
  );
}

test.describe("wells", () => {
  test("customer list renders and links to a customer's well list", async ({ page }) => {
    const suffix = uniqueSuffix();
    const customerName = `E2E Well Customer ${suffix}`;
    const wellName = `บ่อทดสอบ ${suffix}`;
    const raw = await (async () => {
      await page.goto("/dashboard");
      return seedCustomerWithWell(page, customerName, wellName);
    })();
    const { customerId, wellId } = JSON.parse(raw);

    await page.goto("/wells");
    await expect(page.getByText(customerName, { exact: true })).toBeVisible({ timeout: 10000 });

    await page.goto(`/wells/customer/${customerId}`);
    await expect(page.getByText(wellName, { exact: true }).first()).toBeVisible({ timeout: 10000 });

    await page.goto(`/wells/${wellId}`);
    await expect(page.getByText(wellName, { exact: true }).first()).toBeVisible({ timeout: 10000 });
  });
});
