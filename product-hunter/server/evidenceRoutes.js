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
} from "./evidence.js";
import { collect, capabilities } from "./evidenceProviders.js";
export const evidenceRouter = express.Router();
const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (e) {
    res
      .status(400)
      .json({
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
let active = false,
  lastRun = 0;
evidenceRouter.post(
  "/research",
  wrap(async (req, res) => {
    if (active)
      return res
        .status(429)
        .json({
          error: "A collection is already running. Retry after it completes.",
        });
    const constraints = parseRequest(
      String(req.body.query || ""),
      req.body.constraints || {},
    );
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
    const result = await evidenceStore.mutate((db) => {
      const r = (db.records[req.params.id] ??= {
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
