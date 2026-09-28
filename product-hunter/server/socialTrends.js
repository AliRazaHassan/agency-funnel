/**
 * TikTok + Meta trending research (NOT scraped shop GMV).
 * - TikTok: soft-hit Creative Center public radar API when reachable; else curated board + deep links
 * - Meta: Ad Library deep links (+ optional Graph API if META_AD_LIBRARY_TOKEN set)
 * - Manual snapshot: server/data/social-trends-snapshot.json
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_PATH = join(__dirname, "data", "social-trends-snapshot.json");

const REGION_MAP = {
  Global: { tiktok: "US", meta: "US", label: "US (proxy for Global)" },
  US: { tiktok: "US", meta: "US", label: "United States" },
  UK: { tiktok: "GB", meta: "GB", label: "United Kingdom" },
  CA: { tiktok: "CA", meta: "CA", label: "Canada" },
  AU: { tiktok: "AU", meta: "AU", label: "Australia" },
  DE: { tiktok: "DE", meta: "DE", label: "Germany" },
  FR: { tiktok: "FR", meta: "FR", label: "France" },
  Gulf: { tiktok: "AE", meta: "AE", label: "UAE / Gulf proxy" },
};

/** Curated evergreen social-commerce board — labeled seed, not live sold units */
const SEED_TRENDS = {
  US: [
    {
      platform: "tiktok",
      title: "Portable neck fan / personal cooling",
      category: "Home & Lifestyle",
      trendSignal: "high",
      why: "Seasonal heat + demo-friendly UGC on TikTok Shop / Spark Ads",
    },
    {
      platform: "tiktok",
      title: "Phone camera lens / clip-on light kits",
      category: "Consumer Electronics",
      trendSignal: "high",
      why: "Creator tools — strong before/after video hooks",
    },
    {
      platform: "tiktok",
      title: "Pet slow feeder / lick mat",
      category: "Pet Supplies",
      trendSignal: "medium",
      why: "Evergreen pet UGC; pairs with Amazon/Shopify DTC",
    },
    {
      platform: "tiktok",
      title: "Resistance bands / home pilates set",
      category: "Sports & Outdoors",
      trendSignal: "medium",
      why: "Home fitness creative volume stays high year-round",
    },
    {
      platform: "meta",
      title: "Skincare devices / LED masks (generic)",
      category: "Beauty",
      trendSignal: "high",
      why: "Meta Advantage+ catalog ads — check Ad Library creatives, not claimed GMV",
    },
    {
      platform: "meta",
      title: "Kitchen gadget / air fryer accessories",
      category: "Home & Kitchen",
      trendSignal: "medium",
      why: "Broad interest targeting + UGC demos common in Ad Library",
    },
    {
      platform: "meta",
      title: "Baby travel / stroller organizers",
      category: "Baby",
      trendSignal: "medium",
      why: "Parenting interest clusters; verify ads density in Ad Library",
    },
    {
      platform: "meta",
      title: "Desk / WFH posture accessories",
      category: "Office",
      trendSignal: "medium",
      why: "Evergreen remote-work creatives on Facebook/Instagram",
    },
  ],
  GB: null,
  AE: null,
};

SEED_TRENDS.GB = SEED_TRENDS.US.map((t) => ({
  ...t,
  why: `${t.why} (UK creative angle — localise hooks)`,
}));
SEED_TRENDS.CA = SEED_TRENDS.US.map((t) => ({ ...t, why: `${t.why} (Canada — localise pricing and shipping)` }));
SEED_TRENDS.AU = SEED_TRENDS.US.map((t) => ({ ...t, why: `${t.why} (Australia — validate seasonality and shipping)` }));
SEED_TRENDS.DE = SEED_TRENDS.US.map((t) => ({ ...t, why: `${t.why} (Germany — localise language and compliance)` }));
SEED_TRENDS.FR = SEED_TRENDS.US.map((t) => ({ ...t, why: `${t.why} (France — localise language and creative)` }));
SEED_TRENDS.AE = SEED_TRENDS.US.map((t) => ({
  ...t,
  why: `${t.why} (Gulf — heat / gifting / mobile-first creatives)`,
}));

