import express from "express";
import crypto from "node:crypto";
import { evidenceStore } from "./evidenceStore.js";
import {
  observation,
  rankEvidence,
  parseRequest,
  csv,
  httpUrl,
  finite,
  VERSION,
  economics,
  delivery,
  productId,
  matchDiscovery,
  relevant,
} from "./evidence.js";
import { collect, capabilities } from "./evidenceProviders.js";
import { apifyConfigured, normalizeTikTokExport, readApifyDataset } from "./apifyEvidence.js";
import { createAutomaticHunter } from "./automaticHunt.js";
const automaticHunter = createAutomaticHunter(evidenceStore);
export const evidenceRouter = express.Router();
const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (e) {
    res.status(400).json({
      error: e.message?.includes("requires DATABASE_URL")
        ? e.message
        : "Evidence operation failed: " + e.message,
    });
  }
};
function mergeObservations(db, rows) {
  const ids = new Set(db.observations.map((o) => o.id));
  for (const row of rows)
    if (!ids.has(row.id)) {
      db.observations.push(row);
      ids.add(row.id);
    }
  return rows.length;
}
evidenceRouter.get(
  "/status",
  wrap(async (_req, res) => {
    let storage = "unavailable";
    try {
      storage = await evidenceStore.init();
    } catch {}
    res.json({
      version: VERSION,
      apify: { configured: apifyConfigured(), mode: "free-only-automatic", startsActors: true, maxRunUsd: 0.5, maxRunsPerCycle: 8 },
      storage,
      providers: capabilities(),
      monitoring:
        "Manual refresh only. No scheduled/background monitor configured.",
    });
  }),
);
evidenceRouter.get(
  "/state",
  wrap(async (_req, res) => res.json(await evidenceStore.read())),
);
evidenceRouter.post(
  "/import",
  wrap(async (req, res) => {
    const rows = req.body.observations;
    if (!Array.isArray(rows) || !rows.length || rows.length > 1000)
      throw new Error("Provide 1–1000 observations");
    const normalized = rows.map((row) =>
      observation({ ...row, collectionMethod: "manual" }),
    );
    await evidenceStore.mutate((db) => mergeObservations(db, normalized));
    res.json({ ok: true, count: normalized.length });
  }),
);
evidenceRouter.post('/hunt/start', wrap(async (req,res) => res.json(await automaticHunter.start(req.body))));
evidenceRouter.post('/match', wrap(async (req, res) => {
  const result = await evidenceStore.mutate(db => {
    const rows = matchDiscovery(db.observations, req.body);
    mergeObservations(db, rows);
    return { count: rows.length, productId: productId(rows[0].market, rows[0].identityKey) };
  });
  res.json({ ok: true, ...result });
}));
evidenceRouter.get('/hunt/:id', wrap(async (req,res) => res.json(await automaticHunter.poll(req.params.id))));
// Import raw provider output without asking users to hand-build observation rows.
evidenceRouter.post('/apify/sync', wrap(async (req, res) => {
  const market = String(req.body.market || 'US').toUpperCase();
  if (!/^[A-Z]{2}$/.test(market)) throw new Error('Two-letter market required');
  const options = { market, query: String(req.body.query || '').slice(0,200) };
  const result = req.body.datasetId
    ? await readApifyDataset(String(req.body.datasetId), options)
    : normalizeTikTokExport(req.body.items, options);
  await evidenceStore.mutate(db => {
    mergeObservations(db, result.observations);
    db.runs.push({platform:'tiktok', provider:'Apify dataset', status:result.observations.length ? 'success':'unavailable', completedAt:new Date().toISOString(), count:result.observations.length, rejected:result.rejected, reason:'Read-only sync; no Actor started and no paid subscription enabled.'});
  });
  res.json({ok:true, count:result.observations.length, acceptedVideos:result.acceptedVideos, rejected:result.rejected});
}));
let active = false,
  lastRun = 0;
