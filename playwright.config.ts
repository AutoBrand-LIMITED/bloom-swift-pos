import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const frontendDir = fileURLToPath(new URL(".", import.meta.url));
const repoDir = path.resolve(frontendDir, "../..");
const backendURL = "http://127.0.0.1:18080";
const frontendURL = "http://127.0.0.1:15173";
const apiOnly = process.env.POS_E2E_API_ONLY === "1";

const backendServer = {
  command: `backend/.venv/bin/python scripts/start_staging_test_backend.py --port 18080 --frontend-origin ${frontendURL}`,
  cwd: repoDir,
  url: `${backendURL}/e2e/staging-target`,
  reuseExistingServer: false,
  timeout: 120_000,
};

const frontendServer = {
  command: `VITE_BACKEND_URL=${backendURL} npm run dev -- --host 127.0.0.1 --port 15173 --strictPort`,
  cwd: frontendDir,
  url: frontendURL,
  reuseExistingServer: false,
  timeout: 120_000,
};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  outputDir: "test-results",
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL: frontendURL,
    channel: "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: apiOnly ? [backendServer] : [backendServer, frontendServer],
});
