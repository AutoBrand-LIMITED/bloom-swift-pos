import { defineConfig, devices } from "@playwright/test";

const frontendURL = "http://127.0.0.1:15174";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "customer-credit-local.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  outputDir: "test-results/customer-credit-local",
  reporter: [["list"]],
  use: {
    baseURL: frontendURL,
    channel: "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
    viewport: { width: 1280, height: 1000 },
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 15174 --strictPort",
    url: frontendURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
