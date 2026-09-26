/**
 * Keepa — one-time snapshot OR optional live pull.
 * Default path: free signals + drop a Keepa JSON dump in data/keepa-snapshot.json
 * No monthly API required for day-to-day use.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_PATH = join(__dirname, "data", "keepa-snapshot.json");

let cached = null;

function centsToUsd(n) {
  if (n == null || n < 0 || !Number.isFinite(Number(n))) return null;
  return Math.round(Number(n)) / 100;
}

function normalizeEntry(raw = {}) {
  const asin = String(raw.asin || raw.ASIN || "").toUpperCase().trim();
  const title = String(raw.title || raw.Title || "").trim();
  const monthlySold =
    raw.monthlySold ?? raw.monthly_sold ?? raw.boughtPastMonth ?? null;
  const stats = raw.stats || {};
  const avg30 = stats.avg30 || raw.avg30 || [];
  const avg90 = stats.avg90 || raw.avg90 || [];
  const current = stats.current || raw.current || [];

  // Keepa csv index 3 = SALES rank; index 1 = NEW price (cents)
  const salesRank =
    raw.salesRank ??
    raw.currentSalesRank ??
    (Array.isArray(current) && current[3] >= 0 ? current[3] : null) ??
    (Array.isArray(avg30) && avg30[3] >= 0 ? avg30[3] : null);

  const avgPriceUsd =
    centsToUsd(raw.avgPriceCents) ??
    centsToUsd(Array.isArray(avg30) ? avg30[1] : null) ??
    centsToUsd(Array.isArray(avg90) ? avg90[1] : null) ??
    (Number.isFinite(Number(raw.avgPriceUsd)) ? Number(raw.avgPriceUsd) : null);

  const buyBoxUsd =
    centsToUsd(raw.buyBoxCents) ??
    centsToUsd(Array.isArray(current) ? current[18] : null) ??
    centsToUsd(Array.isArray(current) ? current[1] : null) ??
    (Number.isFinite(Number(raw.buyBoxUsd)) ? Number(raw.buyBoxUsd) : null);

  return {
    asin: asin || null,
    title,
    titleKey: title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(),
    niche: raw.niche || raw.category || null,
    monthlySold: Number.isFinite(Number(monthlySold)) ? Number(monthlySold) : null,
    salesRank: Number.isFinite(Number(salesRank)) && Number(salesRank) >= 0 ? Number(salesRank) : null,
    avgPriceUsd,
    buyBoxUsd,
    rating: Number.isFinite(Number(raw.rating ?? raw.csv?.[16]))
      ? Number(raw.rating ?? raw.csv?.[16])
      : null,
    reviewCount: Number.isFinite(Number(raw.reviewCount ?? raw.totalReviews))
      ? Number(raw.reviewCount ?? raw.totalReviews)
      : null,
    amazonUrl: asin ? `https://www.amazon.com/dp/${asin}` : null,
    source: raw.source || "keepa-snapshot",
    capturedAt: raw.capturedAt || null,
  };
}

export function loadKeepaSnapshot({ force = false } = {}) {
  if (cached && !force) return cached;
  if (!existsSync(SNAPSHOT_PATH)) {
    cached = {
      ok: false,
      mode: "none",
      path: SNAPSHOT_PATH,
      products: [],
      meta: {
        note: "No Keepa snapshot yet. Use free signals, or run one-time pull / drop JSON at server/data/keepa-snapshot.json",
      },
    };
    return cached;
  }
  try {
    const raw = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8"));
    const list = Array.isArray(raw) ? raw : raw.products || [];
    const products = list.map(normalizeEntry).filter((p) => p.asin || p.title);
    cached = {
      ok: products.length > 0,
      mode: "snapshot",
      path: SNAPSHOT_PATH,
      products,
      meta: {
        capturedAt: raw.capturedAt || raw.meta?.capturedAt || null,
        domain: raw.domain || raw.meta?.domain || "com",
        count: products.length,
        note:
          raw.note ||
          "One-time Keepa dump — not a live API feed. Refresh by re-running pull or replacing this file.",
        oneTime: true,
      },
    };
    return cached;
  } catch (err) {
    cached = {
      ok: false,
      mode: "error",
      path: SNAPSHOT_PATH,
      products: [],
      meta: { note: err.message },
    };
    return cached;
  }
}

function titleSimilarity(a, b) {
  const ta = new Set(String(a || "").split(/\s+/).filter((w) => w.length > 2));
  const tb = new Set(String(b || "").split(/\s+/).filter((w) => w.length > 2));
  if (!ta.size || !tb.size) return 0;
  let hit = 0;
  for (const w of ta) if (tb.has(w)) hit++;
  return hit / Math.max(ta.size, tb.size);
}

/**
 * Match a hunted product to a Keepa snapshot row (ASIN or fuzzy title).
 */
