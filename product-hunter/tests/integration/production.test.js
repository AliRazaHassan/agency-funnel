import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
if (process.env.TEST_REDIS_URL)
  test(
    "production startup verifies auth and persistent research without exposing credentials",
    { timeout: 40000 },
    async () => {
      const url = new URL(process.env.TEST_REDIS_URL);
      assert.ok(
        ["127.0.0.1", "localhost"].includes(url.hostname),
        "Only an isolated local test Redis is permitted",
      );
      url.pathname = "/14";
      const child = spawn(process.execPath, ["server/index.js"], {
        env: {
          ...process.env,
          NODE_ENV: "production",
          REDIS_URL: url.href,
          DATABASE_URL: "",
          PORT: "8789",
          APP_PASSWORD: "isolated-smoke-fixture",
          SESSION_SECRET: "isolated-smoke-session",
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let logs = "";
      child.stdout.on("data", (d) => (logs += d));
      child.stderr.on("data", (d) => (logs += d));
      try {
        let health;
        const deadline = Date.now() + 25000;
        while (Date.now() < deadline) {
          try {
            const r = await fetch("http://127.0.0.1:8789/api/health");
            health = await r.json();
            if (health.verification) break;
          } catch {}
          await new Promise((r) => setTimeout(r, 100));
        }
        assert.equal(health?.researchStorage, "keyvalue");
        assert.deepEqual(health?.verification, {
          unauthenticatedBlocked: true,
          login: true,
          providerStatus: true,
          storedResearch: true,
        });
        assert.equal(logs.includes("isolated-smoke-fixture"), false);
      } finally {
        child.kill();
        await new Promise((resolve) => {
          if (child.exitCode !== null) resolve();
          else {
            child.once("exit", resolve);
            setTimeout(() => {
              child.kill("SIGKILL");
              resolve();
            }, 2000).unref();
          }
        });
      }
    },
  );
