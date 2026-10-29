import { createHash } from "node:crypto";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  observation,
  freshness,
  economics,
  delivery,
  parseRequest,
  rankEvidence,
  csv,
  productId,
  migrateEvidenceRecords,
} from "../../server/evidence.js";
import { createEvidenceStore } from "../../server/evidenceStore.js";
const now = new Date("2026-10-23T12:00:00Z");
const row = (extra = {}) =>
  observation(
    {
      platform: "amazon",
      externalId: "B000000001",
      title: "Christmas pet ornament",
      market: "US",
      metric: "bought_count",
      value: 100,
      unit: "past month",
      dataAt: "2026-10-22",
      sourceUrl: "https://amazon.com/dp/B000000001",
      niche: "Pet gifts",
      ...extra,
    },
    now,
  );
const costs = {
  sellingPrice: 40,
  discount: 0,
  productCost: 8,
  shipping: 2,
  duties: 0,
  feesPct: 3.5,
  feeFixed: 0,
  packaging: 0,
  returnsPct: 5,
  adCpa: 10,
};
const quote = {
  url: "https://supplier.example/item/1",
  quotedAt: "2026-10-22",
  processingDays: 2,
  transitDays: 8,
  personalizationDays: 0,
  destination: "US",
  currency: "USD",
};
const rank = (rows, records = {}, c = {}) =>
  rankEvidence(
    rows,
    records,
    { market: "US", deliveryTarget: "2026-12-20", ...c },
    now,
  );
test("observation validates exact provenance and genuine zero", () => {
  assert.equal(row({ value: 0 }).value, 0);
  for (const data of [
    { value: null },
    { externalId: "" },
    { dataAt: "2027-01-01" },
    { sourceUrl: "javascript:alert(1)" },
  ])
    assert.throws(() => row(data));
});
test("new collection cannot refresh old underlying evidence", () =>
  assert.equal(freshness(row({ dataAt: "2026-08-01" }), now).status, "stale"));
test("supplier catalog facts cannot manufacture demand or cross-platform corroboration", () => {
  const catalog = row({ platform: "supplier", metric: "catalog_price", value: 15.99, unit: "USD retail", identityKey: "catalog-test" });
  const only = rank([catalog])[0];
  assert.equal(only.verdict, "Supplier catalog only · validation pending");
  assert.equal(only.confidence, 0);
  assert.equal(only.dimensions.platformCoverage, 0);
  assert.equal(only.dimensions.independentSources, 0);
  assert.equal(only.dimensions.catalogSources, 1);
  assert.equal(only.dimensions.salesEvidence, null);
  assert.equal(only.economics.complete, false);
  const amazon = row({ identityKey: "catalog-test" });
  const combined = rank([amazon, catalog], {
    [productId("US", "catalog-test")]: { economics: costs, quotes: [{ ...quote, currency: "USD", destination: "US" }] },
  })[0];
  assert.equal(combined.dimensions.platformCoverage, 1);
  assert.ok(combined.missing.includes("Independent cross-platform corroboration"));
  assert.equal(combined.verdict, "Research candidate");
  // Defense in depth for already-stored / legacy supplier rows with misleading metrics.
  const legacy = rank([{ ...catalog, metric: "shop_sales", value: 9999 }])[0];
  assert.equal(legacy.dimensions.salesEvidence, null);
  assert.equal(legacy.confidence, 0);
});
test("supplier input rejects sales claims, niche scope, negative price and fractional reviews", () => {
  for (const extra of [
    { metric: "shop_sales" }, { metric: "views" },
    { metric: "catalog_price", scope: "niche" },
    { metric: "catalog_price", value: -1 },
    { metric: "rating_count", value: 1.5 },
  ]) assert.throws(() => row({ platform: "supplier", ...extra }), /Supplier records/);
});
test("missing shipping remains unknown", () =>
  assert.deepEqual(economics({ ...costs, shipping: null }).missing, [
    "shipping",
  ]));
test("independent recomputation includes fees returns and ads", () => {
  const r = economics(costs);
  assert.equal(r.contribution, 26.6);
  assert.equal(r.marginPct, 66.5);
  assert.equal(r.profitAfterAds, 16.6);
  assert.equal(r.breakEvenRoas, 1.5);
});
test("landed cost includes shipping exactly once", () =>
  assert.equal(
    economics({ ...costs, landedCost: 10, shipping: 20 }).contribution,
    26.6,
  ));