function researchLinks(title, region) {
  const q = encodeURIComponent(title);
  const { tiktok, meta } = REGION_MAP[region] || REGION_MAP.Global;
  return {
    tiktokCreativeCenter: `https://ads.tiktok.com/business/creativecenter/inspiration/popular/pc/en?countryCode=${tiktok}`,
    tiktokTopProducts: `https://ads.tiktok.com/business/creativecenter/inspiration/popular/product/pc/en?countryCode=${tiktok}`,
    metaAdLibrary: `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${meta}&q=${q}&search_type=keyword_unordered&media_type=all`,
  };
}

function loadManualSnapshot() {
  if (!existsSync(SNAPSHOT_PATH)) return [];
  try {
    const raw = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8"));
    return Array.isArray(raw) ? raw : raw.items || [];
  } catch {
    return [];
  }
}

export function saveManualSocialTrends(items = []) {
  const list = (Array.isArray(items) ? items : [items])
    .map((i) => ({
      platform: i.platform === "meta" ? "meta" : "tiktok",
      title: String(i.title || "").trim(),
      category: i.category || "General",
      trendSignal: i.trendSignal || "manual",
      metric: i.metric || i.note || "Manual observation",
      region: i.region || "US",
      source: "manual-paste",
      capturedAt: new Date().toISOString(),
    }))
    .filter((i) => i.title);
  if (!list.length) throw new Error("Need at least one title");

  const existing = loadManualSnapshot();
  const merged = [...list, ...existing].slice(0, 200);
  writeFileSync(
    SNAPSHOT_PATH,
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        note: "Manual TikTok/Meta trend paste — not scraped GMV",
        items: merged,
      },
      null,
      2
    ),
    "utf8"
  );
  return merged;
}

/**
 * Soft TikTok Creative Center radar call — often blocked on datacenter IPs.
 */
async function fetchTikTokCreativeCenter(country = "US") {
  try {
    const url =
      `https://ads.tiktok.com/creative_radar_api/v1/top_product/list` +
      `?period_type=last&last=7&page=1&limit=20&country_code=${encodeURIComponent(country)}` +
      `&ecom_type=l3&order_by=post&order_type=desc`;
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://ads.tiktok.com/business/creativecenter",
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const rows = data?.data?.list || data?.data?.products || data?.data || [];
    if (!Array.isArray(rows) || !rows.length) return null;
    return rows.slice(0, 20).map((r, i) => {
      const title =
        r.product_name || r.name || r.title || r.first_name || r.category_name || `TikTok trend #${i + 1}`;
      return {
        platform: "tiktok",
        title: String(title),
        category: r.category_name || r.first_ecom_category || "TikTok Creative Center",
        trendSignal: "live-attempt",
        metric: r.post || r.cost || r.ctr ? `CC signal · posts/cost available` : "Creative Center row",
        rank: i + 1,
        source: "tiktok-creative-center",
        dataStatus: "RECENT",
        capturedAt: new Date().toISOString(),
        researchUrl: researchLinks(title, country === "GB" ? "UK" : country === "AE" ? "Gulf" : ["US","CA","AU","DE","FR"].includes(country) ? country : "Global").tiktokTopProducts,
      };
    });
  } catch {
    return null;
  }
}

/**
 * Optional Meta Ad Library Graph API (needs META_AD_LIBRARY_TOKEN).
 */
async function fetchMetaAdLibrary(query, country = "US") {
  const token = process.env.META_AD_LIBRARY_TOKEN || process.env.FACEBOOK_ACCESS_TOKEN;
  if (!token || !query) return null;
  try {
    const params = new URLSearchParams({
      search_terms: query,
      ad_reached_countries: JSON.stringify([country]),
      ad_type: "ALL",
      ad_active_status: "ACTIVE",
      limit: "15",
      access_token: token,
      fields: "id,ad_creative_bodies,ad_creative_link_titles,page_name,ad_snapshot_url",
    });
    const res = await fetch(`https://graph.facebook.com/v19.0/ads_archive?${params}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const rows = data.data || [];
    return rows.map((ad, i) => {
      const title =
        ad.ad_creative_link_titles?.[0] ||
        ad.ad_creative_bodies?.[0]?.slice(0, 80) ||
        ad.page_name ||
        `Meta ad #${i + 1}`;
      return {
        platform: "meta",
        title: String(title),
        category: "Meta Ad Library",
        trendSignal: "ads-active",
        metric: `Active ads · page ${ad.page_name || "—"}`,
        source: "meta-ad-library-api",
        researchUrl: ad.ad_snapshot_url || researchLinks(query, country === "GB" ? "UK" : country === "AE" ? "Gulf" : ["US","CA","AU","DE","FR"].includes(country) ? country : "Global").metaAdLibrary,
        dataStatus: "RECENT",
        capturedAt: new Date().toISOString(),
        note: "Ad creatives (not product sales volume)",
      };
    });
  } catch {
    return null;
  }
}

