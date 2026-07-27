import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  // Playwright's default testMatch also picks up `*.test.ts`, which is the
  // convention Jest uses in the service and realm packages. Without this, a
  // stray Jest file under tests/ throws during collection ("describe is not
  // defined") and the whole run collapses to "0 tests in 0 files".
  //
  // That failure does exit non-zero — it went unnoticed only because every CI
  // step named an explicit spec path, so nothing ever invoked the suite
  // unqualified. `make test-e2e-collect` now does, on its own CI step.
  // Playwright specs in this repo are always `*.spec.ts`.
  testMatch: '**/*.spec.ts',
  // Specs the Makefile treats as non-blocking are excluded from the gating run
  // via PW_SKIP and executed separately. Keeps that soft-fail list in exactly
  // one place (Makefile: E2E_SOFT_SPECS) instead of as `|| echo` scattered
  // through the CI config, where local and CI policy drifted apart.
  testIgnore: process.env.PW_SKIP ? process.env.PW_SKIP.split(',') : [],
  fullyParallel: false, // Run tests serially for E2E journey
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker for journey tests
  reporter: 'html',
  use: {
    baseURL: process.env.GATEKEEPER_URL || 'http://localhost:8080',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // No `webServer` block on purpose. The platform is started out of band —
  // `make up` locally, `docker-compose up -d` in CI — and Playwright does not
  // manage it.
  //
  // There was previously a webServer whose command was an `echo`. With the
  // platform already running, `reuseExistingServer` skipped it and everything
  // worked; with the platform down, Playwright ran the echo, saw it exit, and
  // aborted the entire run with "Process from config.webServer exited early" —
  // including tests that need no server at all, such as tests/manifests.
  // Without the block, suites that need the platform fail with a plain
  // connection error and the rest still run.
});