test("negative contribution not clamped", () =>
  assert.equal(economics({ ...costs, landedCost: 50 }).contribution, -13.4));
test("percentage and negative inputs rejected", () => {
  assert.throws(() => economics({ ...costs, feesPct: 101 }));
  assert.throws(() => economics({ ...costs, adCpa: -1 }));
});
test("niche-only records never become exact product candidates", () =>
  assert.equal(rank([row({ scope: "niche" })]).length, 0));
test("different variants/listings not merged by pet or gift keywords", () =>
  assert.equal(
    rank([
      row(),
      row({ externalId: "B000000002", title: "Christmas pet gift blanket" }),
    ]).length,
    2,
  ));
test("explicit shared identity explains cross-platform match", () => {
  const r = rank([
    row({ identityKey: "exact-ornament" }),
    row({ platform: "tiktok", identityKey: "exact-ornament", metric: "views" }),
  ]);
  assert.equal(r.length, 1);
  assert.equal(r[0].dimensions.platformCoverage, 2);
  assert.match(r[0].matchExplanation, /explicit/);
});
test("correlated duplicate platform imports cannot raise confidence", () => {
  const a = row({ identityKey: "x", correlationKey: "same" }),
    b = row({ platform: "tiktok", identityKey: "x", correlationKey: "same" });
  assert.equal(rank([a, b])[0].confidence, rank([a])[0].confidence);
});
test("modeled sales never increase confidence", () =>
  assert.equal(rank([row({ dataStatus: "modeled" })])[0].confidence, 0));
test("stale evidence is insufficient rather than low competition", () => {
  const p = rank([row({ dataAt: "2026-08-01" })])[0];
  assert.equal(p.verdict, "Insufficient evidence");
  assert.equal(p.dimensions.competition, null);
});
test("zero bought count does not prove sales", () =>
  assert.equal(rank([row({ value: 0 })])[0].dimensions.salesEvidence, null));
test("combined request preserves market cost margin and Christmas", () => {
  const p = parseRequest(
    "Find Christmas pet products in the US under $15 with 60% margin",
  );
  assert.equal(p.maxLandedCost, 15);
  assert.equal(p.minMargin, 60);
  assert.equal(p.market, "US");
  assert.equal(p.season, "christmas-2026");
  assert.equal(rank([row()], {}, p).length, 0);
});
test("explicit pet request cannot drift to unrelated gift", () =>
  assert.equal(
    rank(
      [row({ title: "Christmas kitchen gift", niche: "Kitchen" })],
      {},
      { query: "Find Christmas pet products" },
    ).length,
    0,
  ));
