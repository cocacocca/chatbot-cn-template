import { defineConfig, devices } from "@playwright/test";

/* Use process.env.PORT by default and fallback to port 3000 */
const PORT = process.env.PORT || 30_000;

/**
 * Set webServer.url and use.baseURL with the location
 * of the WebServer respecting the correct set port
 */
const baseURL = `http://localhost:${PORT}`;

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./tests",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: 0,
  /* Limit workers to prevent browser crashes */
  workers: process.env.CI ? 2 : 2,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: "html",
  /* Create a test user and log in once before all tests, saving the session */
  globalSetup: "./tests/e2e/global-setup",
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "retain-on-failure",

    /* Bypass the system HTTP proxy so the browser can reach the local dev
       server directly. Without this, requests to localhost are routed through
       the proxy and time out. */
    launchOptions: {
      args: ["--no-proxy-server"],
    },
  },

  /* Configure global timeout for each test */
  timeout: 240 * 1000, // 120 seconds
  expect: {
    timeout: 240 * 1000,
  },

  /* Configure projects */
  projects: [
    {
      name: "auth",
      testMatch: /e2e\/auth\.test\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        // Auth pages must be visited without an active session
      },
    },
    {
      name: "e2e",
      testMatch: /e2e\/(?!auth\.test\.ts).*\.test\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        /* Reuse the session saved by globalSetup for all authenticated tests */
        storageState: "tests/e2e/.auth/user.json",
      },
    },

    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },

    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: "pnpm dev",
    url: `${baseURL}`,
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },
});
