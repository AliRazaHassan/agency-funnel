import test from "node:test";
import assert from "node:assert/strict";
import { createEvidenceStore } from "../../server/evidenceStore.js";
// Execute with TEST_REDIS_URL against a dedicated test Redis, never production.
if (process.env.TEST_REDIS_URL)
  test("real isolated Redis survives client restart and serializes concurrent writers", async () => {
    const target = new URL(process.env.TEST_REDIS_URL);
    assert.ok(
      ["127.0.0.1", "localhost"].includes(target.hostname),
      "Only isolated local Redis permitted",
    );
    const { default: Redis } = await import("ioredis");
    const client = new Redis(process.env.TEST_REDIS_URL, {
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
    client.on("error", () => {});
    const key = "product-hunter:evidence:v1";
    // caller supplies an isolated test DB; do not clear unrelated databases.
    await client.del(key);
    const config = {
      REDIS_URL: process.env.TEST_REDIS_URL,
      NODE_ENV: "production",
    };
    const a = createEvidenceStore(config),
      b = createEvidenceStore(config);
    try {
      assert.equal(await a.init(), "keyvalue");
      await a.mutate((d) => {
        d.records.fixture = {
          quotes: [{ supplier: "fixture" }],
          tests: [{ spend: 1 }],
        };
      });
      await Promise.all([
        a.mutate((d) => {
          d.runs.push({ writer: "a" });
        }),
        b.mutate((d) => {
          d.runs.push({ writer: "b" });
        }),
      ]);
      await a.close();
      await b.close();
      const reopened = createEvidenceStore(config);
      const d = await reopened.read();
      assert.equal(d.runs.length, 2);
      assert.equal(d.records.fixture.quotes.length, 1);
      assert.equal(d.records.fixture.tests[0].spend, 1);
      await reopened.close();
    } finally {
      await a.close().catch(() => {});
      await b.close().catch(() => {});
      await client.del(key);
      await client.quit();
    }
  });
