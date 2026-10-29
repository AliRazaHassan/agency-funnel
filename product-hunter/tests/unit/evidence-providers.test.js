import test from "node:test";
import assert from "node:assert/strict";
import {
  capabilities,
  collect,
} from "../../server/evidenceProviders.js";
import { googleTrendsDirectEnabled } from "../../server/freeSignals.js";

function withEnv(patch, fn) {
  const prev = {};
  for (const [k, v] of Object.entries(patch)) {
    prev[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const [k, v] of Object.entries(prev)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    });
}

test("ENABLE_GOOGLE_TRENDS is opt-in (=== 1) for desk and evidence", async () => {
  await withEnv({ ENABLE_GOOGLE_TRENDS: undefined }, () => {
    assert.equal(googleTrendsDirectEnabled(), false);
    const g = capabilities().find((p) => p.platform === "google");
    assert.equal(g.configured, false);
    assert.equal(g.mode, "UNAVAILABLE");
  });
  await withEnv({ ENABLE_GOOGLE_TRENDS: "0" }, () => {
    assert.equal(googleTrendsDirectEnabled(), false);
  });
  await withEnv({ ENABLE_GOOGLE_TRENDS: "1", APIFY_TOKEN: undefined }, () => {
    assert.equal(googleTrendsDirectEnabled(), true);
    const g = capabilities().find((p) => p.platform === "google");
    assert.equal(g.configured, true);
    assert.equal(g.mode, "LIVE");
  });
});

test("capabilities label LIVE vs SEED vs UNAVAILABLE without inventing keys", async () => {
  await withEnv(
    {
      APIFY_TOKEN: undefined,
      META_AD_LIBRARY_TOKEN: undefined,
      FACEBOOK_ACCESS_TOKEN: undefined,
      KEEPA_API_KEY: undefined,
      ENABLE_GOOGLE_TRENDS: undefined,
    },
    () => {
      const by = Object.fromEntries(capabilities().map((p) => [p.platform, p]));
      assert.equal(by.amazon.mode, "UNAVAILABLE");
      assert.equal(by.meta.mode, "SEED");
      assert.equal(by.tiktok.mode, "SEED");
      assert.equal(by.google.mode, "UNAVAILABLE");
      assert.equal(by.meta.configured, false);
      assert.equal(by.tiktok.configured, false);
    },
  );
  await withEnv({ APIFY_TOKEN: "test-token-not-real" }, () => {
    const by = Object.fromEntries(capabilities().map((p) => [p.platform, p]));
    assert.equal(by.tiktok.mode, "LIVE");
    assert.equal(by.meta.mode, "LIVE");
    assert.equal(by.google.mode, "LIVE");
    assert.equal(by.tiktok.preferredPath, "apify-automatic-hunt");
    assert.equal(by.google.preferredPath, "apify-automatic-hunt");
  });
});

test("collect fails clearly when sources empty; Apify preferred messaging", async () => {
  await withEnv(
    {
      APIFY_TOKEN: "test-token-not-real",
      META_AD_LIBRARY_TOKEN: undefined,
      FACEBOOK_ACCESS_TOKEN: undefined,
      ENABLE_GOOGLE_TRENDS: undefined,
    },
    async () => {
      const runs = await collect({ market: "US", query: "Christmas pet" });
      const by = Object.fromEntries(runs.map((r) => [r.platform, r]));
      assert.equal(by.amazon.status, "unavailable");
      assert.equal(by.amazon.mode, "UNAVAILABLE");
      assert.match(by.amazon.reason, /UNAVAILABLE|No dated ASIN/i);
      assert.equal(by.google.status, "unavailable");
      assert.match(by.google.reason, /Apify|Automatic hunt/i);
      assert.equal(by.google.observations.length, 0);
      assert.equal(by.meta.observations.length, 0);
      assert.equal(by.tiktok.observations.length, 0);
      for (const r of runs) {
        assert.ok(r.reason || r.status === "success");
        assert.ok(["unavailable", "failed", "success"].includes(r.status));
      }
    },
  );
});

test("collect google reports disabled clearly when flag off and no Apify", async () => {
  await withEnv(
    { APIFY_TOKEN: undefined, ENABLE_GOOGLE_TRENDS: undefined },
    async () => {
      const runs = await collect({ market: "US", query: "pet" });
      const g = runs.find((r) => r.platform === "google");
      assert.equal(g.status, "unavailable");
      assert.equal(g.mode, "UNAVAILABLE");
      assert.match(g.reason, /ENABLE_GOOGLE_TRENDS|APIFY_TOKEN|UNAVAILABLE/i);
      assert.equal(g.observations.length, 0);
    },
  );
});
