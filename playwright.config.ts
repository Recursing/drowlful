import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  expect: { timeout: 10_000 },
  retries: 0, // No retries — if a test fails, it's a real bug
  use: {
    baseURL: "http://localhost:4173",
  },
  webServer: {
    command: "DROWLFUL_FAST_TIMERS=1 deno run -A node_modules/.bin/vite dev --port 4173",
    env: { DROWLFUL_FAST_TIMERS: "1" },
    port: 4173,
    reuseExistingServer: true,
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
