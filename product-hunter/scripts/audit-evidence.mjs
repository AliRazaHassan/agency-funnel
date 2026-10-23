// Read-only deterministic audit of the published evidence workflow.
// Synthetic example.com records are never stored or uploaded as product research.
import {
  observation,
  rankEvidence,
  delivery,
  parseRequest,
} from "../server/evidence.js";
import { createEvidenceStore } from "../server/evidenceStore.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const now = new Date("2026-10-23T12:00:00Z");
const row = (extra = {}) =>
  observation(
    {
      platform: "amazon",
      externalId: "audit-id",
      identityKey: "same-variant",
      title: "Christmas pet ornament",
      market: "US",
      metric: "bought_count",
      value: 100,
      unit: "past month",
      dataAt: "2026-10-22",
      sourceUrl: "https://example.com/audit-item",
      ...extra,
    },
    now,
  );
const rank = (rows, records = {}, constraints = {}) =>
  rankEvidence(rows, records, { market: "US", ...constraints }, now);
const id = rank([row()])[0].id;
const inherited = rank(
  [row({ market: "UK" })],
  {
    [id]: {
      shortlisted: true,
      tests: [{ spend: 10, purchases: 1, revenue: 40 }],
    },
  },
  { market: "UK" },
)[0];
const quote = {
  url: "https://example.com/audit-supplier",
  quotedAt: "2026-10-22",
  processingDays: 1,
  transitDays: 2,
  personalizationDays: 0,
};
const results = {
  auditMode:
    "Current working tree; compare original published output in post-push-audit-reproduction.json",
  latestZeroRetainsPositiveSales: rank([
    row(),
    row({ dataAt: "2026-10-23", value: 0 }),
  ])[0].dimensions.salesEvidence,
  crossMarketRecordReuse: {
    sameId: inherited.id === id,
    shortlisted: inherited.shortlisted,
    inheritedTests: inherited.tests.length,
  },
  modeledUppercase: {
    status: row({ dataStatus: "MODELED" }).dataStatus,
    salesEvidence: rank([row({ dataStatus: "MODELED" })])[0].dimensions
      .salesEvidence,
    confidence: rank([row({ dataStatus: "MODELED" })])[0].confidence,
  },
  negativePlanningDays: (() => {
    try {
      return delivery(
        quote,
        { season: "christmas-2026", contingencyDays: -100, testingDays: -100 },
        now,
      );
    } catch (e) {
      return { rejected: true, reason: e.message };
    }
  })(),
  nonSeasonalDeliveryTarget: delivery(quote, {}, now).target,
  explicitRequiredPlatformsLost: parseRequest("Find Christmas pet products", {
    market: "US",
    requiredPlatforms: ["amazon"],
  }).requiredPlatforms,
};
try {
  rank([row({ tags: "Christmas,pet" })]);
  results.csvTags = "accepted";
} catch (e) {
  results.csvTags = e.message;
}
const dir = await mkdtemp(join(tmpdir(), "signaldesk-audit-"));
try {
  const store = createEvidenceStore({
    EVIDENCE_FILE: join(dir, "new-directory", "evidence.json"),
  });
  const runs = await Promise.allSettled([
    store.init(),
    store.read(),
    store.read(),
  ]);
  results.concurrentFileInitialization = runs.map((r) => ({
    status: r.status,
    error: r.reason?.code || null,
  }));
  await store.close();
} finally {
  await rm(dir, { recursive: true, force: true });
}
console.log(JSON.stringify(results, null, 2));