test("missing shipping and quote dates cannot pass delivery", () => {
  assert.equal(delivery({}, {}, now).status, "unverified");
  assert.equal(
    delivery({ ...quote, transitDays: null }, {}, now).status,
    "unverified",
  );
});
test("Christmas delivery planning has exact independent date math", () => {
  const d = delivery(quote, { season: "christmas-2026" }, now);
  assert.equal(d.latestOrderDate, "2026-12-05");
  assert.equal(d.testDeadline, "2026-11-28");
  assert.equal(
    delivery(
      { ...quote, quotedAt: "2026-12-06" },
      { season: "christmas-2026" },
      new Date("2026-12-07"),
    ).status,
    "too late",
  );
});
test("fresh sales economics delivery and independent corroboration unlock test", () => {
  const rows = [
    row({ identityKey: "x" }),
    row({ identityKey: "x", platform: "tiktok", metric: "views" }),
    row({ identityKey: "x", platform: "meta", metric: "advertiser_count" }),
  ];
  const id = rank(rows)[0].id;
  const records = { [id]: { economics: costs, quotes: [quote] } };
  assert.equal(rank(rows, records)[0].verdict, "Ready for controlled test");
  records[id].tests = [{ spend: 10, purchases: 1, revenue: 40 }];
  assert.equal(rank(rows, records)[0].verdict, "Validated by recorded test");
});
test("export preserves visible zero metrics and formula safety", () => {
  const p = rank([row({ title: "=EVIL", value: 0 })]);
  const out = csv(p);
  assert.match(out, /bought_count=0/);
  assert.match(out, /"'=EVIL"/);
});
test("isolated store survives close and restart and retains quotes/tests", async () => {
  const dir = await mkdtemp(join(tmpdir(), "evidence-"));
  try {
    const env = { EVIDENCE_FILE: join(dir, "store.json") };
    const a = createEvidenceStore(env);
    await a.mutate((d) => {
      d.observations.push(row());
      d.records.x = { quotes: [quote], tests: [{ spend: 4 }] };
    });
    await a.close();
    const b = createEvidenceStore(env);
    await b.mutate((d) => {
      d.observations.push(row({ value: 101 }));
    });
    const saved = await b.read();
    assert.equal(saved.observations.length, 2);
    assert.equal(saved.records.x.quotes.length, 1);
    assert.equal(saved.records.x.tests.length, 1);
    await b.close();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("production without persistent storage refuses ephemeral fallback", async () => {
  await assert.rejects(
    createEvidenceStore({ NODE_ENV: "production" }).init(),
    /requires DATABASE_URL or REDIS_URL/,
  );
});
import { parseEvidenceFile } from "../../client/src/evidenceImport.js";
test("CSV import preserves quoted commas newlines and zero", () => {
  const r = parseEvidenceFile(
    'title,value,unit\r\n"Pet, gift",0,"views\nlast week"',
    "source.csv",
  );
  assert.equal(r[0].title, "Pet, gift");
  assert.equal(r[0].value, "0");
  assert.equal(r[0].unit, "views\nlast week");
  assert.throws(() => parseEvidenceFile('title\n"unfinished', "x.csv"));
});
import { createAuth } from "../../server/auth.js";
test("expired tampered and malformed sessions fail authentication", () => {
  const auth = createAuth({ password: "fixture", secret: "fixture" });
  for (const cookie of [
    "ph_session=1.invalid",
    "ph_session=%E0%A4%A",
    "ph_session=9999999999999.invalid",
  ])
    assert.equal(auth.readSession({ headers: { cookie } }), false);
});
test("supplier variants change costs when selected", () => {
  const o = row(),
    id = rank([o])[0].id;
  const a = { ...quote, id: "a", economics: { ...costs, landedCost: 10 } },
    b = { ...quote, id: "b", economics: { ...costs, landedCost: 20 } };
  const r = { [id]: { selectedQuoteId: "a", quotes: [a, b] } };
  assert.equal(rank([o], r)[0].economics.contribution, 26.6);
  r[id].selectedQuoteId = "b";
  assert.equal(rank([o], r)[0].economics.contribution, 16.6);
});
test("required fresh platform filters exclude absent corroboration", () => {
  const c = parseRequest(
    "Show products with recent Amazon evidence and TikTok momentum",
  );
  assert.deepEqual(c.requiredPlatforms, ["amazon", "tiktok"]);
  assert.equal(rank([row()], {}, c).length, 0);
});
test("modeled status is case-insensitive and unknown statuses reject", () => {
  for (const status of ["MODELED", "Estimated", "estimated", "modeled"])
    assert.equal(rank([row({ dataStatus: status })])[0].confidence, 0);
  assert.throws(() => row({ dataStatus: "verified-winner" }), /status/);
});
test("market-specific IDs isolate quotes shortlists and tests", () => {
  const a = row({ identityKey: "shared" }),
    b = row({ identityKey: "shared", market: "UK" });
  const us = rank([a])[0];
  const uk = rank(
    [b],
    {
      [us.id]: {
        shortlisted: true,
        tests: [{ revenue: 40, spend: 1, purchases: 1 }],
      },
    },
    { market: "UK" },
  )[0];
  assert.notEqual(us.id, uk.id);
  assert.equal(uk.shortlisted, false);
  assert.equal(uk.tests.length, 0);
});
test("legacy records migrate only when market is unambiguous", () => {
  const source = row({ identityKey: "shared" });
  const legacyId = createHash("sha256")
    .update("shared")
    .digest("hex")
    .slice(0, 24);
  const db = {
    observations: [source],
    records: {
      [legacyId]: {
        shortlisted: true,
        quotes: [quote],
        tests: [{ purchases: 1 }],
      },
    },
  };
  migrateEvidenceRecords(db);
  assert.equal(db.records[productId("US", "shared")].quotes.length, 1);
  assert.equal(db.records[productId("US", "shared")].shortlisted, true);
  assert.ok(db.records[legacyId]);
  const ambiguous = {
    observations: [source, row({ identityKey: "shared", market: "UK" })],
    records: { [legacyId]: { shortlisted: true } },
  };
  migrateEvidenceRecords(ambiguous);
  assert.equal(ambiguous.records[productId("US", "shared")], undefined);
  assert.equal(ambiguous.records[productId("UK", "shared")], undefined);
});
test("CSV tags normalize before storage and invalid tags reject", () => {
  assert.deepEqual(row({ tags: "Christmas, pet,pet" }).tags, [
    "Christmas",
    "pet",
  ]);
  assert.equal(rank([row({ tags: "Christmas,pet" })]).length, 1);
  assert.throws(() => row({ tags: { pet: true } }), /Tags/);
});
test("negative planning days cannot extend delivery beyond target", () => {
  for (const k of ["contingencyDays", "testingDays"])
    assert.throws(
      () => delivery(quote, { season: "christmas-2026", [k]: -100 }, now),
      /Planning days/,
    );
});
test("nonseasonal research needs explicit delivery target", () => {
  assert.equal(delivery(quote, {}, now).status, "unverified");
  assert.equal(
    delivery(quote, { season: "christmas-2026" }, now).target,
    "2026-12-20",
  );
});
test("structured platform constraints survive natural language", () =>
  assert.deepEqual(
    parseRequest("Find pet products", { requiredPlatforms: ["amazon"] })
      .requiredPlatforms,
    ["amazon"],
  ));
test("latest genuine zero replaces positive sales proof and surfaces change", () => {
  const p = rank([row(), row({ dataAt: "2026-10-23", value: 0 })])[0];
  assert.equal(p.dimensions.salesEvidence, null);
  assert.ok(p.missing.some((x) => x.includes("conflicting")));
});
test("concurrent initialization and reads share a completed store", async () => {
  const dir = await mkdtemp(join(tmpdir(), "evidence-init-"));
  try {
    const s = createEvidenceStore({
      EVIDENCE_FILE: join(dir, "nested", "store.json"),
    });
    const results = await Promise.all([s.init(), s.read(), s.read()]);
    assert.equal(results[0], "file");
    assert.deepEqual(results[1].observations, []);
    assert.deepEqual(results[2].observations, []);
    await s.close();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("negative profit after ads blocks readiness despite high pre-ad margin", () => {
  const rows = [row({identityKey:'loss'}), row({identityKey:'loss',platform:'tiktok',metric:'views'}), row({identityKey:'loss',platform:'meta',metric:'advertiser_count'})];
  const id = rank(rows)[0].id;
  const result = rank(rows, {[id]:{economics:{...costs,adCpa:30},quotes:[quote]}})[0];
  assert.equal(result.economics.profitAfterAds,-3.4);
  assert.equal(result.verdict,'Avoid / fails economics or delivery');
});

import {matchDiscovery} from '../../server/evidence.js';
test('explicit discovery match retains original metrics dates and manual provenance',()=>{
  const source=row({platform:'tiktok',scope:'niche',metric:'views',value:900});
  const input={observationId:source.id,title:'Christmas pet ornament',listingUrl:'https://supplier.example/item/1',variant:'red single',confirmed:true};
  const matched=matchDiscovery([source],input,now);
  assert.equal(matched.length,1);
  assert.notEqual(matched[0].id,source.id);
  assert.equal(matched[0].dataAt,source.dataAt);
  assert.equal(matched[0].value,900);
  assert.equal(matched[0].metric,'views');
  assert.equal(matched[0].dataStatus,'manual');
  assert.equal(source.scope,'niche');
  assert.equal(rank([source,...matched])[0].dimensions.salesEvidence,null);
  assert.equal(matchDiscovery([source],input,now)[0].id,matched[0].id);
  assert.notEqual(matchDiscovery([source],{...input,variant:'blue single'},now)[0].identityKey,matched[0].identityKey);
  assert.throws(()=>matchDiscovery([source],{...input,confirmed:false},now));
  assert.throws(()=>matchDiscovery([row({scope:'niche',platform:'google'})],input,now));
});
