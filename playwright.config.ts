import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/ui",
  // tests/ui also holds vitest *.test.ts files, which Playwright must not run
  testMatch: "**/*.spec.ts",
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120000
  },
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry"
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } }
  ]
});