export function matchKeepaToProduct(product = {}, snapshot = loadKeepaSnapshot()) {
  if (!snapshot?.ok || !snapshot.products?.length) return null;
  const asin = String(product.asin || product.amazonAsin || "").toUpperCase();
  if (asin) {
    const byAsin = snapshot.products.find((p) => p.asin === asin);
    if (byAsin) return { ...byAsin, match: "asin" };
  }
  const title = String(product.title || "").toLowerCase();
  let best = null;
  let bestScore = 0;
  for (const p of snapshot.products) {
    if (product.niche && p.niche && product.niche !== p.niche) {
      // soft prefer same niche but don't skip
    }
    const score = titleSimilarity(title, p.titleKey);
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  if (best && bestScore >= 0.45) {
    return { ...best, match: "title", matchScore: Math.round(bestScore * 100) / 100 };
  }
  return null;
}

export function keepaStatus() {
  const snap = loadKeepaSnapshot({ force: true });
  return {
    liveKeyConfigured: Boolean(process.env.KEEPA_API_KEY),
    snapshot: {
      ok: snap.ok,
      mode: snap.mode,
      count: snap.products?.length || 0,
      meta: snap.meta,
    },
    recommendation:
      "Day-to-day: free Wikimedia + benchmarks. Amazon proof: one-time Keepa dump (buy API 1 month → pull → cancel), not forever live key.",
  };
}

/**
 * Live pull a list of ASINs once and write snapshot file.
 * Requires KEEPA_API_KEY. Domain 1 = amazon.com
 */
export async function pullKeepaOnce(asins = [], { domain = 1, niche = null } = {}) {
  const key = process.env.KEEPA_API_KEY;
  if (!key) {
    throw new Error("KEEPA_API_KEY missing — set it only for this one-time pull");
  }
  const list = [...new Set(asins.map((a) => String(a).toUpperCase().trim()).filter(Boolean))];
  if (!list.length) throw new Error("Provide at least one ASIN");

  const url =
    `https://api.keepa.com/product?key=${encodeURIComponent(key)}` +
    `&domain=${domain}&asin=${list.join(",")}&stats=90&history=0&offers=0`;

  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) {
    throw new Error(`Keepa HTTP ${res.status}`);
  }
  const data = await res.json();
  if (data.error) throw new Error(data.error?.message || String(data.error));

  const products = (data.products || []).map((p) =>
    normalizeEntry({
      ...p,
      niche,
      source: "keepa-api-one-time",
      capturedAt: new Date().toISOString(),
      stats: p.stats,
      monthlySold: p.monthlySold,
    })
  );

  const existing = loadKeepaSnapshot({ force: true });
  const byAsin = new Map();
  for (const p of existing.products || []) {
    if (p.asin) byAsin.set(p.asin, p);
  }
  for (const p of products) {
    if (p.asin) byAsin.set(p.asin, p);
  }

  const payload = {
    capturedAt: new Date().toISOString(),
    domain: domain === 1 ? "com" : String(domain),
    note: "One-time Keepa API pull. Safe to cancel the Keepa plan after this file exists.",
    tokensLeft: data.tokensLeft,
    products: [...byAsin.values()],
  };
  writeFileSync(SNAPSHOT_PATH, JSON.stringify(payload, null, 2), "utf8");
  cached = null;
  return loadKeepaSnapshot({ force: true });
}

/**
 * Manual one-time Amazon observation (you copy from amazon.com in your browser).
 * Not scraping — legal/ToS-safe path for free Amazon proof.
 */
export function saveManualAmazonEntries(entries = []) {
  const list = (Array.isArray(entries) ? entries : [entries])
    .map((e) => {
      const asin = String(e.asin || "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 10);
      let monthlySold = e.monthlySold;
      if (monthlySold == null && e.boughtText) {
        const m = String(e.boughtText).replace(/,/g, "").match(/(\d+)\s*\+?/);
        monthlySold = m ? Number(m[1]) : null;
      }
      return normalizeEntry({
        asin: asin.length === 10 ? asin : null,
        title: e.title || "",
        niche: e.niche || null,
        monthlySold,
        salesRank: e.salesRank,
        buyBoxUsd: e.buyBoxUsd ?? e.priceUsd,
        avgPriceUsd: e.avgPriceUsd ?? e.priceUsd,
        rating: e.rating,
        reviewCount: e.reviewCount,
        source: "manual-amazon-paste",
        capturedAt: new Date().toISOString(),
      });
    })
    .filter((p) => p.asin || p.title);

  if (!list.length) {
    throw new Error("Need at least ASIN or title + numbers from Amazon page");
  }

  const existing = loadKeepaSnapshot({ force: true });
  const byKey = new Map();
  for (const p of existing.products || []) {
    byKey.set(p.asin || p.titleKey, p);
  }
  for (const p of list) {
    byKey.set(p.asin || p.titleKey, p);
  }

  const payload = {
    capturedAt: new Date().toISOString(),
    domain: "com",
    note: "Manual Amazon paste (one-time). Copied from amazon.com by a human — not scraped, not Keepa API.",
    products: [...byKey.values()],
  };
  writeFileSync(SNAPSHOT_PATH, JSON.stringify(payload, null, 2), "utf8");
  cached = null;
  return loadKeepaSnapshot({ force: true });
}

export function attachKeepaToProducts(products = [], opportunity = {}) {
  const snap = loadKeepaSnapshot();
  return products.map((p) => {
    const keepa = matchKeepaToProduct(
      { ...p, niche: opportunity.niche || p.category },
      snap
    );
    if (!keepa) {
      return {
        ...p,
        keepa: null,
        keepaStatus: snap.ok
          ? { matched: false, note: "No ASIN/title match in one-time snapshot" }
          : { matched: false, note: snap.meta?.note },
      };
    }
    return {
      ...p,
      asin: p.asin || keepa.asin,
      keepa,
      keepaStatus: { matched: true, mode: "snapshot" },
      productLinks: {
        ...(p.productLinks || {}),
        primary: keepa.amazonUrl
          ? { label: "Amazon ASIN", url: keepa.amazonUrl }
          : p.productLinks?.primary,
        links: [
          ...(keepa.amazonUrl
            ? [{ id: "amazon-asin", label: "Amazon ASIN", kind: "compete", url: keepa.amazonUrl }]
            : []),
          ...((p.productLinks?.links || []).filter((l) => l.id !== "amazon")),
          ...((p.productLinks?.links || []).filter((l) => l.id === "amazon")),
        ],
      },
    };
  });
}
