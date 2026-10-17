import { defineConfig, devices } from "@playwright/test";

/**
 * Visual regression harness.
 *
 * Purpose: protect CSS reorganisations. The stylesheet is layered
 * historically (later rules override earlier ones), so moving a rule is easy
 * to get wrong and hard to review by eye. These tests turn "did the layout
 * change?" into a pass/fail signal.
 *
 * Browser selection
 * -----------------
 * By default we drive the locally installed Google Chrome via `channel`.
 * This avoids a ~150 MB browser download and works on machines where the
 * Playwright CDN is unreachable. Set PLAYWRIGHT_CHANNEL=msedge to use Edge, or
 * PLAYWRIGHT_CHANNEL=chromium to use a Playwright-managed browser instead
 * (that variant requires `npx playwright install chromium`).
 */
const requestedChannel = process.env.PLAYWRIGHT_CHANNEL ?? "chrome";

// "chromium" means "use a Playwright-managed browser"; anything else names a
// browser we expect to already be installed on the machine.
const channel: string | undefined =
  requestedChannel === "chromium" ? undefined : requestedChannel;

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 5174);
const baseURL = `http://127.0.0.1:${PORT}`;

/** Admin credentials. Override via E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD. */
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@theeyes.org";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "localdev-admin";

export default defineConfig({
  testDir: "./tests",
  outputDir: "./test-results",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Small machine: 6 parallel workers saturate the dev server and pages time
  // out mid-load. Cap concurrency and give each test generous headroom.
  timeout: 60_000,
  retries: 1,
  // 2 workers avoids saturating the dev server (3 causes goto timeouts on small machines).
  workers: process.env.CI ? 1 : 2,
  reporter: [["list"]],

  use: {
    baseURL,
    channel,
    // Freeze motion so screenshots are deterministic.
    reducedMotion: "reduce",
    // The app holds first paint behind a loader, so allow generous waits.
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
  },

  expect: {
    // Full-page shots at tablet/mobile widths take longer than the 5s default
    // once three workers are competing for the dev server.
    timeout: 20_000,
    toHaveScreenshot: {
      // Anti-aliasing and sub-pixel text/box rounding differ slightly between
      // GPU and software rendering, and across runs. 2% absorbs that noise
      // while still failing on any real layout change.
      maxDiffPixelRatio: 0.02,
      animations: "disabled",
      caret: "hide",
      scale: "css",
    },
  },

  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "tablet", use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } } },
    { name: "mobile", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } } },
  ],

  // Reuse an already-running dev server when one is present.
  webServer: {
    // Pin the port: Vite would otherwise auto-increment past the URL we wait for.
    // --host forces IPv4 binding; Vite otherwise binds IPv6 ::1 only and the
    // health check against 127.0.0.1 never connects.
    command: `npm run dev -- --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
    env: { FORCE_COLOR: "0" },
  },
});

export { ADMIN_EMAIL, ADMIN_PASSWORD };