evidenceRouter.post(
  "/research",
  wrap(async (req, res) => {
    if (active)
      return res.status(429).json({
        error: "A collection is already running. Retry after it completes.",
      });
    const constraints = parseRequest(
      String(req.body.query || ""),
      req.body.constraints || {},
    );
    for (const k of ["contingencyDays", "testingDays"])
      if (
        constraints[k] != null &&
        (finite(constraints[k]) === null ||
          finite(constraints[k]) < 0 ||
          finite(constraints[k]) > 365)
      )
        throw new Error("Planning days must be between 0 and 365");
    let runs = [];
    if (req.body.refresh !== false) {
      if (Date.now() - lastRun < 3000)
        return res
          .status(429)
          .json({ error: "Wait three seconds between provider refreshes." });
      active = true;
      lastRun = Date.now();
      try {
        runs = await collect(constraints);
        await evidenceStore.mutate((db) => {
          mergeObservations(
            db,
            runs.flatMap((r) => r.observations),
          );
          db.runs.push(
            ...runs.map(({ observations, ...r }) => ({
              ...r,
              count: observations.length,
              query: constraints.query,
              market: constraints.market,
            })),
          );
        });
      } finally {
        active = false;
      }
    }
    const data = await evidenceStore.read(),
      products = rankEvidence(data.observations, data.records, constraints);
    const niches = Object.entries(
      Object.groupBy
        ? Object.groupBy(products, (p) => p.niche)
        : products.reduce((a, p) => {
            (a[p.niche] ??= []).push(p);
            return a;
          }, {}),
    ).map(([name, items]) => ({
      name,
      productIds: items.map((p) => p.id),
      count: items.length,
      platforms: [
        ...new Set(items.flatMap((p) => p.observations.map((o) => o.platform))),
      ],
      reason:
        "Grouped from exact product observations; investigate original evidence before testing.",
    }));
    const session = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      constraints,
      products,
      discoveries: data.observations.filter(o => o.scope === "niche" && relevant(o, constraints)).slice(-100),
      niches,
      providers: runs.map(({ observations, ...r }) => ({
        ...r,
        count: observations.length,
      })),
      count: products.length,
      note: products.length
        ? "Ranked from dated exact observations. No guaranteed winners."
        : "No relevant product-level evidence. Import dated records or configure providers; no invented candidates added.",
    };
    await evidenceStore.mutate((db) => {
      db.sessions.push(session);
      db.sessions = db.sessions.slice(-100);
    });
    res.json(session);
  }),
);
evidenceRouter.post(
  "/products/:id",
  wrap(async (req, res) => {
    if (!/^[a-f0-9]{24}$/.test(req.params.id))
      throw new Error("Invalid product ID");
    if (req.body.economics) economics(req.body.economics);
    if (req.body.quote) {
      const q = req.body.quote;
      if (q.economics) economics(q.economics);
      if (!q.destination || q.currency !== "USD")
        throw new Error("Quote destination and USD currency required");
      for (const k of ["processingDays", "transitDays", "personalizationDays"])
        if (finite(q[k]) === null || finite(q[k]) < 0)
          throw new Error(
            "Quote processing, transit and personalization days must be nonnegative",
          );
      if (Date.parse(q.quotedAt) > Date.now())
        throw new Error("Quote date cannot be in the future");
    }
    const result = await evidenceStore.mutate((db) => {
      const observed = db.observations.find(
        (o) => productId(o.market, o.identityKey) === req.params.id,
      );
      if (!observed) throw new Error("Product not found");
      const r = (db.records[req.params.id] ??= {
        market: observed.market,
        quotes: [],
        tests: [],
        history: [],
      });
      if (req.body.shortlisted != null) r.shortlisted = !!req.body.shortlisted;
      if (req.body.economics) {
        r.economics = req.body.economics;
        const q = r.quotes.find((q) => q.id === r.selectedQuoteId);
        if (q) q.economics = req.body.economics;
      }
      if (req.body.quote) {
        const q = req.body.quote;
        if (
          !httpUrl(q.url) ||
          !q.supplier ||
          !q.variant ||
          !q.quotedAt ||
          !Number.isFinite(Date.parse(q.quotedAt))
        )
          throw new Error("Supplier, exact URL, variant and quotedAt required");
        const quote = {
          ...q,
          id: crypto.randomUUID(),
          verificationStatus: "user-supplied quote; not independently verified",
        };
        r.quotes.push(quote);
        r.selectedQuoteId = quote.id;
      }
      if (req.body.selectedQuoteId) {
        if (!r.quotes.some((q) => q.id === req.body.selectedQuoteId))
          throw new Error("Unknown quote");
        r.selectedQuoteId = req.body.selectedQuoteId;
      }
      if (req.body.test) {
        for (const k of ["spend", "revenue", "purchases"])
          if (finite(req.body.test[k]) === null || Number(req.body.test[k]) < 0)
            throw new Error(
              "Test spend, revenue and purchases must be non-negative numbers",
            );
        if (!Number.isInteger(Number(req.body.test.purchases)))
          throw new Error("Test purchases must be a whole number");
        r.tests.push({
          ...req.body.test,
          recordedAt: new Date().toISOString(),
        });
      }
      r.history.push({
        at: new Date().toISOString(),
        action: req.body.quote
          ? "quote"
          : req.body.test
            ? "test"
            : req.body.economics
              ? "economics"
              : "shortlist",
      });
      return r;
    });
    res.json(result);
  }),
);
evidenceRouter.post(
  "/export",
  wrap(async (req, res) => {
    const data = await evidenceStore.read(),
      session = data.sessions.find((s) => s.id === req.body.sessionId);
    if (!session) throw new Error("Research session not found");
    res
      .type("text/csv")
      .attachment("signal-desk-research.csv")
      .send(csv(session.products));
  }),
);
