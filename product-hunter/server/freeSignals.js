/**
 * Free trusted demand signals (no paid Keepa / Jungle Scout).
 * Primary: Wikimedia Pageviews (public REST API, no key).
 * Optional: Google Trends (unofficial; often blocked on cloud IPs — soft-fail).
 */

const cache = new Map();
const CACHE_MS = 6 * 60 * 60 * 1000;
const UA = "SignalDesk/1.0 (product research; contact: local-dev)";

/** Niche → English Wikipedia article titles (underscored). */
const WIKI_MAP = {
  "Pet Supplies": ["Pet", "Dog_toy", "Cat_litter"],
  "Home Fitness Gear": ["Exercise_equipment", "Physical_fitness", "Resistance_band"],
  "Eco Kitchen Gadgets": ["Kitchen_utensil", "Reusable_shopping_bag", "Zero_waste"],
  "Beauty Tools & Accessories": ["Cosmetics", "Hair_iron", "Skincare"],
  "Baby Travel & Nursery Accessories": ["Baby_transport", "Infant", "Diaper_bag"],
  "Desk & WFH Comfort Accessories": ["Remote_work", "Computer_desk", "Ergonomics"],
  "Outdoor Micro-Adventure Gear": ["Camping", "Hiking", "Outdoor_recreation"],
  "Travel Packing & Compression Accessories": ["Luggage", "Travel", "Packing"],
  "Car Interior Micro-Accessories": ["Car", "Automotive", "Cleaning"],
  "Phone Creator Tripod & Lighting Kits": ["Photography", "Smartphone", "Videography"],
};

function ymd(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function clamp(n, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number.isFinite(n) ? n : 0));
}

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_MS) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(key, value) {
  cache.set(key, { at: Date.now(), value });
  return value;
}

async function wikiDailyViews(title, start, end) {
  const url =
    `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/` +
    `en.wikipedia/all-access/user/${encodeURIComponent(title)}/daily/${start}/${end}`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return (data.items || []).map((i) => Number(i.views) || 0);
}

function scoreFromViewSeries(views) {
  if (!views?.length) return null;
  const half = Math.floor(views.length / 2) || 1;
  const older = views.slice(0, half);
  const newer = views.slice(half);
  const sum = (arr) => arr.reduce((a, b) => a + b, 0);
  const olderSum = sum(older) || 1;
  const newerSum = sum(newer);
  const total = sum(views);
  // Log scale: ~1k/day niche → mid; millions → high
  const volumeScore = clamp(((Math.log10(total / Math.max(views.length, 1) + 1) - 2) / 3) * 100);
  const momentum = newerSum / olderSum;
  const momentumScore = clamp(50 + (momentum - 1) * 80);
  const interest = Math.round(volumeScore * 0.65 + momentumScore * 0.35);
  return {
    interestScore: clamp(interest),
    avgDailyViews: Math.round(total / views.length),
    momentum: Math.round(momentum * 100) / 100,
    days: views.length,
  };
}

async function fetchWikipediaInterest(niche) {
  const titles = WIKI_MAP[niche] || [
    String(niche || "Retail")
      .split(/\s+/)
      .slice(0, 3)
      .map((w) => w.replace(/[^a-zA-Z0-9]/g, ""))
      .filter(Boolean)
      .join("_") || "Retail",
  ];

  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 59);
  const startS = ymd(start);
  const endS = ymd(end);

  const results = await Promise.all(
    titles.slice(0, 3).map(async (title) => {
      try {
        const views = await wikiDailyViews(title, startS, endS);
        const scored = scoreFromViewSeries(views);
        if (scored) return { title: title.replace(/_/g, " "), ...scored };
      } catch {
        /* soft-fail per article */
      }
      return null;
    })
  );
  const ok = results.filter(Boolean);
  if (!ok.length) return null;

  const interestScore = Math.round(
    ok.reduce((s, r) => s + r.interestScore, 0) / ok.length
  );
  return {
    provider: "Wikimedia Pageviews",
    free: true,
    trusted: true,
    cost: "$0 — public REST API, no key",
    interestScore: clamp(interestScore),
    articles: ok,
    note: "Relative public interest proxy (Wikipedia reads), not Amazon sales units.",
    url: "https://wikimedia.org/api/rest_v1/",
  };
}

