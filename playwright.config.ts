import { defineConfig } from "@playwright/test";

// Existing feature regressions intentionally exercise the sample catalog.
// Normal learner behavior is covered by learn-access.spec.ts on an isolated app.
process.env.NEXT_PUBLIC_DEMO_CATALOG = "1";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3001";
const port = new URL(baseURL).port || "3001";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  testIgnore: "**/production-smoke/**",
  // The controlled Supabase integration compiles an isolated app. Run it after
  // the local regressions so build resources cannot contend with native dialogs.
  projects: [
    { name: "local", testIgnore: ["**/supabase-ui.spec.ts", "**/production-smoke/**"] },
    { name: "supabase-controlled", testMatch: "**/supabase-ui.spec.ts", dependencies: ["local"] },
  ],
  use: {
    baseURL,
    viewport: { width: 1440, height: 1000 },
    channel: process.env.PLAYWRIGHT_CHANNEL,
    launchOptions: process.env.PLAYWRIGHT_DISABLE_GPU === "1" ? { args: ["--disable-gpu"] } : undefined,
  },
  webServer: [{
    command: `node scripts/start-demo-test-server.cjs ${port}`,
    env: { NEXT_PUBLIC_DEMO_CATALOG: "1" },
    url: baseURL,
    reuseExistingServer: !!process.env.PLAYWRIGHT_BASE_URL && !process.env.CI,
    timeout: 120000,
  }, {
    command: "node node_modules/next/dist/bin/next dev tests/repository-harness --port 3002 --hostname localhost",
    url: "http://localhost:3002",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  }],
});