function seedBoard(regionKey, nicheHint) {
  const map = REGION_MAP[regionKey] || REGION_MAP.Global;
  const country = map.tiktok;
  let list = [...(SEED_TRENDS[country] || SEED_TRENDS.US)];
  if (nicheHint) {
    const h = nicheHint.toLowerCase();
    const hit = list.filter(
      (t) =>
        t.title.toLowerCase().includes(h) ||
        t.category.toLowerCase().includes(h) ||
        h.split(/\s+/).some((w) => w.length > 2 && t.title.toLowerCase().includes(w))
    );
    if (hit.length) list = hit;
  }
  return list.map((t, i) => {
    const links = researchLinks(t.title, regionKey);
    return {
      ...t,
      rank: i + 1,
      region: map.label,
      source: "seed-social-board",
      metric: "Curated social-commerce board (verify in Creative Center / Ad Library)",
      researchUrl: t.platform === "tiktok" ? links.tiktokTopProducts : links.metaAdLibrary,
      links,
      note: "Not live sold units — open research URL to validate trending creatives",
    };
  });
}

/**
 * Main entry: TikTok + Meta trending board for a scout region.
 */
export async function fetchSocialTrends({ regionFocus = "Global", nicheHint } = {}) {
  const regionKey = REGION_MAP[regionFocus] ? regionFocus : "Global";
  const map = REGION_MAP[regionKey];
  const manual = loadManualSnapshot()
    .filter((i) => !nicheHint || String(i.title).toLowerCase().includes(String(nicheHint).toLowerCase()))
    .map((i, idx) => ({
      ...i,
      rank: idx + 1,
      researchUrl: researchLinks(i.title, regionKey)[i.platform === "meta" ? "metaAdLibrary" : "tiktokTopProducts"],
      links: researchLinks(i.title, regionKey),
    }));

  const liveTikTok = await fetchTikTokCreativeCenter(map.tiktok);
  const liveMeta = nicheHint
    ? await fetchMetaAdLibrary(nicheHint, map.meta)
    : await fetchMetaAdLibrary("home gadgets", map.meta);

  const seededAll = seedBoard(regionKey, null);
  const seededHint = nicheHint ? seedBoard(regionKey, nicheHint) : seededAll;

  function pick(platform, live) {
    if (live?.length) return live;
    const hinted = seededHint.filter((t) => t.platform === platform);
    if (hinted.length) return hinted;
    return seededAll.filter((t) => t.platform === platform);
  }

  const tiktok = pick("tiktok", liveTikTok);
  const meta = pick("meta", liveMeta);

  return {
    region: map.label,
    regionFocus: regionKey,
    nicheHint: nicheHint || null,
    honesty:
      "TikTok/Meta here = trending creatives & research links. NOT official shop GMV. Live Creative Center often blocked on cloud IPs — then curated board + deep links. Paste manual rows anytime.",
    sources: {
      tiktok: liveTikTok?.length ? "tiktok-creative-center" : "seed + deep links",
      meta: liveMeta?.length ? "meta-ad-library-api" : "seed + Ad Library links",
      manual: manual.length,
    },
    hubs: {
      tiktokCreativeCenter: `https://ads.tiktok.com/business/creativecenter/inspiration/popular/product/pc/en?countryCode=${map.tiktok}`,
      metaAdLibrary: `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${map.meta}&media_type=all`,
    },
    tiktok,
    meta,
    manual,
    items: [...manual, ...tiktok, ...meta],
  };
}
