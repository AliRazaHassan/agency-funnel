import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const isolated = join(
  mkdtempSync(join(tmpdir(), "signal-desk-e2e-")),
  "evidence.json",
);
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: process.env.FULL_E2E === "1" ? "*.spec.js" : "evidence.spec.js",
  workers: 1,
  retries: 0,
  timeout: 150000,
  use: {
    baseURL: "http://127.0.0.1:8788",
    screenshot: "only-on-failure",
    launchOptions: process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH, args: ["--no-sandbox"] }
      : {},
  },
  webServer: {
    command: `NODE_ENV=test DATABASE_URL= REDIS_URL= APP_PASSWORD=e2e-secret SESSION_SECRET=e2e-only PORT=8788 EVIDENCE_FILE=${isolated} RESEARCH_FILE=${isolated}.legacy.json PROJECTS_DIR=${isolated}.projects node server/index.js`,
    url: "http://127.0.0.1:8788/api/health",
    reuseExistingServer: false,
  },
});