/**
 * Soft Google Trends probe — often fails on Render/datacenter. Never throws.
 */
async function fetchGoogleTrendsSoft(keyword, geo = "US") {
  try {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 3);
    const params = new URLSearchParams({
      hl: "en-US",
      tz: "0",
      req: JSON.stringify({
        comparisonItem: [{ keyword, geo: String(geo || "US").toUpperCase(), time: "today 3-m" }],
        category: 0,
        property: "",
      }),
    });
    const explore = await fetch(
      `https://trends.google.com/trends/api/explore?${params}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!explore.ok) return null;
    const raw = await explore.text();
    const json = JSON.parse(raw.replace(/^\)\]\}',?\n?/, ""));
    const widget = (json.widgets || []).find((w) => w.id === "TIMESERIES");
    if (!widget) return null;

    const dataParams = new URLSearchParams({
      hl: "en-US",
      tz: "0",
      req: JSON.stringify(widget.request),
      token: widget.token,
    });
    const seriesRes = await fetch(
      `https://trends.google.com/trends/api/widgetdata/multiline?${dataParams}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!seriesRes.ok) return null;
    const seriesRaw = await seriesRes.text();
    const series = JSON.parse(seriesRaw.replace(/^\)\]\}',?\n?/, ""));
    const values = (series.default?.timelineData || [])
      .map((t) => Number(t.value?.[0]))
      .filter((n) => Number.isFinite(n));
    if (!values.length) return null;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return {
      provider: "Google Trends",
      free: true,
      trusted: true,
      cost: "$0 — no API key (unofficial; may fail on cloud IPs)",
      interestScore: clamp(Math.round(avg)),
      points: values.length,
      note: "Relative search interest 0–100 for the term (not absolute volume, not Amazon units).",
      url: "https://trends.google.com/",
    };
  } catch {
    return null;
  }
}

/**
 * Free demand signal bundle for a niche.
 */
export async function fetchFreeDemandSignal(niche, geo = "US") {
  const normalizedGeo = String(geo || "US").toUpperCase().replace("GB", "UK");
  const trendsGeo = normalizedGeo === "UK" ? "GB" : normalizedGeo === "GLOBAL" ? "US" : normalizedGeo;
  const key = `free:${String(niche || "").toLowerCase()}:${trendsGeo}`;
  const cached = cacheGet(key);
  if (cached) return { ...cached, cached: true };

  const wiki = await fetchWikipediaInterest(niche);
  // Google Trends often hangs / 429 on cloud + Windows — opt-in only
  const trends =
    process.env.ENABLE_GOOGLE_TRENDS === "1"
      ? await fetchGoogleTrendsSoft(String(niche || "").split("&")[0].trim(), trendsGeo)
      : null;

  const parts = [wiki, trends].filter(Boolean);
  if (!parts.length) {
    return cacheSet(key, {
      ok: false,
      free: true,
      interestScore: null,
      providers: [],
      honesty:
        "No live free feed responded. Falling back to cited industry benchmarks only. Amazon unit sales still need Keepa (paid).",
    });
  }

  const interestScore = Math.round(
    parts.reduce((s, p) => s + (p.interestScore || 0), 0) / parts.length
  );

  return cacheSet(key, {
    ok: true,
    free: true,
    interestScore: clamp(interestScore),
    providers: parts,
    honesty:
      `Free trusted signals: Wikimedia Pageviews + Google Trends for ${trendsGeo} when reachable. These measure public interest — NOT Keepa/Amazon sold units.`,
    market: trendsGeo,
    amazonUnits: {
      available: false,
      reason: "Amazon sales/rank history requires Keepa API (~€49+/mo) — no free tier.",
    },
  });
}
