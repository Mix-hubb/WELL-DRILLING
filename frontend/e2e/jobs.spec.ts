import { test, expect, Page } from "@playwright/test";
import { uniqueSuffix } from "./utils";

async function seedJob(page: Page, customerName: string): Promise<string> {
  return page.evaluate(async (name) => {
    const token = localStorage.getItem("welldrill-token");
    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
    const custRes = await fetch("http://localhost:4001/api/customers", {
      method: "POST",
      headers,
      body: JSON.stringify({ customer_name: name, phone: "0812223333" }),
    });
    const customer = await custRes.json();
    const jobRes = await fetch("http://localhost:4001/api/jobs", {
      method: "POST",
      headers,
      body: JSON.stringify({ customer_id: customer.customer_id, job_title: `${name} - งานเจาะ` }),
    });
    const job = await jobRes.json();
    return job.job_id as string;
  }, customerName);
}

test.describe("drilling job status flow", () => {
  test("SUCCESS path: stepper shows only the success track, no FAILED step", async ({ page }) => {
    await page.goto("/dashboard"); // establish origin before evaluate() calls fetch
    const jobId = await seedJob(page, `E2E Job Success ${uniqueSuffix()}`);

    await page.goto(`/jobs/${jobId}`);
    await expect(page.getByText("รอเจาะ").first()).toBeVisible();

    await page.getByRole("button", { name: "เริ่มเจาะ" }).click();
    await expect(page.getByRole("button", { name: "เจาะสำเร็จ" })).toBeVisible();

    await page.getByRole("button", { name: "เจาะสำเร็จ" }).click();
    await expect(page.getByText("เจาะสำเร็จ").first()).toBeVisible();
    // stepper must show the SUCCESS track only — no "เจาะไม่สำเร็จ" step anywhere
    await expect(page.getByText("เจาะไม่สำเร็จ")).toHaveCount(0);

    await page.getByRole("button", { name: "ปิดคิว" }).click();
    // status chip stays "เจาะสำเร็จ" colored, not a generic closed state
    await expect(page.getByText("เจาะสำเร็จ").first()).toBeVisible();
  });

  test("FAILED path: stepper shows only the failed track, and the red chip persists after closing", async ({ page }) => {
    await page.goto("/dashboard");
    const jobId = await seedJob(page, `E2E Job Failed ${uniqueSuffix()}`);

    await page.goto(`/jobs/${jobId}`);
    await page.getByRole("button", { name: "เริ่มเจาะ" }).click();
    await expect(page.getByRole("button", { name: "เจาะไม่สำเร็จ" })).toBeVisible();

    await page.getByRole("button", { name: "เจาะไม่สำเร็จ" }).click();
    await expect(page.getByText("เจาะไม่สำเร็จ").first()).toBeVisible();
    // stepper must show the FAILED track only — no "เจาะสำเร็จ" step anywhere
    await expect(page.getByText("เจาะสำเร็จ")).toHaveCount(0);

    // regression: closing a FAILED job must keep the red "เจาะไม่สำเร็จ" chip,
    // not silently revert to a neutral/closed status
    await page.getByRole("button", { name: "ปิดคิว" }).click();
    await expect(page.getByText("เจาะไม่สำเร็จ").first()).toBeVisible();

    // same regression, visible from the queue list page too
    await page.goto("/jobs");
    await expect(page.getByText("เจาะไม่สำเร็จ").first()).toBeVisible();
  });
});
