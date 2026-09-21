import { defineConfig, devices } from "@playwright/test";

/**
 * Local-only E2E suite. Targets the manually-orchestrated local dev stack
 * (Docker Postgres + `npm run dev` backend/frontend) — never a deployed
 * environment. See loadtest/README.md and the project plan for how the
 * stack is started before this config is invoked.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [["html", { open: "never" }], ["list"], ["json", { outputFile: "e2e-results.json" }]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "auth",
      testMatch: /auth\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium",
      testMatch: /(customers|jobs|wells|settings|public-forms)\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/user.json" },
      dependencies: ["setup"],
    },
    {
      name: "mobile",
      testMatch: /responsive\.spec\.ts/,
      use: { ...devices["iPhone 13"], browserName: "chromium", storageState: "e2e/.auth/user.json" },
      dependencies: ["setup"],
    },
  ],
});
