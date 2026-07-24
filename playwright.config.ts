import { defineConfig, devices } from "@playwright/test";

/**
 * Local e2e serves `site/` at http://127.0.0.1:4173 with SITE_BASE empty
 * (root-relative links). Production GitHub Pages uses /innsigle.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: {
    toHaveScreenshot: {
      // Design-voice review: allow font AA / antialias + minor CI vs local layout jitter
      maxDiffPixelRatio: 0.08,
    },
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true,
    trace: "retain-on-failure",
    video: "on",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
    viewport: { width: 1280, height: 800 },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 5"] },
      testIgnore: /link-integrity/,
    },
  ],
  webServer: {
    command:
      "SITE_BASE= node scripts/build-site.mjs && npx --yes serve site -l 4173 --no-port-switching",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
